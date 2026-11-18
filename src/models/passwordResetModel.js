const db = require('../config/db');

exports.invalidateForUser = (userId) =>
  db.query('DELETE FROM password_resets WHERE user_id = ?', [userId]);

// expires_at dihitung oleh MySQL supaya tidak terpengaruh beda zona waktu Node dan DB
exports.create = (userId, tokenHash, minutes = 30) =>
  db.query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, tokenHash, minutes]
  );

// Cek token + ganti password + hanguskan semua token user, dalam satu transaksi.
// Mengembalikan user_id kalau berhasil, atau null kalau token tidak valid / kedaluwarsa.
exports.consume = async (tokenHash, hashedPassword) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT user_id FROM password_resets
       WHERE token_hash = ? AND expires_at > NOW()
       LIMIT 1 FOR UPDATE`,
      [tokenHash]
    );
    if (!rows[0]) {
      await conn.rollback();
      return null;
    }

    const userId = rows[0].user_id;
    await conn.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    await conn.query('DELETE FROM password_resets WHERE user_id = ?', [userId]);

    await conn.commit();
    return userId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};