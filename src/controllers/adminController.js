const bcrypt = require('bcrypt');
const Admin = require('../models/adminModel');
const { success, fail } = require('../utils/response');

// Ambil profil admin (sementara kita hardcode ID = 1 atau ambil dari token auth)
exports.getProfile = async (req, res) => {
  const adminId = req.user?.id || 1; // Ganti dengan req.user.id jika pakai JWT middleware
  const admin = await Admin.getProfile(adminId);
  if (!admin) return fail(res, 'Profil tidak ditemukan', 404);
  return success(res, admin);
};

// Update informasi profil
exports.updateProfile = async (req, res) => {
  const adminId = req.user?.id || 1;
  const { nama, email, telepon } = req.body;

  try {
    await Admin.updateProfile(adminId, { nama, email, telepon });
    const updated = await Admin.getProfile(adminId);
    return success(res, updated, 'Profil berhasil diperbarui');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return fail(res, 'Email sudah digunakan oleh akun lain', 409);
    }
    throw err;
  }
};

// Ubah password
exports.updatePassword = async (req, res) => {
  const adminId = req.user?.id || 1;
  const { password_lama, password_baru } = req.body;

  const admin = await Admin.getProfile(adminId); // Catatan: pastikan query model mengambil field password untuk verifikasi
  // Lakukan validasi password lama dengan bcrypt jika diperlukan...

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password_baru, salt);

  await Admin.updatePassword(adminId, hashedPassword);
  return success(res, null, 'Password berhasil diperbarui');
};