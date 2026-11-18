const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const httpError = (message, status) => Object.assign(new Error(message), { status });

// kode tampilan dibentuk dari id (tabel tidak punya kolom kode)
const kodeSetoran = (id) => `STR-${String(id).padStart(4, '0')}`;
const kodeNasabah = (id) => `NSB-${String(id).padStart(4, '0')}`;

// terima "NSB-0421", "0421", atau 421 -> 421
const parseId = (v) => {
  const m = String(v ?? '').match(/(\d+)$/);
  return m ? Number(m[1]) : null;
};

const removeFile = (file) => {
  if (file && file.path) fs.unlink(file.path, () => {});
};

const formatSetoran = (r) => ({
  ...r,
  kode: kodeSetoran(r.id),
  nasabah_kode: r.nasabah_id ? kodeNasabah(r.nasabah_id) : null,
});

// GET /api/setoran?status=verifikasi&q=budi&page=1&limit=10
exports.list = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const where = [];
    const params = [];

    if (['verifikasi', 'berhasil', 'ditolak'].includes(req.query.status)) {
      where.push('s.status = ?');
      params.push(req.query.status);
    }
    const cari = req.query.search || req.query.q;
    if (cari) {
      where.push('(n.nama LIKE ? OR s.id = ?)');
      params.push(`%${cari}%`, parseId(cari) || 0);
    }
    if (req.query.tanggal) {
      where.push('DATE(s.created_at) = ?');
      params.push(req.query.tanggal);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM setoran s JOIN nasabah n ON n.id = s.nasabah_id ${clause}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT s.*, n.nama AS nasabah,
              (SELECT GROUP_CONCAT(DISTINCT j.nama ORDER BY j.nama SEPARATOR ', ')
                 FROM setoran_item i JOIN jenis_sampah j ON j.id = i.jenis_sampah_id
                WHERE i.setoran_id = s.id) AS jenis
         FROM setoran s JOIN nasabah n ON n.id = s.nasabah_id
         ${clause}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );

    res.json({
      success: true,
      data: { items: rows.map(formatSetoran), total, page, limit },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/setoran/:id
exports.detail = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const [rows] = await pool.query(
      `SELECT s.*, n.nama AS nasabah, n.telepon AS nasabah_telepon
         FROM setoran s JOIN nasabah n ON n.id = s.nasabah_id
        WHERE s.id = ?`,
      [id]
    );
    if (rows.length === 0) throw httpError('Setoran tidak ditemukan', 404);

    const [items] = await pool.query(
      `SELECT i.*, j.nama AS jenis
         FROM setoran_item i JOIN jenis_sampah j ON j.id = i.jenis_sampah_id
        WHERE i.setoran_id = ?`,
      [id]
    );

    res.json({ success: true, data: { ...formatSetoran(rows[0]), items } });
  } catch (err) {
    next(err);
  }
};

