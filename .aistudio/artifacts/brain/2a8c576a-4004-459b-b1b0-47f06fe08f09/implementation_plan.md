# Rencana Restrukturisasi Sub-tab Katalog FieldOps IT

Rencana arsitektur dan eksekusi komprehensif untuk menyatukan layer data transaksi, migrasi skema, penyelarasan istilah Kategori, agregasi status stok berjenjang WhatsApp Alert, restrukturisasi antarmuka sub-tab Katalog (**Produk**, **Kategori**, **Storage Box**, dan **Kelola**), serta pembersihan file-file usang/redundan yang tidak lagi diperlukan.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh keputusan penting telah diselaraskan melalui sesi klarifikasi dan disepakati sebagai berikut:

- **Istilah Seragam**: Istilah **"Jenis" distandarisasi menjadi "Kategori"** di seluruh menu aplikasi dan skema tampilan (termasuk "Kelola Jenis & Atribut" menjadi "Kelola Atribut & Kategori" di sub-tab Kelola).
- **Aturan Status Stok Kartu Ringkasan (Aman / Menipis / Habis)**: Agregasi status pada tingkat produk dihitung berdasarkan evaluasi varian berjenjang yang selaras dengan ambang **WhatsApp Alert** (`tipe > produk > global`):
  - **Habis**: Jika seluruh varian dari produk tersebut memiliki stok 0.
  - **Menipis**: Jika ada minimal satu varian dengan stok $\le$ ambang batas alert khusus varian/produk/global.
  - **Aman**: Jika seluruh varian memiliki stok di atas ambang batas masing-masing.
- **Sub-tab Bawaan Berbasis Peran (Role-Based Default)**:
  - Role **Teknisi** (`technician`) otomatis masuk ke sub-tab **Kategori** (pola jelajah visual ramah sentuhan, tanpa tombol aksi tulis, fokus siap pakai untuk tiket).
  - Role **Admin Gudang** (`warehouse_admin`), **Admin**, dan **Developer** otomatis masuk ke sub-tab **Produk**.
  - Sub-tab **Kelola** disembunyikan sepenuhnya dari Teknisi.
- **Pembersihan File Usang (Baru)**: Melakukan audit menyeluruh terhadap file-file mati, duplikat panduan lama di `public/assets/aistudio/`, serta komponen frontend yang sudah tidak diimpor setelah unifikasi sub-tab, dengan verifikasi dependensi sebelum penghapusan.
- **Urutan Pengerjaan**: Mengikuti prinsip *data & backend integrity first*, kemudian API unifikasi, dilanjutkan perombakan antarmuka visual, modularisasi komponen, sinkronisasi versi, dan diakhiri pembersihan file usang.

---

## 1. Overview & Core Concept

- **Apa yang Dibangun**:
  Restrukturisasi penuh modul Katalog Barang IT menjadi 4 sub-tab fungsional yang terdefinisi dengan jelas:
  1. **Produk**: Tampilan operasional utama dengan bilah pencarian, filter status klik-kartu (**Semua**, **Aman**, **Menipis**, **Habis**), daftar produk & varian lengkap, serta tombol operasional cepat (*Buat Produk*, *Input Stok Kamera/Massal*).
  2. **Kategori**: Halaman jelajah visual (pola kartu kategori dengan jumlah produk dan varian). Mengklik kategori akan menampilkan produk di dalamnya menggunakan baris produk yang konsisten dengan tab Produk.
  3. **Storage Box**: Manajemen alokasi box/rak penyimpanan fisik beserta isinya.
  4. **Kelola**: Pusat kendali inventori (pengaturan atribut, aturan prefix/pola ID varian, arsip produk, serta integrasi pemulihan Kotak Sampah & Restore Data).
- **Target Pengguna**:
  - **Teknisi Lapangan**: Mengakses tab Kategori secara cepat untuk melihat stok dan memasangkan suku cadang ke tiket pekerjaan lapangan.
  - **Admin Gudang & Admin Operasional**: Mengelola mutasi barang masuk/keluar, input kamera/massal, serta memantau produk menipis/habis.
  - **Developer**: Akses menyeluruh ke aturan skema, pemulihan data, konfigurasi sistem, dan kebersihan repositori.
