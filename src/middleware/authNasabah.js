const jwt = require('jsonwebtoken');

// Flutter mengirim token lewat header Authorization, bukan cookie
module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Token tidak ada' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'nasabah') {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });
  }
};