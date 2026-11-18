const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// request datang lewat proxy Next.js, jadi IP asli dibaca dari header
app.set('trust proxy', 1);

// cross-origin supaya gambar di /uploads bisa dimuat dari frontend yang beda port
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Daftar origin yang diizinkan (Next.js admin & Flutter web / port lokal pengembangan)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:49728',
  'http://127.0.0.1:49728'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (seperti mobile app native, Postman, atau curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/', (req, res) => res.json({ message: 'RESIK API jalan' }));
app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});
app.use(errorHandler);

module.exports = app;