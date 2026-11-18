CREATE TABLE jenis_sampah (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(50) NOT NULL,
  harga_per_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
  poin_per_kg INT UNSIGNED NOT NULL DEFAULT 0,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_jenis_sampah_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data awal. Harga plastik (Rp 3.000/kg) dan poin plastik, kardus, minyak jelantah
-- diambil dari desain. Sisanya PLACEHOLDER, ganti sesuai harga sebenarnya.
INSERT INTO jenis_sampah (nama, harga_per_kg, poin_per_kg) VALUES
  ('Plastik',        3000, 100),
  ('Kardus',         1500, 100),
  ('Kertas',         1000, 100),
  ('Minyak Jelantah', 5000, 400),
  ('Logam',          4000, 150),
  ('Kaca',            500,  25);