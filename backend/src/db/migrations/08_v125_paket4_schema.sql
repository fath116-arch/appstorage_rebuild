-- ==============================================================================
-- 08_v125_paket4_schema.sql
-- FIELD OPS INVENTORY V1.2.5 - PAKET 4: KATALOG & KONDISI ITEM
-- Skema Kategori Barang, Tipe Stok, Kondisi Item, dan Catatan Kondisi
-- ==============================================================================

-- 1. Penambahan Kategori Barang & Tipe Stok pada tabel `produk` (Skema v2)
ALTER TABLE produk 
  ADD COLUMN IF NOT EXISTS kategori_barang VARCHAR(40) NOT NULL DEFAULT 'Barang Habis Pakai',
  ADD COLUMN IF NOT EXISTS tipe_stok VARCHAR(40) NOT NULL DEFAULT 'unit';

-- 2. Penambahan Kategori Barang & Tipe Stok pada tabel `items` (Skema Legasi/Standard)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS kategori_barang VARCHAR(40) NOT NULL DEFAULT 'Barang Habis Pakai',
  ADD COLUMN IF NOT EXISTS tipe_stok VARCHAR(40) NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS kondisi VARCHAR(32) NOT NULL DEFAULT 'Baik',
  ADD COLUMN IF NOT EXISTS catatan_kondisi TEXT NULL;

-- 3. Penambahan Kondisi & Catatan Kondisi pada tabel `item` (Skema v2 Fisik Ber-ID)
ALTER TABLE item
  ADD COLUMN IF NOT EXISTS kondisi VARCHAR(32) NOT NULL DEFAULT 'Baik',
  ADD COLUMN IF NOT EXISTS catatan_kondisi TEXT NULL;

-- 4. Pengisian Nilai Default Data Lama (Idempotent)
UPDATE produk SET kategori_barang = 'Barang Habis Pakai' WHERE kategori_barang IS NULL OR kategori_barang = '';
UPDATE produk SET tipe_stok = 'unit' WHERE tipe_stok IS NULL OR tipe_stok = '';

UPDATE items SET kategori_barang = 'Barang Habis Pakai' WHERE kategori_barang IS NULL OR kategori_barang = '';
UPDATE items SET tipe_stok = 'unit' WHERE tipe_stok IS NULL OR tipe_stok = '';
UPDATE items SET kondisi = 'Baik' WHERE kondisi IS NULL OR kondisi = '';

UPDATE item SET kondisi = 'Baik' WHERE kondisi IS NULL OR kondisi = '';
