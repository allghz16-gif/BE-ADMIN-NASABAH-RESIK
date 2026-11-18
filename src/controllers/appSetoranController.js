const fs = require('fs');
const db = require('../config/db');

const fail = (req, res, status, message) => {
  if (req.file) fs.unlink(req.file.path, () => {}); // jangan biarkan file yatim
  return res.status(status).json({ success: false, message });
};

const KODE = "CONCAT('STR-', LPAD(s.id, 4, '0'))";

// daftar jenis sampah aktif untuk dropdown di Flutter
exports.jenis = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nama, harga_per_kg, poin_per_kg FROM jenis_sampah WHERE aktif = 1 ORDER BY nama'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// multipart/form-data: field "bukti" (foto) dan "items" (JSON string)
// items contoh: [{"jenis_sampah_id":1,"berat":2.5},{"jenis_sampah_id":3,"berat":1}]
exports.create = async (req, res, next) => {
  let items;
  try {
    items = JSON.parse(req.body.items || '[]');
  } catch {
    return fail(req, res, 422, 'Format items tidak valid');
  }
  if (!req.file) return fail(req, res, 422, 'Foto bukti timbangan wajib diunggah (field: bukti)');
  if (!Array.isArray(items) || !items.length || items.length > 10) {
    return fail(req, res, 422, 'Pilih 1 sampai 10 jenis sampah');
  }
  const ids = items.map((i) => Number(i.jenis_sampah_id));
  if (new Set(ids).size !== ids.length) return fail(req, res, 422, 'Jenis sampah tidak boleh dobel');
  if (items.some((i) => !(Number(i.berat) > 0 && Number(i.berat) <= 1000))) {
    return fail(req, res, 422, 'Berat harus lebih dari 0 dan maksimal 1000 kg');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[nasabah]] = await conn.query('SELECT id, status FROM nasabah WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!nasabah || nasabah.status !== 'aktif') {
      await conn.rollback();
      return fail(req, res, 403, 'Akun nasabah tidak aktif');
    }

    const [jenisRows] = await conn.query(
      'SELECT id, harga_per_kg, poin_per_kg FROM jenis_sampah WHERE aktif = 1 AND id IN (?)',
      [ids]
    );
    if (jenisRows.length !== ids.length) {
      await conn.rollback();
      return fail(req, res, 422, 'Ada jenis sampah yang tidak valid');
    }
    const jenisMap = new Map(jenisRows.map((j) => [j.id, j]));

    // harga dan poin dihitung di server, bukan dari data yang dikirim aplikasi
    let totalBerat = 0, totalNilai = 0, totalPoin = 0;
    const rows = items.map((i) => {
      const j = jenisMap.get(Number(i.jenis_sampah_id));
      const berat = Math.round(Number(i.berat) * 100) / 100;
      const subtotal = Math.round(berat * Number(j.harga_per_kg));
      const poin = Math.round(berat * j.poin_per_kg);
      totalBerat += berat; totalNilai += subtotal; totalPoin += poin;
      return [j.id, berat, j.harga_per_kg, j.poin_per_kg, subtotal, poin];
    });

    const [s] = await conn.query(
      `INSERT INTO setoran (nasabah_id, status, sumber, total_berat, total_nilai, total_poin, bukti_timbangan, catatan)
       VALUES (?, 'verifikasi', 'app', ?, ?, ?, ?, ?)`,
      [nasabah.id, totalBerat, totalNilai, totalPoin, `bukti-timbangan/${req.file.filename}`, req.body.catatan || null]
    );
    await conn.query(
      'INSERT INTO setoran_item (setoran_id, jenis_sampah_id, berat, harga_per_kg, poin_per_kg, subtotal, poin) VALUES ?',
      [rows.map((r) => [s.insertId, ...r])]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      data: { id: s.insertId, kode: `STR-${String(s.insertId).padStart(4, '0')}`, status: 'verifikasi', total_berat: totalBerat, total_nilai: totalNilai, total_poin: totalPoin },
    });
  } catch (err) {
    await conn.rollback();
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  } finally {
    conn.release();
  }
};

// riwayat setoran milik nasabah yang login
exports.riwayat = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, ${KODE} AS kode, s.status, s.total_berat, s.total_nilai, s.total_poin,
              s.bukti_timbangan, s.alasan_tolak, s.created_at,
              s.total_berat AS berat_kg, s.total_nilai AS total_saldo, s.created_at AS tanggal,
              (SELECT GROUP_CONCAT(j.nama ORDER BY j.nama SEPARATOR ', ')
                 FROM setoran_item i JOIN jenis_sampah j ON j.id = i.jenis_sampah_id
                WHERE i.setoran_id = s.id) AS jenis
       FROM setoran s JOIN nasabah n ON n.id = s.nasabah_id
       WHERE n.user_id = ? ORDER BY s.created_at DESC, s.id DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};