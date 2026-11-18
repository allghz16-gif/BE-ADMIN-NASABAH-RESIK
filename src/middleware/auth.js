const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

exports.verifyToken = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token =
    req.cookies?.token || (header.startsWith('Bearer ') ? header.slice(7) : null);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });
  }

  // dicek ke database di tiap request, jadi akun yang dinonaktifkan langsung terblokir
  const user = await User.findById(payload.id);
  if (!user || user.status !== 'aktif') {
    return res.status(401).json({ success: false, message: 'Akun tidak aktif' });
  }

  req.user = user;
  next();
};

exports.onlyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  next();
};