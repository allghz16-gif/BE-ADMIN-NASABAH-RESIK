const router = require('express').Router();
const { verifyToken, onlyAdmin } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const c = require('../controllers/setoranController');

router.use(verifyToken, onlyAdmin);
router.get('/', c.list);
router.post('/', uploadImage('bukti-timbangan', 'bukti', { maxSize: null }), c.create); // tanpa batas ukuran
router.get('/:id', c.detail);
router.patch('/:id/setujui', c.approve);
router.patch('/:id/tolak', c.reject);

module.exports = router;