const db = require('../config/db');

const TARGET_KG = Number(process.env.TARGET_SETORAN_KG) || 1000; // target setoran per bulan

exports.ringkasan = async (req, res, next) => {
  try {
    const [[n]] = await db.query('SELECT COUNT(*) AS total, COALESCE(SUM(saldo), 0) AS saldo FROM nasabah');
    const [[s]] = await db.query(
      "SELECT COALESCE(SUM(total_berat), 0) AS kg FROM setoran WHERE status = 'berhasil'"
    );
    const [[b]] = await db.query(
      `SELECT COALESCE(SUM(total_berat), 0) AS kg FROM setoran
       WHERE status = 'berhasil' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`
    );
    const kgBulanIni = Number(b.kg);
    res.json({
      success: true,
      data: {
        total_nasabah: Number(n.total),
        total_saldo: Number(n.saldo),
        total_setoran_kg: Number(s.kg),
        setoran_bulan_ini_kg: kgBulanIni,
        target_kg: TARGET_KG,
        target_persen: Math.min(100, Math.round((kgBulanIni / TARGET_KG) * 100)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// setoran terbaru untuk tabel di dashboard
exports.setoranTerbaru = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, CONCAT('STR-', LPAD(s.id, 4, '0')) AS kode, s.status, s.total_berat, s.total_poin,
              s.created_at, n.nama AS nasabah
       FROM setoran s JOIN nasabah n ON n.id = s.nasabah_id
       ORDER BY s.created_at DESC, s.id DESC LIMIT 5`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// total kg setoran berhasil per bulan, tahun tertentu (untuk grafik)
exports.grafikSetoran = async (req, res, next) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const [rows] = await db.query(
      `SELECT MONTH(created_at) AS bulan, COALESCE(SUM(total_berat), 0) AS kg
       FROM setoran WHERE status = 'berhasil' AND YEAR(created_at) = ? GROUP BY MONTH(created_at)`,
      [tahun]
    );
    const data = Array.from({ length: 12 }, (_, i) => {
      const r = rows.find((x) => x.bulan === i + 1);
      return Number(r?.kg ?? 0);
    });
    res.json({ success: true, data: { tahun, data } });
  } catch (err) {
    next(err);
  }
};

// jumlah nasabah baru per bulan (untuk grafik)
exports.grafikNasabah = async (req, res, next) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const [rows] = await db.query(
      `SELECT MONTH(created_at) AS bulan, COUNT(*) AS jumlah
       FROM nasabah WHERE YEAR(created_at) = ? GROUP BY MONTH(created_at)`,
      [tahun]
    );
    const data = Array.from({ length: 12 }, (_, i) => {
      const r = rows.find((x) => x.bulan === i + 1);
      return Number(r?.jumlah ?? 0);
    });
    res.json({ success: true, data: { tahun, data } });
  } catch (err) {
    next(err);
  }
};