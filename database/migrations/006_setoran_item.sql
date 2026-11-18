-- harga dan poin per kg disalin saat setoran dibuat, supaya perubahan harga nanti tidak mengubah riwayat
CREATE TABLE setoran_item (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setoran_id INT UNSIGNED NOT NULL,
  jenis_sampah_id INT UNSIGNED NOT NULL,
  berat DECIMAL(10,2) NOT NULL,
  harga_per_kg DECIMAL(12,2) NOT NULL,
  poin_per_kg INT UNSIGNED NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  poin INT UNSIGNED NOT NULL,
  KEY idx_item_setoran (setoran_id),
  CONSTRAINT fk_item_setoran FOREIGN KEY (setoran_id) REFERENCES setoran(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_jenis FOREIGN KEY (jenis_sampah_id) REFERENCES jenis_sampah(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;