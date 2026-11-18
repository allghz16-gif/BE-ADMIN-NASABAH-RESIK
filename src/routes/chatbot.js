const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const pool = require('../config/db');
const authNasabah = require('../middleware/authNasabah');
const { KNOWLEDGE_BASE } = require('../services/chatbotKnowledge');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const rp = (n) => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID');

async function buildNasabahContext(nasabahId) {
  const [[nasabah]] = await pool.query(
    'SELECT nama, saldo, poin, tier FROM nasabah WHERE id = ?',
    [nasabahId]
  );
  if (!nasabah) return null;

  const [[total]] = await pool.query(
    `SELECT COALESCE(SUM(total_berat), 0) AS total_kg,
            COUNT(*) AS jumlah
       FROM setoran WHERE nasabah_id = ? AND status = 'berhasil'`,
    [nasabahId]
  );
  const [pending] = await pool.query(
    `SELECT COUNT(*) AS n FROM setoran WHERE nasabah_id = ? AND status = 'verifikasi'`,
    [nasabahId]
  );
  const [riwayat] = await pool.query(
    `SELECT id, status, total_berat, total_nilai, alasan_tolak, created_at
       FROM setoran WHERE nasabah_id = ?
       ORDER BY created_at DESC LIMIT 5`,
    [nasabahId]
  );
  const [harga] = await pool.query('SELECT * FROM jenis_sampah');

  const riwayatText = riwayat.length
    ? riwayat.map((r) =>
        `- #${r.id} | ${r.status} | ${Number(r.total_berat)} kg | ${rp(r.total_nilai)} | ` +
        `${new Date(r.created_at).toLocaleDateString('id-ID')}` +
        (r.alasan_tolak ? ` | alasan ditolak: ${r.alasan_tolak}` : '')
      ).join('\n')
    : '- (belum ada setoran)';

  return `
[DATA NASABAH - dari database, selalu benar]
Nama: ${nasabah.nama}
Tier: ${nasabah.tier}
Saldo saat ini: ${rp(nasabah.saldo)}
Poin: ${nasabah.poin}
Total sampah yang sudah diverifikasi: ${Number(total.total_kg)} kg dalam ${total.jumlah} setoran
Setoran menunggu verifikasi: ${pending[0].n}

5 setoran terakhir:
${riwayatText}

Daftar jenis sampah & harga:
${harga.map((j) => `- ${JSON.stringify(j)}`).join('\n')}
`;
}

router.post('/', authNasabah, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Pesan kosong.' });
    }

    const nasabahContext = await buildNasabahContext(req.user.id);
    if (!nasabahContext) {
      return res.status(404).json({ success: false, message: 'Nasabah tidak ditemukan.' });
    }

    const systemInstruction = `
Kamu adalah Asisten DaurUang, chatbot aplikasi bank sampah RESIK.
Jawab dalam bahasa Indonesia yang ramah, singkat, dan jelas.

ATURAN:
1. Untuk saldo, poin, riwayat, dan harga, pakai HANYA angka dari [DATA NASABAH]. Jangan mengarang.
2. Untuk jadwal, cara setor, cara tarik saldo, dan panduan memilah, pakai HANYA [PENGETAHUAN RESIK].
3. Kalau informasinya tidak ada, bilang belum tahu dan arahkan ke pengelola bank sampah. Jangan menebak.
4. Hanya layani topik bank sampah RESIK. Untuk topik lain, tolak sopan dalam 1 kalimat lalu tawarkan bantuan seputar bank sampah.
5. Kamu hanya membaca data, tidak bisa mengubah saldo atau mencatat setoran.

${KNOWLEDGE_BASE}

${nasabahContext}
`;

    const past = (Array.isArray(history) ? history : [])
      .slice(-10)
      .filter((h) => h && h.text && (h.role === 'user' || h.role === 'model'))
      .map((h) => ({ role: h.role, parts: [{ text: String(h.text).slice(0, 1000) }] }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [...past, { role: 'user', parts: [{ text: String(message).slice(0, 1000) }] }],
      config: {
        systemInstruction,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    res.json({ success: true, reply: response.text });
  } catch (error) {
    console.error('Error chatbot:', error);
    const busy = error.status === 429 || error.status === 503;
    res.status(busy ? 503 : 500).json({
      success: false,
      message: busy
        ? 'Asisten sedang sibuk, coba lagi sebentar.'
        : 'Asisten tidak dapat menjawab saat ini.',
    });
  }
});

module.exports = router;