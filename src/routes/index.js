const router = require('express').Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'OK' }));

// nasabah (Flutter) dan login: harus sebelum /auth
router.use('/auth/nasabah', require('./nasabahAuth'));
router.use('/app', require('./app'));
router.use('/auth', require('./auth'));

// AI Chatbot
router.use('/app/chatbot', require('./chatbot'));

// admin
router.use('/admin', require('./admin'));
router.use('/jenis-sampah', require('./jenisSampah'));
router.use('/nasabah', require('./nasabah'));
router.use('/setoran', require('./setoran'));
router.use('/dashboard', require('./dashboard'));
// router.use('/laporan', require('./laporan'));       // file masih kosong
// router.use('/aktivitas', require('./aktivitas'));   // aktifkan setelah file diisi
// router.use('/notifikasi', require('./notifikasi'));
// router.use('/profil', require('./profil'));

module.exports = router;