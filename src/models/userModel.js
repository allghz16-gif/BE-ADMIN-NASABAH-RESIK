const db = require('../config/db');

exports.findByEmail = async (email) => {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
};

// tanpa kolom password
exports.findById = async (id) => {
  const [rows] = await db.query(
    `SELECT id, nama, email, telepon, role, status, foto, last_login_at, created_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

exports.touchLastLogin = (id) =>
  db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);