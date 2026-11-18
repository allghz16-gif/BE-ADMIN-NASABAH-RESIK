-- nasabah: kolom yang dikirim dari aplikasi mobile
ALTER TABLE nasabah
  MODIFY nik CHAR(16) NULL,
  MODIFY alamat TEXT NULL,
  ADD COLUMN jenis_tempat ENUM('Rumah Tangga', 'Sekolah', 'Kantor', 'Usaha') NOT NULL DEFAULT 'Rumah Tangga' AFTER kode_pos,
  ADD COLUMN rt VARCHAR(5) NULL AFTER jenis_tempat,
  ADD COLUMN rw VARCHAR(5) NULL AFTER rt,
  ADD COLUMN kelurahan VARCHAR(100) NULL AFTER rw,
  ADD COLUMN latitude DECIMAL(10,7) NULL AFTER kelurahan,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude,
  ADD UNIQUE KEY uq_nasabah_telepon (telepon);

-- users: nasabah boleh daftar tanpa email, dan satu nomor telepon satu akun per role
ALTER TABLE users
  MODIFY email VARCHAR(150) NULL,
  ADD UNIQUE KEY uq_users_telepon_role (telepon, role);