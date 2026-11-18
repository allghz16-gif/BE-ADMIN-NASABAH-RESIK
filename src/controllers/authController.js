const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const PasswordReset = require('../models/passwordResetModel');
const { sendResetPasswordEmail } = require('../services/mailer');
const { success, fail } = require('../utils/response');

// dipakai supaya waktu respons sama, baik email terdaftar maupun tidak
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const publicUser = ({ id, nama, email, telepon, role, status, foto }) => ({
  id, nama, email, telepon, role, status, foto,
});

const signToken = (user, remember) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: remember ? '30d' : process.env.JWT_EXPIRES_IN || '1d',
  });

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

exports.login = async (req, res) => {
  const { email, password, remember } = req.body;

  const user = await User.findByEmail(email);
  const cocok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

  if (!user || !cocok) return fail(res, 'Email atau password salah', 401);
  if (user.role !== 'admin') return fail(res, 'Akun ini tidak punya akses ke panel admin', 403);
  if (user.status !== 'aktif') return fail(res, 'Akun dinonaktifkan', 403);

  await User.touchLastLogin(user.id);

  const token = signToken(user, remember);
  // "Ingat saya": cookie 30 hari, kalau tidak dicentang jadi cookie sesi
  res.cookie('token', token, {
    ...cookieBase,
    ...(remember && { maxAge: 30 * 24 * 60 * 60 * 1000 }),
  });

  return success(res, { token, user: publicUser(user) }, 'Login berhasil');
};

exports.logout = (req, res) => {
  res.clearCookie('token', cookieBase);
  return success(res, null, 'Logout berhasil');
};

exports.me = (req, res) => success(res, req.user);

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findByEmail(email);

  // hanya admin yang aktif yang dikirimi tautan
  if (user && user.role === 'admin' && user.status === 'aktif') {
    const token = crypto.randomBytes(32).toString('hex');

    await PasswordReset.invalidateForUser(user.id); // tautan lama langsung hangus
    await PasswordReset.create(user.id, sha256(token)); // yang disimpan hanya hash-nya

    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    // email dikirim di latar belakang supaya respons tetap cepat
    sendResetPasswordEmail(user.email, user.nama, link).catch((err) =>
      console.error('Gagal kirim email reset:', err.message)
    );
  }

  // respons selalu sama supaya email yang terdaftar tidak bisa ditebak
  return success(res, null, 'Jika email terdaftar, tautan reset password sudah dikirim.');
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);
  const userId = await PasswordReset.consume(sha256(token), hashed);

  if (!userId) {
    return fail(res, 'Tautan reset tidak valid atau sudah kedaluwarsa', 400);
  }

  return success(res, null, 'Password berhasil diubah. Silakan login dengan password baru.');
};