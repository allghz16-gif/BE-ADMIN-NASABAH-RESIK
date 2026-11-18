const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('Format email tidak valid');

// bcrypt hanya membaca 72 byte pertama, jadi dibatasi
const password = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(72, 'Password maksimal 72 karakter')
  .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
  .regex(/[0-9]/, 'Password harus mengandung angka');

exports.loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password wajib diisi'),
  remember: z.boolean().optional().default(false),
});

exports.forgotSchema = z.object({ email });

exports.resetSchema = z
  .object({
    token: z.string().min(1, 'Token tidak valid').max(200, 'Token tidak valid'),
    password,
    konfirmasi_password: z.string(),
  })
  .refine((d) => d.password === d.konfirmasi_password, {
    message: 'Konfirmasi password tidak sama',
    path: ['konfirmasi_password'],
  });