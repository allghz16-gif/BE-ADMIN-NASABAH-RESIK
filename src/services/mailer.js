const nodemailer = require('nodemailer');

const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

const transporter = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

exports.sendResetPasswordEmail = async (to, nama, link) => {
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SMTP belum dikonfigurasi, email reset password tidak terkirim');
      return;
    }
    // mode development: tautan dicetak di terminal server
    console.log(`\n[DEV] Tautan reset password untuk ${to}:\n${link}\n`);
    return;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'Atur ulang password akun RESIK Admin',
    text:
      `Halo ${nama},\n\n` +
      `Kami menerima permintaan untuk mengatur ulang password akun RESIK Admin Anda. ` +
      `Buka tautan berikut (berlaku 30 menit):\n\n${link}\n\n` +
      `Jika Anda tidak merasa meminta ini, abaikan email ini. Password Anda tidak akan berubah.\n\nTim RESIK`,
    html:
      `<p>Halo ${escapeHtml(nama)},</p>` +
      `<p>Kami menerima permintaan untuk mengatur ulang password akun RESIK Admin Anda. ` +
      `Klik tombol di bawah (berlaku 30 menit):</p>` +
      `<p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#E8601C;color:#fff;` +
      `text-decoration:none;border-radius:8px;font-weight:bold">Atur Ulang Password</a></p>` +
      `<p>Jika Anda tidak merasa meminta ini, abaikan email ini. Password Anda tidak akan berubah.</p>` +
      `<p>Tim RESIK</p>`,
  });
};