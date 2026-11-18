const fs = require('fs');

// source: 'body' (default) atau 'query'
module.exports = (schema, source = 'body') => (req, res, next) => {
  const input = source === 'query' ? req.query : req.body ?? {};
  const result = schema.safeParse(input);

  if (!result.success) {
    if (req.file) fs.unlink(req.file.path, () => {}); // buang file yang sudah terlanjur terupload

    const errors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!errors[key]) errors[key] = issue.message;
    }
    return res.status(422).json({ success: false, message: 'Data tidak valid', errors });
  }

  // di Express 5, req.query tidak bisa ditimpa, jadi hasilnya disimpan di properti lain
  if (source === 'query') req.validatedQuery = result.data;
  else req.body = result.data;
  next();
};