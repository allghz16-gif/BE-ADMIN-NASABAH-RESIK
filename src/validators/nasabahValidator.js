const { z } = require('zod');

const emptyToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);
// kolom opsional: string kosong dari form dianggap NULL
const nullable = (schema) => z.preprocess(emptyToNull, schema.nullable().optional());

const normalizeTelepon = (v) => {
  let s = v.replace(/[\s().-]/g, '');
  if (s.startsWith('+62')) s = '0' + s.slice(3);
  else if (s.startsWith('62')) s = '0' + s.slice(2);
  else if (s.startsWith('8')) s = '0' + s;
  return s;
};

const nama = z.string().trim().min(1, 'Nama lengkap wajib diisi').min(2, 'Nama minimal 2 karakter').max(100, 'Nama terlalu panjang');
const nik = z.string().trim().regex(/^\d{16}$/, 'NIK harus 16 digit angka');
const telepon = z
  .string()
  .trim()
  .min(1, 'Nomor telepon wajib diisi')
  .transform(normalizeTelepon)
  .refine((v) => /^0\d{9,13}$/.test(v), { message: 'Nomor telepon tidak valid' });
const alamat = z.string().trim().min(1, 'Alamat wajib diisi').min(5, 'Alamat minimal 5 karakter').max(500, 'Alamat terlalu panjang');

const email = z.string().trim().toLowerCase().email('Format email tidak valid').max(150, 'Email terlalu panjang');
const jenisKelamin = z.enum(['laki-laki', 'perempuan'], { message: 'Jenis kelamin tidak valid' });
const tanggalLahir = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir tidak valid')
  .refine(
    (v) => {
      const d = new Date(v);
      // cek bolak-balik supaya tanggal seperti 31 Februari ditolak
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && d <= new Date() && d.getUTCFullYear() >= 1900;
    },
    { message: 'Tanggal lahir tidak valid' }
  );
const kota = z.string().trim().max(100, 'Nama kota terlalu panjang');
const kecamatan = z.string().trim().max(100, 'Nama kecamatan terlalu panjang');
const kodePos = z.string().trim().regex(/^\d{5}$/, 'Kode pos harus 5 digit');
const catatan = z.string().trim().max(1000, 'Catatan terlalu panjang');
const status = z.enum(['aktif', 'nonaktif'], { message: 'Status harus aktif atau nonaktif' });

const optionalFields = {
  email: nullable(email),
  jenis_kelamin: nullable(jenisKelamin),
  tanggal_lahir: nullable(tanggalLahir),
  kota: nullable(kota),
  kecamatan: nullable(kecamatan),
  kode_pos: nullable(kodePos),
  catatan: nullable(catatan),
  status: status.optional(),
};

exports.createNasabahSchema = z.object({ nama, nik, telepon, alamat, ...optionalFields });

// update parsial: hanya field yang dikirim yang diubah
exports.updateNasabahSchema = z.object({
  nama: nama.optional(),
  nik: nik.optional(),
  telepon: telepon.optional(),
  alamat: alamat.optional(),
  ...optionalFields,
});

exports.statusSchema = z.object({ status });

const kosongAtauSemua = (v) => (v === '' || v === 'semua' ? undefined : v);

exports.listQuerySchema = z.object({
  search: z.preprocess(kosongAtauSemua, z.string().trim().max(100, 'Kata kunci terlalu panjang').optional()),
  status: z.preprocess(kosongAtauSemua, z.enum(['aktif', 'nonaktif']).optional()),
  // periode dalam hari, berdasarkan tanggal bergabung
  periode: z.preprocess(kosongAtauSemua, z.enum(['7', '30', '90', '365']).transform(Number).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});