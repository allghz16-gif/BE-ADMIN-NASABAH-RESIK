const router = require('express').Router();
const authNasabah = require('../middleware/authNasabah');
const { uploadImage } = require('../middleware/upload');
const c = require('../controllers/appAuthController');
const s = require('../controllers/appSetoranController');

router.get('/me', authNasabah, c.me);
router.put('/me', authNasabah, c.updateMe);
router.put('/me/foto', authNasabah, uploadImage('foto-nasabah', 'foto'), c.uploadFoto);
router.get('/jenis-sampah', authNasabah, s.jenis);
router.get('/setoran', authNasabah, s.riwayat);
router.post('/setoran', authNasabah, uploadImage('bukti-timbangan', 'bukti', { maxSize: null }), s.create);

module.exports = router;