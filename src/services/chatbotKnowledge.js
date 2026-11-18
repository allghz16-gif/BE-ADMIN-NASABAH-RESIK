const KNOWLEDGE_BASE = `
[PENGETAHUAN RESIK]
JADWAL KEGIATAN:
- Penyetoran / penimbangan: (ISI: hari & jam)
- Penjemputan sampah: (ISI: hari & wilayah)
- Kegiatan lain: (ISI)

CARA SETOR:
1. Pisahkan dan bersihkan sampah per jenis.
2. Buka menu Setor, pilih jenis sampah, isi berat, lalu unggah foto bukti timbangan.
3. Status awal "verifikasi". Setelah diverifikasi pengelola jadi "berhasil" dan saldo bertambah. Bisa juga "ditolak" disertai alasan.

CARA TARIK SALDO:
- Menu Tukar (e-wallet atau transfer bank). (ISI: minimal penarikan & biaya layanan)

PANDUAN MEMILAH:
- PET (kode 1): botol air mineral, jernih. Lepas tutup dan label, bilas.
- HDPE (kode 2): botol deterjen/susu, lebih tebal.
- Kertas/kardus: harus kering, tidak berminyak.
- Minyak jelantah: simpan dalam botol tertutup.
- (TAMBAHKAN jenis lain sesuai tabel jenis_sampah)
`;
module.exports = { KNOWLEDGE_BASE };