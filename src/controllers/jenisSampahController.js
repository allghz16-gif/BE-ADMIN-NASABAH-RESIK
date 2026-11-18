const JenisSampah = require('../models/jenisSampahModel');
const { success } = require('../utils/response');

exports.list = async (req, res) => success(res, await JenisSampah.listAktif());