const db = require('../config/db');

const KODE = "CONCAT('STR-', LPAD(s.id, 4, '0'))";
const NKODE = "CONCAT('NSB-', LPAD(n.id, 4, '0'))";

const where = ({ search, status, tanggal }) => {
  const w = [], p = [];
  if (status) { w.push('s.status = ?'); p.push(status); }
  if (tanggal) { w.push('DATE(s.created_at) = ?'); p.push(tanggal); }
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const parts = ['n.nama LIKE ?'];
    p.push(like);
    const m = search.match(/^(?:str|nsb)-?0*(\d+)$/i);
    if (m) {
      parts.push(/^str/i.test(search) ? 's.id = ?' : 'n.id = ?');
      p.push(Number(m[1]));
    }
    w.push(`(${parts.join(' OR ')})`);
  }
  return { sql: w.length ? `WHERE ${w.join(' AND ')}` : '', params: p };
};

exports.findAll = async ({ page, limit, ...filters }) => {
  const w = where(filters);
  const [items] = await db.query(
    `SELECT s.id, ${KODE} AS kode, s.status, s.total_berat, s.total_nilai, s.total_poin, s.created_at,
            n.id AS nasabah_id, ${NKODE} AS nasabah_kode, n.nama AS nasabah,
            (SELECT GROUP_CONCAT(j.nama ORDER BY j.nama SEPARATOR ', ')
               FROM setoran_item i JOIN jenis_sampah j ON j.id = i.jenis_sampah_id
              WHERE i.setoran_id = s.id) AS jenis
     FROM setoran s JOIN nasabah n ON n.id = s.nasabah_id
     ${w.sql} ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`,
    [...w.params, limit, (page - 1) * limit]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM setoran s JOIN nasabah n ON n.id = s.nasabah_id ${w.sql}`,
    w.params
  );
  return { items, total };
};

exports.findById = async (id) => {
  const [[row]] = await db.query(
    `SELECT s.*, ${KODE} AS kode, n.nama AS nasabah, ${NKODE} AS nasabah_kode, n.telepon AS nasabah_telepon
     FROM setoran s JOIN nasabah n ON n.id = s.nasabah_id WHERE s.id = ? LIMIT 1`,
    [id]
  );
  if (!row) return null;
  const [items] = await db.query(
    `SELECT i.id, j.nama AS jenis, i.berat, i.harga_per_kg, i.poin_per_kg, i.subtotal, i.poin
     FROM setoran_item i JOIN jenis_sampah j ON j.id = i.jenis_sampah_id WHERE i.setoran_id = ?`,
    [id]
  );
  return { ...row, items };
};

// setujui: ubah status + tambah saldo dan poin + catat transaksi, semuanya atomik
exports.approve = async (id, adminId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[s]] = await conn.query('SELECT * FROM setoran WHERE id = ? FOR UPDATE', [id]);
    if (!s) { await conn.rollback(); return { error: 404, message: 'Setoran tidak ditemukan' }; }
    if (s.status !== 'verifikasi') { await conn.rollback(); return { error: 409, message: 'Setoran sudah diproses' }; }

    await conn.query(
      "UPDATE setoran SET status = 'berhasil', diverifikasi_oleh = ?, diverifikasi_at = NOW() WHERE id = ?",
      [adminId, id]
    );
    await conn.query('UPDATE nasabah SET saldo = saldo + ?, poin = poin + ? WHERE id = ?', [s.total_nilai, s.total_poin, s.nasabah_id]);
    const [[n]] = await conn.query('SELECT saldo FROM nasabah WHERE id = ?', [s.nasabah_id]);
    await conn.query(
      "INSERT INTO transaksi_saldo (nasabah_id, setoran_id, tipe, jumlah, poin, saldo_setelah, keterangan) VALUES (?, ?, 'setoran', ?, ?, ?, ?)",
      [s.nasabah_id, id, s.total_nilai, s.total_poin, n.saldo, `Setoran STR-${String(id).padStart(4, '0')}`]
    );
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.reject = async (id, adminId, alasan) => {
  const [r] = await db.query(
    "UPDATE setoran SET status = 'ditolak', alasan_tolak = ?, diverifikasi_oleh = ?, diverifikasi_at = NOW() WHERE id = ? AND status = 'verifikasi'",
    [alasan, adminId, id]
  );
  return r.affectedRows;
};