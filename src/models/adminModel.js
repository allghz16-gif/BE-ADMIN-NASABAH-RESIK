const db = require('../config/db');

exports.getProfile = async (adminId) => {
  const [rows] = await db.query(
    `SELECT id, nama, email, telepon, foto, role, created_at FROM admin WHERE id = ? LIMIT 1`,
    [adminId]
  );
  return rows[0] || null;
};

exports.updateProfile = async (adminId, data) => {
  const { nama, email, telepon } = data;
  const [result] = await db.query(
    `UPDATE admin SET nama = ?, email = ?, telepon = ? WHERE id = ?`,
    [nama, email, telepon, adminId]
  );
  return result.affectedRows;
};

exports.updatePassword = async (adminId, newPasswordHash) => {
  const [result] = await db.query(
    `UPDATE admin SET password = ? WHERE id = ?`,
    [newPasswordHash, adminId]
  );
  return result.affectedRows;
};