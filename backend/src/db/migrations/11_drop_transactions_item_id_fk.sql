-- ==============================================================================
-- 11_drop_transactions_item_id_fk.sql
-- FIELD OPS INVENTORY V2 - LEPAS FOREIGN KEY TRANSACTIONS.ITEM_ID
-- Menghilangkan constraint FK ke tabel items legacy agar transaksi item v2
-- tersimpan di MariaDB tanpa error foreign key constraint.
-- ==============================================================================

-- 1. Lepas foreign key fk_transactions_item jika ada
ALTER TABLE transactions DROP FOREIGN KEY fk_transactions_item;

-- 2. Ubah kolom item_id menjadi nullable VARCHAR(64) untuk fleksibilitas referensi v2
ALTER TABLE transactions MODIFY COLUMN item_id VARCHAR(64) NULL;

-- 3. Pastikan kolom snapshot selalu siap
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS nama_barang VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS sku VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS satuan VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS tipe_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS tipe_mutasi ENUM('MASUK', 'KELUAR') NULL;