- **Nilai Utama**: Menghilangkan duplikasi jalur data lama (`items` legacy vs `v2 catalog`), menjamin keutuhan snapshot transaksi audit, merapikan navigasi katalog tanpa tombol bertumpuk, dan menjaga repositori tetap ramping bebas file sampah/mati.

---

## 2. User Experience & Visual Design

### A. Pola Alur Pengguna (User Flows)
```
[Navigasi Utama: Menu Katalog]
           │
           ├───────────────────────────────┬───────────────────────────────┐
           ▼                               ▼                               ▼
    [Role: Teknisi]             [Role: Admin Gudang]            [Role: Admin / Dev]
           │                               │                               │
    Default Sub-tab:                Default Sub-tab:                Default Sub-tab:
     📂 KATEGORI                      📦 PRODUK                       📦 PRODUK
           │                               │                               │
           ▼                               ▼                               ▼
  • Kartu Kategori Grid           • Summary Cards (Ambil Filter)  • Akses Penuh Termasuk
  • Klik Kategori -> Tampil       • Input Kamera / Massal           Sub-tab ⚙️ KELOLA
    Baris Produk Terkait          • Riwayat & Detail Varian         (Atribut, Pola SN,
  • Aksi: Pakai untuk Tiket       • Buat Produk Baru                Sampah, Restore)
```

### B. Desain Kartu Ringkasan (Summary Cards)
Pada bagian atas sub-tab **Produk**, terdapat 4 kartu ringkasan filter status interaktif:
1. **Semua Produk**: Total seluruh produk terdaftar dengan jumlah total varian aktif.
2. **Aman**: Produk dengan seluruh varian berada di atas ambang peringatan (aksen netral slate / quiet emerald).
3. **Menipis**: Produk yang memiliki minimal satu varian mendekati/di bawah ambang batas (aksen peringatan amber lembut).
4. **Habis**: Produk yang seluruh variannya memiliki stok 0 (aksen crimson terukur).
*Mengklik salah satu kartu ringkasan langsung menerapkan filter pada daftar produk di bawahnya.*

### C. Disiplin Desain (Anti-AI Slop & Zero-Pill)
- Mematuhi aturan `TEMA_DAN_DESAIN.md` dan `AGENTS.md`.
- Label status dan jumlah disajikan dengan tipografi bersih (`font-mono tabular-nums`), bukan pill badge bertumpuk.
- Mode gelap menggunakan latar `bg-slate-900` / `bg-slate-950` dan kontras WCAG AA yang konsisten pada seluruh subkomponen.

---

## 3. Tahapan Pengerjaan Rinci (10 Langkah Berurutan)

### Langkah 1: Satu Fungsi Pencatat Transaksi Terpadu (`recordStockTransaction`)
- **Masalah**: Jalur mutasi stok saat ini (`stockService.ts` dan `ticketIntegration.ts`) memiliki beberapa query `INSERT INTO transactions` terpisah yang rawan kehilangan kolom snapshot (`nama_barang`, `sku`, `satuan`, `tipe_id`, `tipe_mutasi`).
- **Solusi**:
  - Buat helper method atomik `recordStockTransaction()` di `transactionService.ts` / `stockService.ts`.
  - Mengisi lengkap snapshot transaksi: `id`, `tipe_mutasi`, `nama_barang`, `sku`, `satuan`, `tipe_id`, `item_id`, `quantity`, `previous_qty`, `new_qty`, `reference_type`, `reference_number`, `recipient_destination`, `user_id`, `performed_by`, `notes`.
  - Ganti seluruh 6 pemanggilan `INSERT INTO transactions` di `stockService.ts` dan integrasi tiket agar menggunakan satu fungsi ini.
- **Kriteria Keberhasilan**: Riwayat Masuk/Keluar menampilkan nama barang dan SKU dengan presisi pada mutasi kamera, mutasi massal, dan auto-deduct tiket.

### Langkah 2: Migrasi Pelepasan Foreign Key `transactions.item_id`
- **Masalah**: Tabel `transactions` lama memiliki foreign key constraint `transactions_ibfk_1` atau sejenisnya ke tabel legacy `items(id)`. Pada varian v2 yang berelasi ke `tipe(id)`, penyimpanan transaksi di MariaDB dapat gagal akibat foreign key constraint.
- **Solusi**:
  - Buat file migrasi baru `backend/src/db/migrations/11_drop_transactions_item_id_fk.sql` (tanpa menyentuh migrasi 10).
  - Skrip migrasi memeriksa dan melepaskan foreign key pada `transactions.item_id`, serta mengubah kolom `item_id` menjadi `VARCHAR(64) NULL` agar mendukung ID legacy maupun snapshot ID v2.
  - Perbarui migrasi runner dan `database.ts` memory fallback.
