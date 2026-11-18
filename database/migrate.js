require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${DB_NAME}\``);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));

    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (done.has(file)) continue;

      const sql = fs.readFileSync(path.join(dir, file), 'utf8').trim();
      if (!sql) {
        console.log(`lewati (kosong)  ${file}`);
        continue;
      }

      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log(`dijalankan       ${file}`);
    }

    console.log('Migrasi selesai.');
  } catch (err) {
    console.error('Migrasi gagal:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();