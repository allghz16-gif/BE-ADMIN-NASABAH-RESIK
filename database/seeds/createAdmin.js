require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../../src/config/db');

(async () => {
  const [nama, email, telepon, password] = process.argv.slice(2);

  if (!nama || !email || !telepon || !password) {
    console.log('Pemakaian: npm run seed:admin -- "Nama" email@contoh.com 08123456789 PasswordKuat1');
    process.exit(1);
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    console.log('Password minimal 8 karakter dan harus mengandung huruf dan angka');
    process.exit(1);
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO users (nama, email, telepon, password, role, status)
       VALUES (?, ?, ?, ?, 'admin', 'aktif')`,
      [nama, email.toLowerCase(), telepon, hashed]
    );
    console.log(`Admin dibuat: ${email}`);
  } catch (err) {
    console.error(err.code === 'ER_DUP_ENTRY' ? 'Email sudah terdaftar' : err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();