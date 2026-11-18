const fs = require('fs');
const path = require('path');
const Nasabah = require('../models/nasabahModel');
const { success, fail } = require('../utils/response');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const FOTO_FOLDER = 'foto-nasabah';

const removeFile = (relPath) => {
  if (relPath) fs.unlink(path.join(UPLOAD_DIR, relPath), () => {});
};

// Menerima id angka (10) atau kode (NSB-0010) dan selalu mengembalikan id angka,
// atau null kalau tidak valid
const parseIdentifier = (raw) => {
  const match = String(raw ?? '').trim().match(/^(?:nsb-)?0*(\d+)$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const withFotoUrl = (n) => ({ ...n, foto_url: n.foto ? `/uploads/${n.foto}` : null });

// NIK / email / telepon kembar -> pesan per kolom
const duplicateResponse = (err, res) => {
  if (err.code !== 'ER_DUP_ENTRY') return null;
  const msg = err.sqlMessage || '';
  if (msg.includes('uq_nasabah_nik')) {
    return fail(res, 'NIK sudah terdaftar', 409, { nik: 'NIK sudah terdaftar' });
  }
  if (msg.includes('uq_nasabah_email')) {
    return fail(res, 'Email sudah terdaftar', 409, { email: 'Email sudah terdaftar' });
  }
  if (msg.includes('uq_nasabah_telepon')) {
    return fail(res, 'Nomor telepon sudah terdaftar', 409, { telepon: 'Nomor telepon sudah terdaftar' });
  }
  return fail(res, 'Data sudah ada (duplikat)', 409);
};

exports.list = async (req, res) => {
  const { items, total } = await Nasabah.findAll(req.validatedQuery);
  const { page, limit } = req.validatedQuery;

  return success(res, {
    items: items.map(withFotoUrl),
    meta: { total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) },
  });
};

exports.stats = async (req, res) => success(res, await Nasabah.stats());

exports.detail = async (req, res) => {
  const id = parseIdentifier(req.params.id);
  const nasabah = id ? await Nasabah.findById(id) : null;
  if (!nasabah) return fail(res, 'Nasabah tidak ditemukan', 404);

  return success(res, withFotoUrl(nasabah));
};

exports.create = async (req, res) => {
  const foto = req.file ? `${FOTO_FOLDER}/${req.file.filename}` : null;

  try {
    const id = await Nasabah.create({ ...req.body, foto });
    const nasabah = await Nasabah.findById(id);
    return success(res, withFotoUrl(nasabah), 'Nasabah berhasil ditambahkan', 201);
  } catch (err) {
    removeFile(foto); // gagal simpan: buang foto yang sudah terupload
    const dup = duplicateResponse(err, res);
    if (dup) return dup;
    throw err;
  }
};

exports.update = async (req, res) => {
  const newFoto = req.file ? `${FOTO_FOLDER}/${req.file.filename}` : undefined;

  const id = parseIdentifier(req.params.id);
  const current = id ? await Nasabah.findById(id) : null;
  if (!current) {
    removeFile(newFoto);
    return fail(res, 'Nasabah tidak ditemukan', 404);
  }

  const data = { ...req.body, ...(newFoto && { foto: newFoto }) };
  if (!Object.values(data).some((v) => v !== undefined)) {
    return fail(res, 'Tidak ada data yang diubah', 400);
  }

  try {
    await Nasabah.update(current.id, data); // pakai id asli dari data yang ditemukan
  } catch (err) {
    removeFile(newFoto);
    const dup = duplicateResponse(err, res);
    if (dup) return dup;
    throw err;
  }

  if (newFoto) removeFile(current.foto); // foto lama dihapus setelah yang baru berhasil tersimpan

  return success(res, withFotoUrl(await Nasabah.findById(current.id)), 'Data nasabah diperbarui');
};

exports.updateStatus = async (req, res) => {
  const id = parseIdentifier(req.params.id);
  const current = id ? await Nasabah.findById(id) : null;
  if (!current) return fail(res, 'Nasabah tidak ditemukan', 404);

  await Nasabah.update(current.id, { status: req.body.status });

  const msg = req.body.status === 'aktif' ? 'Nasabah diaktifkan' : 'Nasabah dinonaktifkan';
  return success(res, withFotoUrl(await Nasabah.findById(current.id)), msg);
};