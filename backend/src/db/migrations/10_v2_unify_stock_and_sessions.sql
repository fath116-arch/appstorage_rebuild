-- ==============================================================================
-- 10_v2_unify_stock_and_sessions.sql
-- FIELD OPS INVENTORY V2 - FIX STOCK I/O, UNIFIKASI KATALOG & SESI 30 HARI
-- Penambahan Kolom Snapshot Mutasi, Relaksasi FK Legacy, dan Konfigurasi Sesi 30 Hari
-- ==============================================================================

-- 1. Penambahan Kolom Snapshot Transaksi untuk Riwayat Independen
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS nama_barang VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS sku VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS satuan VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS tipe_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS tipe_mutasi ENUM('MASUK', 'KELUAR') NULL;

-- Index untuk pencarian cepat berbasis tipe_id
CREATE INDEX IF NOT EXISTS idx_transactions_tipe_id ON transactions(tipe_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tipe_mutasi ON transactions(tipe_mutasi);

-- 2. Update Pengaturan Sesi 30 Hari & Multi-Perangkat (Tanpa Logout Paksa)
UPDATE pengaturan SET nilai = '2592000' WHERE kunci = 'ACCESS_TOKEN_TTL_DETIK';
UPDATE pengaturan SET nilai = '43200' WHERE kunci = 'IDLE_TIMEOUT_MENIT';
UPDATE pengaturan SET nilai = '720' WHERE kunci = 'ABSOLUTE_TIMEOUT_JAM';
UPDATE pengaturan SET nilai = '50' WHERE kunci = 'MAX_SESI_PER_AKUN';

INSERT IGNORE INTO pengaturan (kunci, nilai, keterangan) VALUES
('ACCESS_TOKEN_TTL_DETIK', '2592000', 'Masa berlaku access token (30 hari)'),
('IDLE_TIMEOUT_MENIT', '43200', 'Sesi mati bila tidak ada aktivitas (30 hari)'),
('ABSOLUTE_TIMEOUT_JAM', '720', 'Sesi mati mutlak setelah 30 hari'),
('MAX_SESI_PER_AKUN', '50', 'Batas sesi aktif per akun (multi-perangkat diizinkan)');