- **Kriteria Keberhasilan**: Seluruh mutasi v2 tersimpan mulus di MariaDB maupun in-memory engine tanpa pelanggaran foreign key.

### Langkah 3: Migrasi Data Lama & Lock Tabel `items` Legacy
- **Masalah**: Masih ada sisa barang di tabel `items` lama yang belum terindeks penuh ke struktur katalog v2 (`kategori`/`jenis`, `produk`, `tipe`, `stok_jumlah`).
- **Solusi**:
  - Jalankan migrasi menyeluruh di `legacyMigrationService.ts` yang memetakan:
    - Kategori legacy $\rightarrow$ Kategori v2.
    - Item legacy $\rightarrow$ Produk & Varian Tipe v2.
    - Stok legacy $\rightarrow$ Tabel `stok_jumlah` v2.
  - Nonaktifkan rute penulisan baru (`POST /api/inventory/items`) atau arahkan ke API katalog v2 sehingga data inventori hanya memiliki satu sumber kebenaran (*single source of truth*).
- **Kriteria Keberhasilan**: Seluruh barang lama tampil di katalog v2; tidak ada penulisan data baru yang terpecah ke tabel lama.

### Langkah 4: Unifikasi API Baca Katalog (`/api/catalog/products-v2`)
- **Masalah**: Tab Produk dan komponen terkait memanggil endpoint yang berbeda sehingga berpotensi menghasilkan selisih data stok atau filter.
- **Solusi**:
  - Sempurnakan endpoint tunggal `GET /api/catalog/products-v2` di `backend/src/routes/catalog.ts` dan `backend/src/services/catalogService.ts`.
  - Response memuat:
    - Metadata produk dan kategori.
    - Daftar varian tipe beserta atribut terurai.
    - Stok terkini dari `stok_jumlah` dan lokasi box.
    - Ambang batas khusus WhatsApp Alert per varian / produk / default global.
    - Status stok terhitung (`aman` / `menipis` / `habis`) per varian dan agregasi produk.
- **Kriteria Keberhasilan**: Baik sub-tab Produk maupun sub-tab Kategori membaca dari payload endpoint yang persis sama.

### Langkah 5: Penyelarasan Hitungan Chip Kategori & Normalisasi Penamaan
- **Masalah**: Inkonsistensi penggunaan nama field (`categoryId` vs `category_id` vs `jenis_id`) menyebabkan jumlah barang pada chip kategori tidak akurat saat difilter.
- **Solusi**:
  - Standarisasikan model data frontend di `frontend/src/types/` dan komponen `CatalogToolbar.tsx`.
  - Ubah label "Jenis" menjadi "Kategori" di antarmuka pengguna.
  - Pastikan perhitungan jumlah produk dan varian pada chip kategori mengambil data dari daftar produk terpadu.
- **Kriteria Keberhasilan**: Angka pada chip kategori selalu identik dengan jumlah baris yang tampil saat filter diterapkan.

### Langkah 6: Pembangunan Arsitektur 4 Sub-tab Baru
- **Pekerjaan**:
  - Restrukturisasi `InventoryCatalog.tsx` untuk mengelola 4 sub-tab:
    1. `produk` (default untuk Admin/Gudang/Dev)
    2. `kategori` (default untuk Teknisi)
    3. `boxes` (Storage Box)
    4. `kelola` (Khusus Admin/Gudang/Dev: Atribut, Pola SN, Sampah, Restore)
  - Hapus tab redundant "Inventori Stok Fisik".
  - Sederhanakan tombol aksi utama: hanya ada 1 pintu "Buat Produk" dan 1 pintu "Input Stok (Kamera / Massal)".
  - Role Teknisi disembunyikan dari akses sub-tab Kelola dan tombol-tombol aksi modifikasi.
- **Kriteria Keberhasilan**: Navigasi bersih, role switcher langsung menyesuaikan sub-tab aktif, dan tidak ada elemen tombol yang tumpang tindih.

