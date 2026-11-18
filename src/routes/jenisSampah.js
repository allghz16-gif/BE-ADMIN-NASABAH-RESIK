const router = require('express').Router();
const { verifyToken, onlyAdmin } = require('../middleware/auth');
const jenisSampah = require('../controllers/jenisSampahController');

router.get('/', verifyToken, onlyAdmin, jenisSampah.list);

module.exports = router;