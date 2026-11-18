module.exports = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Format JSON tidak valid' });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Data sudah ada (duplikat)' });
  }

  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Terjadi kesalahan server' : err.message,
  });
};