### Langkah 7: Pemecahan & Modularisasi `CatalogV2Manager.tsx`
- **Masalah**: `CatalogV2Manager.tsx` berukuran sangat besar (~110 KB), menyulitkan pemeliharaan dan pengujian.
- **Solusi**:
  - Pecah secara modular ke dalam subdirektori `frontend/src/components/catalog/`:
    - `CatalogProductsTab.tsx`: Menampung kartu ringkasan, toolbar pencarian, dan daftar produk/varian.
    - `CatalogBrowseCategoriesTab.tsx`: Menampung tampilan jelajah kategori ala Shopee (grid kategori dengan total produk & varian).
    - `CatalogManageTab.tsx`: Menampung pengelolaan atribut, pola nomor seri, arsip, dan integrasi sampah/restore.
    - `CatalogSummaryCards.tsx`: Komponen kartu filter Semua, Aman, Menipis, Habis.
  - Memastikan seluruh fungsi CRUD, modal pembuatan varian, dan input kamera tetap bekerja tanpa regresi.
- **Kriteria Keberhasilan**: Ukuran file terpecah rapi, maintainable, dan seluruh alur interaktif lulus uji build & lint.

### Langkah 8: Refaktor Masuk/Keluar Menjadi Riwayat Audit Murni
- **Pekerjaan**:
  - Jadikan tab/halaman Masuk/Keluar (`TransactionHistory.tsx`) murni sebagai catatan riwayat dan audit trail.
  - Tombol aksi input stok masuk dan keluar dilakukan langsung secara kontekstual melalui kartu barang di katalog atau modal alur barang masuk terpadu.
  - Pastikan setiap mutasi stok mencatat tepat 1 baris riwayat transaksi dengan snapshot data lengkap.
- **Kriteria Keberhasilan**: Tidak ada 3 pintu input yang membingungkan; alur mutasi barang terfokus dan riwayat tercatat akurat.

### Langkah 9: Sinkronisasi Versi Aplikasi
- **Pekerjaan**:
  - Perbarui konstanta versi di `frontend/src/constants/version.ts` dari `1.1.0` menjadi `1.2.5.3`.
  - Sinkronkan `package.json` dan tampilan footer aplikasi di `App.tsx` serta modal rilis.
- **Kriteria Keberhasilan**: Versi yang ditampilkan di footer, info sistem, dan rilis konsisten tertulis `v1.2.5.3`.

### Langkah 10: Audit dan Pembersihan File Usang / Redundan (Baru)
- **Tujuan**: Mengidentifikasi dan menghapus file-file yang sudah usang, tidak digunakan lagi, atau merupakan duplikasi dari iterasi sebelumnya agar repositori tetap bersih dan terawat.
- **Cakupan Pemeriksaan**:
  1. **Aset Panduan & Markdown Duplikat**:
     - Memeriksa folder `public/assets/aistudio/` terhadap file-file duplikat seperti:
       - `BUGFIX_SCAN_FONNTE_6ea62b26.md`, `BUGFIX_SCAN_FONNTE__1__88be6082.md`, `BUGFIX_SCAN_FONNTE__2__40b7ac95.md`
       - `IMPLEMENTATION_GUIDE_29b90e72.md`, `IMPLEMENTATION_GUIDE__1__ea3e02b0.md`, `IMPLEMENTATION_GUIDE_a5a30a68.md`
       - `SECURITY_GUIDE_03bb4469.md`, `SECURITY_GUIDE_88b80c80.md`
       - `FIX_PRINT_LABEL_70f04d06.md`, `FIX_STOCK_IO_c78c536d.md`, `FIX_PRINT_LABEL.md` (root)
     - Mempertahankan dokumen acuan resmi di `docs/` dan menghapus file duplikat/temporary yang tidak lagi diakses kode aplikasi.
  2. **Komponen Frontend yang Ditinggalkan**:
     - Mengaudit komponen katalog lama (seperti `CatalogItemRow.tsx` jika fungsinya sudah terintegrasi ke komponen v2 modular, atau `CatalogStatusCards.tsx` lama jika sudah digantikan oleh `CatalogSummaryCards.tsx`).
     - Memastikan tidak ada file komponen yang menjadi *dead code* (tidak diimpor di file manapun).
  3. **Prosedur Keamanan Pembersihan**:
     - Sebelum menghapus file apa pun, lakukan verifikasi pencarian referensi dengan `grep` di seluruh direktori `frontend/src` dan `backend/src`.
     - Jalankan `npm run lint` dan `npm run build` setelah setiap penghapusan untuk memastikan tidak ada impor terputus.
