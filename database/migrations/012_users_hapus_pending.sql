-- registrasi dihapus: tidak ada lagi akun berstatus pending
UPDATE users SET status = 'nonaktif' WHERE status = 'pending';

ALTER TABLE users
  MODIFY status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif';