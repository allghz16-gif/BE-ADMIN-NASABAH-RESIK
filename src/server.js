require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 5000;

// Tangkap error tak tertangkap agar ketahuan penyebab crash-nya di terminal
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET belum diisi di .env');
  process.exit(1);
}

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database terhubung');
    app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
  } catch (err) {
    console.error('Gagal konek database:', err.message);
    process.exit(1);
  }
})();