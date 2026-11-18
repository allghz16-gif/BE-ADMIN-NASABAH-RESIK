CREATE TABLE transaksi_saldo (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nasabah_id INT UNSIGNED NOT NULL,
  setoran_id INT UNSIGNED NULL,
  tipe ENUM('setoran', 'penarikan', 'penukaran', 'koreksi') NOT NULL,
  jumlah DECIMAL(15,2) NOT NULL DEFAULT 0,
  poin INT NOT NULL DEFAULT 0,
  saldo_setelah DECIMAL(15,2) NOT NULL,
  keterangan VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trx_nasabah (nasabah_id, created_at),
  CONSTRAINT fk_trx_nasabah FOREIGN KEY (nasabah_id) REFERENCES nasabah(id),
  CONSTRAINT fk_trx_setoran FOREIGN KEY (setoran_id) REFERENCES setoran(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;