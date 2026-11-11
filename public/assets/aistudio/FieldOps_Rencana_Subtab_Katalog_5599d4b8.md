# Rencana Sub-tab Menu Katalog FieldOps

Layout yang ada dipertahankan. Shopee hanya jadi contoh pola jelajah di tab Kategori.
Urutan pengerjaan berdasarkan pembacaan kode v1.2.5.3 (belum dijalankan atau diuji). Langkah 1 sampai 3 sebaiknya dicek di MariaDB sungguhan.

## 1. Struktur Sub-tab

| Sub-tab | Isi | Siapa yang melihat | Aksi tulis | Tab bawaan |
|---|---|---|---|---|
| **Produk** | Layout sekarang (cari, filter, daftar produk dengan varian, tombol Buat Produk dan Input Stok Kamera/Massal). Ditambah kartu ringkasan klik-filter di atas: Semua, Aman, Menipis, Habis. | Semua role | Developer, admin, admin gudang | Admin gudang |
| **Kategori** | Halaman jelajah: deretan kategori dengan jumlah produk dan total varian. Klik kategori untuk melihat produk di dalamnya, memakai baris produk yang sama dengan tab Produk. | Semua role | Tidak ada (hanya jelajah dan Pakai untuk Tiket) | Teknisi |
| **Storage Box** | Daftar box dan isinya, seperti sekarang. | Semua role | Developer, admin, admin gudang (teknisi hanya baca) | - |
| **Kelola** | Atribut, aturan ID varian, arsip/restore. Kotak Sampah dan Restore Data juga cocok pindah ke sini. | Developer, admin, admin gudang (disembunyikan untuk teknisi) | Developer, admin, admin gudang | - |

## 2. Poin yang Perlu Diputuskan

| No | Poin | Usulan | Status |
|---|---|---|---|
| 1 | Istilah Kategori vs Jenis | Pilih satu istilah. Karena sub-tab bernama Kategori, ganti "Jenis" menjadi "Kategori" di semua tempat, termasuk "Kelola Jenis & Atribut" menjadi "Kelola Atribut" di tab Kelola. | [ ] Belum diputuskan |
| 2 | Aturan status Aman / Menipis / Habis | Kartu ringkasan menghitung produk, tetapi status sebaiknya per varian. Contoh: produk "Habis" hanya bila semua variannya habis; "Menipis" bila ada varian di bawah ambang. Ambang mengambil dari pengaturan WA Alert (tipe > produk > global) agar angka sama dengan peringatan yang terkirim. | [ ] Belum diputuskan |
| 3 | Komponen tab Kategori | Satu komponen yang memanggil data produk yang sama dengan tab Produk, difilter per kategori. Tidak ada data kedua yang bisa tidak cocok. | [ ] Belum diputuskan |
| 4 | Tab bawaan per role | Teknisi masuk ke Kategori (jelajah lalu Pakai untuk Tiket); admin gudang ke Produk. | [ ] Belum diputuskan |

## 3. Urutan Pengerjaan (data dulu, baru tampilan)

### Langkah 1: Satu fungsi pencatat transaksi
- **Pekerjaan:** Buat satu fungsi pencatat transaksi yang mengisi semua kolom snapshot (`nama_barang`, `sku`, `satuan`, `tipe_id`, `tipe_mutasi`). Ganti semua `INSERT INTO transactions` di jalur stok.
- **File terkait:** `backend/src/services/stockService.ts` (6 INSERT), `backend/src/routes/ticketIntegration.ts`
- **Kriteria selesai:** Riwayat Masuk/Keluar menampilkan nama barang dan SKU yang benar untuk input kamera, massal, dan tiket.
- [ ] Selesai

### Langkah 2: Lepas foreign key
- **Pekerjaan:** Lepas foreign key `transactions.item_id` ke `items` lewat migrasi baru (jangan ubah migrasi 10).
- **File terkait:** `backend/src/db/migrations` (migrasi baru), `02_inventory_schema.sql`
- **Kriteria selesai:** Transaksi dari item v2 tersimpan di MariaDB tanpa error foreign key.
- [ ] Selesai

### Langkah 3: Migrasi data lama
- **Pekerjaan:** Migrasikan isi tabel `items` lama ke struktur v2, lalu jadikan `items` hanya-baca.
- **File terkait:** `backend/src/services/legacyMigrationService.ts`
- **Kriteria selesai:** Semua barang lama muncul di struktur v2; tidak ada penulisan baru ke `items`.
- [ ] Selesai

### Langkah 4: Satukan API baca
- **Pekerjaan:** Satu endpoint daftar produk beserta varian, stok, dan status.
- **File terkait:** `backend/src/routes/catalog.ts`, `backend/src/services/catalogService.ts`
- **Kriteria selesai:** Tab Produk dan Kategori membaca dari endpoint yang sama.
- [ ] Selesai

### Langkah 5: Perbaiki hitungan chip kategori
- **Pekerjaan:** Samakan field yang dipakai (`categoryId` vs `category_id` tidak konsisten).
- **File terkait:** `frontend/src/components/catalog/CatalogToolbar.tsx`, `frontend/src/components/InventoryCatalog.tsx`
- **Kriteria selesai:** Angka chip sama dengan isi daftar saat difilter.
- [ ] Selesai

### Langkah 6: Bangun sub-tab baru
- **Pekerjaan:** Bangun sub-tab Produk, Kategori, Storage Box, Kelola. Hapus sub-tab "Inventori Stok Fisik" dan satukan jalur Buat Produk.
- **File terkait:** `frontend/src/components/InventoryCatalog.tsx`, `frontend/src/components/catalog/CatalogV2Manager.tsx`
- **Kriteria selesai:** Hanya satu tombol Buat Produk; tab sesuai role; teknisi tidak melihat Kelola.
- [ ] Selesai

### Langkah 7: Pecah CatalogV2Manager
- **Pekerjaan:** Pecah `CatalogV2Manager.tsx` (sekitar 110 KB) menjadi komponen kecil, bertahap.
- **File terkait:** `frontend/src/components/catalog/CatalogV2Manager.tsx`
- **Kriteria selesai:** Tidak ada file komponen yang membengkak; test lama tetap lulus.
- [ ] Selesai

### Langkah 8: Masuk/Keluar menjadi riwayat
- **Pekerjaan:** Jadikan Masuk/Keluar sebagai riwayat saja. Input masuk/keluar dilakukan dari kartu barang dan alur barang masuk (termasuk kamera/massal).
- **File terkait:** `frontend/src/components/TransactionHistory.tsx`, `frontend/src/components/StockInOutModal.tsx`
- **Kriteria selesai:** Setiap aksi stok menulis satu baris riwayat; tidak ada tiga pintu input terpisah.
- [ ] Selesai

### Langkah 9: Rapikan versi
- **Pekerjaan:** Versi masih tertulis 1.1.0 padahal paketnya v1.2.5.3.
- **File terkait:** `frontend/src/constants/version.ts`, `frontend/src/context/InventoryContext.tsx`
- **Kriteria selesai:** Versi di footer sama dengan versi paket.
- [ ] Selesai
