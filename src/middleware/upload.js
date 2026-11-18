const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const MAX_SIZE = 2 * 1024 * 1024; // batas bawaan 2MB
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png' };

const httpError = (message, status) => Object.assign(new Error(message), { status });

// cek tanda tangan file (magic bytes), bukan cuma percaya pada mimetype dari klien
const isRealImage = (filePath, mimetype) => {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);

  if (mimetype === 'image/png') {
    return buf.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimetype === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  return false;
};

// pemakaian:
//   uploadImage('foto-nasabah')                                      -> maks 2MB
//   uploadImage('bukti-timbangan', 'bukti', { maxSize: null })       -> tanpa batas ukuran
exports.uploadImage = (folder, field = 'foto', { maxSize = MAX_SIZE } = {}) => {
  const dir = path.join(__dirname, '..', '..', 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) =>
        cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype]),
    }),
    limits: maxSize ? { fileSize: maxSize, files: 1 } : { files: 1 },
    fileFilter: (req, file, cb) => {
      if (!EXT[file.mimetype]) {
        return cb(httpError('Foto harus berformat PNG, JPG, atau JPEG', 400));
      }
      cb(null, true);
    },
  }).single(field);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(httpError(`Ukuran foto maksimal ${Math.round(maxSize / 1024 / 1024)}MB`, 413));
        }
        return next(err.status ? err : httpError('Upload foto gagal', 400));
      }
      if (req.file && !isRealImage(req.file.path, req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return next(httpError('File bukan gambar yang valid', 400));
      }
      next();
    });
  };
};