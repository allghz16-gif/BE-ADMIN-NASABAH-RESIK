const db = require('../config/db');

exports.listAktif = async () => {
  const [rows] = await db.query(
    'SELECT id, nama, harga_per_kg, poin_per_kg FROM jenis_sampah WHERE aktif = 1 ORDER BY id'
  );
  return rows;
};