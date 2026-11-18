const router = require('express').Router();
const db = require('../config/db');
const { success, fail } = require('../utils/response');
const { uploadImage } = require('../middleware/upload');

// GET Profile Admin
router.get('/profile', async (req, res) => {
  try {
    // Ubah tabel dari 'admin' menjadi 'users'
    const [rows] = await db.query('SELECT id, nama, email, telepon, foto, created_at FROM users LIMIT 1');
    if (!rows[0]) return fail(res, 'Admin tidak ditemukan', 404);

    const admin = rows[0];
    const dataWithFoto = {
      ...admin,
      foto_url: admin.foto ? `/uploads/${admin.foto}` : null,
    };
    return success(res, dataWithFoto);
  } catch (err) {
    console.error(err);
    return fail(res, 'Terjadi kesalahan pada server', 500);
  }
});

// PUT Profile Admin
router.put('/profile', uploadImage('foto-admin'), async (req, res) => {
  try {
    const { nama, email, telepon, password_baru } = req.body;
    const foto = req.file ? `foto-admin/${req.file.filename}` : undefined;

    // Ubah tabel dari 'admin' menjadi 'users'
    const [rows] = await db.query('SELECT id, foto FROM users LIMIT 1');
    if (!rows[0]) return fail(res, 'Admin tidak ditemukan', 404);
    const adminId = rows[0].id;

    // Ubah tabel dari 'admin' menjadi 'users'
    let query = 'UPDATE users SET nama = ?, email = ?, telepon = ?';
    let params = [nama, email, telepon];

    if (password_baru) {
      query += ', password = ?';
      params.push(password_baru);
    }
    if (foto) {
      query += ', foto = ?';
      params.push(foto);
    }

    query += ' WHERE id = ?';
    params.push(adminId);

    await db.query(query, params);

    // Ubah tabel dari 'admin' menjadi 'users'
    const [updatedRows] = await db.query('SELECT id, nama, email, telepon, foto, created_at FROM users WHERE id = ?', [adminId]);
    const updated = updatedRows[0];
    const resultData = {
      ...updated,
      foto_url: updated.foto ? `/uploads/${updated.foto}` : null,
    };

    return success(res, resultData, 'Profil berhasil diperbarui');
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return fail(res, 'Email sudah digunakan oleh akun lain', 409);
    }
    return fail(res, 'Gagal memperbarui profil', 500);
  }
});

module.exports = router;