-- ==============================================================================
-- 13_purchase_wa4_and_report_config.sql
-- FieldOps IT:
-- 1. Dukungan Request Pengajuan Pembelian Barang (request_type = 'beli')
-- 2. Batas 4 Slot Nomor Penerima WhatsApp dengan Saklar ON/OFF per Nomor
-- 3. Konfigurasi Default Kop & Penandatangan Lembar Pengesahan Laporan
-- ==============================================================================

-- 1. Perbolehkan request.tipe_id NULL untuk pengajuan pembelian barang baru (non-katalog)
ALTER TABLE request
  MODIFY COLUMN tipe_id INT UNSIGNED NULL;

-- 2. Kolom request_type & metadata pengajuan pembelian
ALTER TABLE request
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(32) NOT NULL DEFAULT 'ambil',
  ADD COLUMN IF NOT EXISTS purchase_item_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS purchase_estimated_price BIGINT UNSIGNED NULL;

CREATE INDEX IF NOT EXISTS idx_request_type ON request(request_type);

-- Backfill request_type pengembalian yang sudah ada
UPDATE request
SET request_type = 'kembalikan'
WHERE transaction_out_id LIKE 'req-%'
  AND return_condition IS NOT NULL
  AND (request_type IS NULL OR request_type = 'ambil');

-- 3. Kolom 4-slot penerima WhatsApp (ON/OFF per slot) pada wa_config
ALTER TABLE wa_config
  ADD COLUMN IF NOT EXISTS recipient_slots_json TEXT NULL;

-- 4. Seed konfigurasi default Lembar Pengesahan Laporan
INSERT IGNORE INTO pengaturan (kunci, nilai, keterangan) VALUES (
  'REPORT_APPROVAL_CONFIG',
  '{"companyName":"PT. SOLUSI INFORMATIKA LAPANGAN","divisionName":"Divisi Operasional & Manajemen Infrastruktur IT Lapangan","companyAddress":"Gedung Pusat Operasi IT · Jl. Sudirman Kav. 45, Jakarta Pusat · Telp: (021) 555-0199 · info@fieldops.id","signers":[{"roleLabel":"Dibuat Oleh (Admin Logistik)","name":"Admin Logistik IT","title":"Admin Inventori & Logistik IT","useCurrentUser":true},{"roleLabel":"Diverifikasi (Teknisi Lapangan)","name":"Lead Field Technician","title":"Lead Field Technician","useCurrentUser":false},{"roleLabel":"Disetujui Oleh (Supervisor IT)","name":"Supervisor IT Infrastructure","title":"Supervisor IT Infrastructure","useCurrentUser":false}]}',
  'Konfigurasi Kop Surat dan Penandatangan Lembar Pengesahan Laporan Stok'
);
