const router = require('express').Router();
const validate = require('../middleware/validate');
const { verifyToken, onlyAdmin } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const {
  createNasabahSchema,
  updateNasabahSchema,
  statusSchema,
  listQuerySchema,
} = require('../validators/nasabahValidator');
const nasabah = require('../controllers/nasabahController');

// semua jalur di bawah ini wajib login sebagai admin
router.use(verifyToken, onlyAdmin);

router.get('/', validate(listQuerySchema, 'query'), nasabah.list);
router.get('/stats', nasabah.stats); // harus di atas '/:id'
router.post('/', uploadImage('foto-nasabah'), validate(createNasabahSchema), nasabah.create);
router.get('/:id', nasabah.detail);
router.put('/:id', uploadImage('foto-nasabah'), validate(updateNasabahSchema), nasabah.update);
router.patch('/:id/status', validate(statusSchema), nasabah.updateStatus);

module.exports = router;