- **Kriteria Keberhasilan**: Repositori bebas dari file duplikat/mati, build tetap 100% lulus tanpa kegagalan impor.

---

## 4. Technical Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        InventoryCatalog.tsx                            │
│  State: activeSubTab ('produk' | 'kategori' | 'boxes' | 'kelola')      │
│  Role-Aware Default: technician -> 'kategori', admin -> 'produk'       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│  CatalogProductsTab     │ │ CatalogBrowseCategories │ │ CatalogManageTab        │
│ ┌─────────────────────┐ │ │ ┌─────────────────────┐ │ │ ┌─────────────────────┐ │
│ │ CatalogSummaryCards │ │ │ │ Kategori Grid Cards │ │ │ │ Atribut & Kategori  │ │
│ │ (Semua/Aman/Menipis/│ │ │ │ (Nama, Jml Produk,  │ │ │ ├─────────────────────┤ │
│ │  Habis Filter)      │ │ │ │  Total Varian)      │ │ │ │ Pola Nomor Seri     │ │
│ └─────────────────────┘ │ │ └──────────┬──────────┘ │ │ ├─────────────────────┤ │
│ ┌─────────────────────┐ │ │            ▼            │ │ │ Arsip & Pemulihan   │ │
│ │ CatalogToolbar      │ │ │ ┌─────────────────────┐ │ │ │ (Kotak Sampah Data) │ │
│ └─────────────────────┘ │ │ │ Filtered Products   │ │ │ └─────────────────────┘ │
│ ┌─────────────────────┐ │ │ │ (Shared List Item)  │ │ │ *Hidden for Technician  │
│ │ CatalogProductList  │ │ │ └─────────────────────┘ │ └─────────────────────────┘
│ └─────────────────────┘ │ └─────────────────────────┘
└─────────────────────────┘                 │
    │                                       │
    └───────────────────┬───────────────────┘
                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Single Read API Gateway                            │
│              GET /api/catalog/products-v2                              │
│       (Aggregated stock, variant attributes, WA Alert thresholds)      │
└────────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Unified Stock Mutator Service                        │
│          recordStockTransaction() with complete snapshots              │
│       (nama_barang, sku, satuan, tipe_id, tipe_mutasi, user, notes)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Verification & Testing Plan

1. **Uji Migrasi Skema & Database**:
   - Jalankan migrasi `11_drop_transactions_item_id_fk.sql` dan verifikasi pelepasan constraint foreign key.
   - Verifikasi migrasi data legacy v2 berjalan tanpa memotong data lama.
2. **Uji Transaksi & Riwayat Mutasi**:
   - Eksekusi transaksi mutasi masuk & keluar (kamera, manual, dan tiket).
   - Pastikan entri di `transactions` terisi lengkap (`nama_barang`, `sku`, `satuan`, `tipe_id`).
3. **Uji Evaluasi Ambang Batas Stok (WA Alert Thresholds)**:
   - Verifikasi kartu status: produk dengan varian 0 berstatus Habis, varian di bawah ambang berstatus Menipis, dan varian aman berstatus Aman.
   - Pastikan angka klik-filter pada kartu ringkasan sesuai dengan jumlah daftar produk yang muncul.
4. **Uji Peran & Hak Akses (Role-Based Permissions)**:
   - Login sebagai **Teknisi**: Buka katalog $\rightarrow$ otomatis berada di sub-tab Kategori, sub-tab Kelola tidak tampak, tidak ada tombol Buat Produk atau edit data.
   - Login sebagai **Admin Gudang / Admin**: Buka katalog $\rightarrow$ otomatis di sub-tab Produk, seluruh tab dan tombol operasional tersedia.
5. **Uji Pembersihan File Usang (Langkah 10)**:
   - Pastikan file yang dihapus tidak lagi diimpor atau direferensikan dalam kode sumber.
   - Pastikan dokumen resmi di `docs/` tetap utuh.
6. **Uji Kompilasi & Linting Akhir**:
   - Jalankan `npm run lint` dan `npm run build` untuk memastikan tidak ada kesalahan TypeScript, missing imports, atau regresi bundling.
