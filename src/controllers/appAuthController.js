const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const JENIS_TEMPAT = ['Rumah Tangga', 'Sekolah', 'Kantor', 'Usaha'];

const sign = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });

// +62812..., 62812..., 0812... jadi 0812...
const normTelepon = (t = '') => {
  const s = String(t).replace(/[\s\-().]/g, '');
  if (s.startsWith('+62')) return '0' + s.slice(3);
  if (s.startsWith('62')) return '0' + s.slice(2);
  return s;
};

const PROFILE_SQL = `SELECT n.id, CONCAT('NSB-', IF(n.id < 10000, LPAD(n.id, 4, '0'), CAST(n.id AS CHAR))) AS kode,
  n.nama, n.nik, n.email, n.telepon, n.alamat, n.kota, n.kecamatan, n.kelurahan, n.kode_pos,
  n.rt, n.rw, n.jenis_tempat, n.latitude, n.longitude,
  n.foto, n.saldo, n.poin, n.tier, n.status
  FROM nasabah n WHERE n.user_id = ? LIMIT 1`;

const ALAMAT_FIELDS = ['alamat', 'kota', 'kecamatan', 'kelurahan', 'kode_pos', 'rt', 'rw', 'jenis_tempat', 'latitude', 'longitude'];

exports.register = async (req, res, next) => {
  const { nama, password } = req.body;
  const telepon = normTelepon(req.body.telepon);
  const email = req.body.email?.trim() || null;

  if (!nama || !telepon || !password || password.length < 8) {
    return res.status(422).json({ success: false, message: 'Nama, telepon, dan password (min. 8 karakter) wajib diisi' });
  }
  if (req.body.jenis_tempat && !JENIS_TEMPAT.includes(req.body.jenis_tempat)) {
    return res.status(422).json({ success: false, message: 'Jenis tempat tidak valid' });
  }

  const alamat = {};
  ALAMAT_FIELDS.forEach((f) => { alamat[f] = req.body[f] === '' ? null : req.body[f] ?? null; });
  if (!alamat.jenis_tempat) alamat.jenis_tempat = 'Rumah Tangga';

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[dupUser]] = await conn.query(
      "SELECT id FROM users WHERE role = 'nasabah' AND (telepon = ? OR (? IS NOT NULL AND email = ?)) LIMIT 1",
      [telepon, email, email]
    );
    if (dupUser) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Telepon atau email sudah terdaftar' });
    }

    const [[existing]] = await conn.query('SELECT id, user_id FROM nasabah WHERE telepon = ? LIMIT 1', [telepon]);
    if (existing?.user_id) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Telepon sudah terdaftar' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [u] = await conn.query(
      "INSERT INTO users (nama, email, telepon, password, role, status) VALUES (?, ?, ?, ?, 'nasabah', 'aktif')",
      [nama, email, telepon, hash]
    );

    if (existing) {
      await conn.query('UPDATE nasabah SET user_id = ? WHERE id = ?', [u.insertId, existing.id]);
    } else {
      await conn.query(
        `INSERT INTO nasabah (user_id, nama, telepon, email, status, ${ALAMAT_FIELDS.join(', ')})
         VALUES (?, ?, ?, ?, 'aktif', ${ALAMAT_FIELDS.map(() => '?').join(', ')})`,
        [u.insertId, nama, telepon, email, ...ALAMAT_FIELDS.map((f) => alamat[f])]
      );
    }

    await conn.commit();
    const [[profil]] = await db.query(PROFILE_SQL, [u.insertId]);
    res.status(201).json({ success: true, data: { token: sign({ id: u.insertId, role: 'nasabah' }), nasabah: profil } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

exports.login = async (req, res, next) => {
  try {
    const raw = req.body.telepon_atau_email || req.body.telepon || req.body.email || req.body.identifier || '';
    const telepon = normTelepon(raw);
    const [[user]] = await db.query(
      "SELECT * FROM users WHERE role = 'nasabah' AND (telepon = ? OR email = ?) LIMIT 1",
      [telepon, raw]
    );
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
      return res.status(401).json({ success: false, message: 'Telepon/email atau password salah' });
    }
    if (user.status !== 'aktif') {
      return res.status(403).json({ success: false, message: 'Akun tidak aktif' });
    }
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    const [[profil]] = await db.query(PROFILE_SQL, [user.id]);
    res.json({ success: true, data: { token: sign(user), nasabah: profil } });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const [[profil]] = await db.query(PROFILE_SQL, [req.user.id]);
    res.json({ success: true, data: profil });
  } catch (err) {
    next(err);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const fields = ['nama', 'nik', ...ALAMAT_FIELDS].filter((f) => req.body[f] !== undefined);
    const val = (f) => (req.body[f] === '' && f !== 'nama' ? null : req.body[f]);
    if (fields.length) {
      await db.query(
        `UPDATE nasabah SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE user_id = ?`,
        [...fields.map(val), req.user.id]
      );
    }
    const [[profil]] = await db.query(PROFILE_SQL, [req.user.id]);
    res.json({ success: true, data: profil });
  } catch (err) {
    next(err);
  }
};

exports.uploadFoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ success: false, message: 'File foto wajib dikirim (field: foto)' });
    }
    const [[old]] = await db.query('SELECT foto FROM nasabah WHERE user_id = ? LIMIT 1', [req.user.id]);
    const relPath = `foto-nasabah/${req.file.filename}`;
    await db.query('UPDATE nasabah SET foto = ? WHERE user_id = ?', [relPath, req.user.id]);
    if (old?.foto) fs.unlink(path.join(__dirname, '..', '..', 'uploads', old.foto), () => {});

    res.json({ success: true, data: { foto: relPath, url: `/uploads/${relPath}` } });
  } catch (err) {
    next(err);
  }
};