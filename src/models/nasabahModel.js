const db = require('../config/db');

// "NSB-0421" dibentuk dari id (tidak disimpan di kolom). IF dipakai karena LPAD memotong id di atas 4 digit.
const KODE = "CONCAT('NSB-', IF(id < 10000, LPAD(id, 4, '0'), CAST(id AS CHAR)))";

// total setoran dihitung dari setoran yang sudah disetujui (status 'berhasil')
const LIST_COLUMNS = `id, ${KODE} AS kode, nama, telepon, alamat, saldo, poin, tier, status, foto,
  (SELECT COALESCE(SUM(s.total_berat), 0) FROM setoran s
    WHERE s.nasabah_id = nasabah.id AND s.status = 'berhasil') AS total_setoran_kg,
  created_at`;

// NIK hanya muncul di detail, tidak di daftar
const DETAIL_COLUMNS = `id, ${KODE} AS kode, nama, nik, telepon, email, jenis_kelamin,
  DATE_FORMAT(tanggal_lahir, '%Y-%m-%d') AS tanggal_lahir, alamat, kota, kecamatan, kelurahan,
  kode_pos, rt, rw, jenis_tempat, latitude, longitude,
  foto, catatan, status, tier, saldo, poin, created_at, updated_at`;

// daftar kolom yang boleh ditulis (whitelist, jadi aman dari injeksi nama kolom)
const WRITABLE = [
  'nama', 'nik', 'telepon', 'email', 'jenis_kelamin', 'tanggal_lahir',
  'alamat', 'kota', 'kecamatan', 'kelurahan', 'kode_pos', 'rt', 'rw',
  'jenis_tempat', 'latitude', 'longitude', 'catatan', 'status', 'foto',
];

const buildWhere = ({ search, status, periode }) => {
  const where = [];
  const params = [];

  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (periode) {
    where.push('created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)');
    params.push(periode);
  }
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`; // karakter wildcard dianggap huruf biasa
    const parts = ['nama LIKE ?', 'telepon LIKE ?'];
    params.push(like, like);

    const kode = search.match(/^nsb-?0*(\d+)$/i); // cari lewat "NSB-0421"
    if (kode) {
      parts.push('id = ?');
      params.push(Number(kode[1]));
    }
    where.push(`(${parts.join(' OR ')})`);
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

exports.findAll = async ({ page, limit, ...filters }) => {
  const w = buildWhere(filters);
  const offset = (page - 1) * limit;

  const [items] = await db.query(
    `SELECT ${LIST_COLUMNS} FROM nasabah ${w.sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...w.params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM nasabah ${w.sql}`, w.params);

  return { items, total };
};

exports.findById = async (identifier) => {
  // Ekstrak angka ID jika bentuknya "NSB-0010" atau gunakan langsung jika berupa angka
  let numericId = identifier;
  if (typeof identifier === 'string') {
    const match = identifier.match(/^nsb-?0*(\d+)$/i);
    numericId = match ? Number(match[1]) : Number(identifier);
  }

  const [rows] = await db.query(
    `SELECT ${DETAIL_COLUMNS} FROM nasabah WHERE id = ? LIMIT 1`,
    [isNaN(numericId) ? 0 : numericId]
  );
  return rows[0] || null;
};

exports.stats = async () => {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status = 'aktif'), 0) AS aktif,
            COALESCE(SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0) AS baru
     FROM nasabah`
  );
  const [[t]] = await db.query("SELECT COUNT(*) AS c FROM setoran WHERE status = 'berhasil'");
  return {
    total: Number(row.total),
    aktif: Number(row.aktif),
    baru: Number(row.baru),
    total_transaksi: Number(t.c),
  };
};

exports.create = async (data) => {
  const values = WRITABLE.map((col) => {
    if (col === 'status') return data.status ?? 'aktif';
    if (col === 'jenis_tempat') return data.jenis_tempat ?? 'Rumah Tangga'; // kolom NOT NULL
    return data[col] ?? null;
  });
  const [result] = await db.query(
    `INSERT INTO nasabah (${WRITABLE.join(', ')}) VALUES (${WRITABLE.map(() => '?').join(', ')})`,
    values
  );
  return result.insertId;
};

// hanya kolom yang dikirim (bukan undefined) yang diubah
exports.update = async (id, data) => {
  const cols = WRITABLE.filter((col) => data[col] !== undefined);
  if (!cols.length) return 0;

  const [result] = await db.query(
    `UPDATE nasabah SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    [...cols.map((c) => data[c]), id]
  );
  return result.affectedRows;
};