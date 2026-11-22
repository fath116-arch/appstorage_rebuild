-- ==============================================================================
-- 12_unify_single_model_and_wib.sql
-- Unifikasi Model Data Tunggal, Actor vs Recorded-By, Request Lifecycle, & UTC
-- ==============================================================================

-- 1. Enrich TRANSAKSI as the single canonical audit & mutation ledger
ALTER TABLE transaksi
  ADD COLUMN IF NOT EXISTS actor_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS actor_nama VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS recorded_by_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS recorded_by_nama VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS is_on_behalf TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS on_behalf_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS occurred_at DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS recorded_at DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS correction_of_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS recipient_destination VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS qty_total INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipe_mutasi VARCHAR(16) NULL;

CREATE INDEX IF NOT EXISTS idx_transaksi_actor ON transaksi(actor_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_recorded_by ON transaksi(recorded_by_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_occurred_at ON transaksi(occurred_at);
CREATE INDEX IF NOT EXISTS idx_transaksi_request_id ON transaksi(request_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_correction_of ON transaksi(correction_of_id);

UPDATE transaksi
SET
  actor_id = COALESCE(actor_id, pelaku_id),
  recorded_by_id = COALESCE(recorded_by_id, pelaku_id),
  occurred_at = COALESCE(occurred_at, waktu),
  recorded_at = COALESCE(recorded_at, waktu);

-- 2. Produk classification columns (ensure present)
ALTER TABLE produk
  ADD COLUMN IF NOT EXISTS kategori_barang VARCHAR(64) NOT NULL DEFAULT 'Barang Habis Pakai',
  ADD COLUMN IF NOT EXISTS tipe_stok VARCHAR(32) NOT NULL DEFAULT 'unit';

-- 3. Item reservation tracking ('aktif', 'dipesan', 'keluar')
ALTER TABLE item
  ADD COLUMN IF NOT EXISTS kondisi VARCHAR(32) NOT NULL DEFAULT 'Baik',
  ADD COLUMN IF NOT EXISTS catatan_kondisi TEXT NULL,
  ADD COLUMN IF NOT EXISTS reserved_for_request_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS reserved_for_user_id VARCHAR(36) NULL;

CREATE INDEX IF NOT EXISTS idx_item_reserved_req ON item(reserved_for_request_id);

-- 4. Stok jumlah reserved quantity
ALTER TABLE stok_jumlah
  ADD COLUMN IF NOT EXISTS reserved_qty INT UNSIGNED NOT NULL DEFAULT 0;

-- 5. Expand Request lifecycle (diajukan/menunggu -> disetujui -> diambil -> dikembalikan | ditolak | dibatalkan)
ALTER TABLE request
  MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'diajukan';

ALTER TABLE request
  ADD COLUMN IF NOT EXISTS actor_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS recorded_by_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS taken_at DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS returned_at DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS returned_by_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS return_condition VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS return_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS return_box_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS allocated_item_ids TEXT NULL,
  ADD COLUMN IF NOT EXISTS transaction_out_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS transaction_in_id VARCHAR(64) NULL;

CREATE INDEX IF NOT EXISTS idx_request_actor ON request(actor_id);
CREATE INDEX IF NOT EXISTS idx_request_tx_out ON request(transaction_out_id);
