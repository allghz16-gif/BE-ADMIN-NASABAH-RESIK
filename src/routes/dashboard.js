const router = require('express').Router();
const { verifyToken, onlyAdmin } = require('../middleware/auth');
const c = require('../controllers/dashboardController');

router.use(verifyToken, onlyAdmin);
router.get('/ringkasan', c.ringkasan);
router.get('/setoran-terbaru', c.setoranTerbaru);
router.get('/grafik/setoran', c.grafikSetoran);
router.get('/grafik/nasabah', c.grafikNasabah);

module.exports = router;