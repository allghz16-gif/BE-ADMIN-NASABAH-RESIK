const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { verifyToken } = require('../middleware/auth');
const { loginSchema, forgotSchema, resetSchema } = require('../validators/authValidator');
const auth = require('../controllers/authController');

const makeLimiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Terlalu banyak percobaan, coba lagi nanti' },
  });

const limiter = makeLimiter(30); // login dan reset
const forgotLimiter = makeLimiter(5); // lebih ketat supaya email tidak di-spam

router.post('/login', limiter, validate(loginSchema), auth.login);
router.post('/logout', auth.logout);
router.post('/forgot-password', forgotLimiter, validate(forgotSchema), auth.forgotPassword);
router.post('/reset-password', limiter, validate(resetSchema), auth.resetPassword);
router.get('/me', verifyToken, auth.me);

module.exports = router;