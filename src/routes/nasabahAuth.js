const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const authNasabah = require('../middleware/authNasabah');
const { forgotSchema, resetSchema } = require('../validators/authValidator');
const app = require('../controllers/appAuthController');
const auth = require('../controllers/authController');

const makeLimiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Terlalu banyak percobaan, coba lagi nanti' },
  });

router.post('/register', makeLimiter(30), app.register);
router.post('/login', makeLimiter(30), app.login);
router.post('/logout', authNasabah, (req, res) => res.json({ success: true, message: 'Berhasil keluar' }));
router.post('/password-reset/request', makeLimiter(5), validate(forgotSchema), auth.forgotPassword);
router.post('/password-reset/complete', makeLimiter(10), validate(resetSchema), auth.resetPassword);

module.exports = router;