// POST /api/setoran  (multipart/form-data: nasabah_id, items (JSON string), catatan, bukti (file))
exports.create = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const nasabahId = parseId(req.body.nasabah_id);
    let items = req.body.items || [];
    if (typeof items === 'string') items = JSON.parse(items);

    if (!nasabahId) throw httpError('Nasabah wajib diisi', 400);
    if (!Array.isArray(items) || items.length === 0) throw httpError('Item setoran wajib diisi', 400);

    await conn.beginTransaction();

    const [nasabah] = await conn.query('SELECT id, status FROM nasabah WHERE id = ?', [nasabahId]);
    if (nasabah.length === 0) throw httpError('Nasabah tidak ditemukan', 404);
    if (nasabah[0].status !== 'aktif') throw httpError('Nasabah tidak aktif', 400);

    // snapshot harga & poin dari jenis_sampah saat setoran dibuat
    let totalBerat = 0, totalNilai = 0, totalPoin = 0;
    const rows = [];
    for (const it of items) {
      const jenisId = Number(it.jenis_sampah_id ?? it.jenis_id);
      const berat = Number(it.berat);
      if (!jenisId || !(berat > 0)) throw httpError('Jenis sampah dan berat harus valid', 400);

      const [j] = await conn.query(
        'SELECT id, harga_per_kg, poin_per_kg FROM jenis_sampah WHERE id = ? AND aktif = 1',
        [jenisId]
      );
      if (j.length === 0) throw httpError('Jenis sampah tidak valid atau tidak aktif', 400);

      const subtotal = berat * Number(j[0].harga_per_kg);
      const poin = Math.round(berat * Number(j[0].poin_per_kg));
      totalBerat += berat;
      totalNilai += subtotal;
      totalPoin += poin;
      rows.push([null, jenisId, berat, j[0].harga_per_kg, j[0].poin_per_kg, subtotal, poin]);
    }

    const bukti = req.file ? `bukti-timbangan/${req.file.filename}` : null;

    const [result] = await conn.query(
      `INSERT INTO setoran (nasabah_id, status, sumber, total_berat, total_nilai, total_poin, bukti_timbangan, catatan)
       VALUES (?, 'verifikasi', 'admin', ?, ?, ?, ?, ?)`,
      [nasabahId, totalBerat, totalNilai, totalPoin, bukti, req.body.catatan || null]
    );

    const itemRows = rows.map((r) => [result.insertId, ...r.slice(1)]);
    await conn.query(
      `INSERT INTO setoran_item (setoran_id, jenis_sampah_id, berat, harga_per_kg, poin_per_kg, subtotal, poin)
       VALUES ?`,
      [itemRows]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        kode: kodeSetoran(result.insertId),
        status: 'verifikasi',
        total_berat: totalBerat,
        total_nilai: totalNilai,
        total_poin: totalPoin,
      },
    });
  } catch (err) {
    await conn.rollback();
    removeFile(req.file);
    next(err);
  } finally {
    conn.release();
  }
};

// PATCH /api/setoran/:id/setujui
exports.approve = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = parseId(req.params.id);
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM setoran WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw httpError('Setoran tidak ditemukan', 404);
    const s = rows[0];
    if (s.status !== 'verifikasi') throw httpError('Setoran ini sudah diproses', 400);

    await conn.query(
      `UPDATE setoran SET status = 'berhasil', diverifikasi_oleh = ?, diverifikasi_at = NOW() WHERE id = ?`,
      [req.user?.id ?? null, id]
    );

    await conn.query('UPDATE nasabah SET saldo = saldo + ?, poin = poin + ? WHERE id = ?', [
      s.total_nilai,
      s.total_poin,
      s.nasabah_id,
    ]);

    const [[n]] = await conn.query('SELECT saldo FROM nasabah WHERE id = ?', [s.nasabah_id]);

    await conn.query(
      `INSERT INTO transaksi_saldo (nasabah_id, setoran_id, tipe, jumlah, poin, saldo_setelah, keterangan)
       VALUES (?, ?, 'setoran', ?, ?, ?, ?)`,
      [s.nasabah_id, id, s.total_nilai, s.total_poin, n.saldo, `Setoran ${kodeSetoran(id)} disetujui`]
    );

    await conn.commit();
    res.json({ success: true, message: 'Setoran disetujui', data: { id, status: 'berhasil' } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// PATCH /api/setoran/:id/tolak  (body: { alasan })
exports.reject = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const alasan = (req.body.alasan || '').trim();
    if (!alasan) throw httpError('Alasan penolakan wajib diisi', 400);

    const [result] = await pool.query(
      `UPDATE setoran
          SET status = 'ditolak', alasan_tolak = ?, diverifikasi_oleh = ?, diverifikasi_at = NOW()
        WHERE id = ? AND status = 'verifikasi'`,
      [alasan.slice(0, 255), req.user?.id ?? null, id]
    );
    if (result.affectedRows === 0) {
      throw httpError('Setoran tidak ditemukan atau sudah diproses', 404);
    }

    res.json({ success: true, message: 'Setoran ditolak', data: { id, status: 'ditolak' } });
  } catch (err) {
    next(err);
  }
};