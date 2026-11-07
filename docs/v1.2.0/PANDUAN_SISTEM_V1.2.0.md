# DOKUMENTASI FINAL VERSI 1.2.0 (FIELDOPS INVENTORY V2)
**Aplikasi**: FieldOps IT Inventory Management System  
**Rilis**: Versi 1.2.0 (Tahap 0 s/d Tahap 8 Lengkap & Terverifikasi)  
**Database**: MariaDB 11.x (Autonomous Local Driver & Migration Engine)  
**Arsitektur**: Decoupled Client-Server (`frontend/` React 19 SPA + `backend/` Express 5)

---

## 🌟 1. Ringkasan Eksekutif & Fitur Baru v1.2.0

Pembaruan Versi 1.2.0 mentransformasi sistem inventaris FieldOps IT dari pelacakan barang sederhana menjadi platform manajemen aset telekomunikasi dan jaringan bertingkat modern:

1. **Struktur Katalog Bertingkat 4-Level**:
   - **Jenis (Golongan Besar)**: Mengelompokkan suku cadang (Adaptor, Kabel, Modem/ONU, dsb.).
   - **Atribut Dinamis**: Spesifikasi per Jenis (Tegangan, Arus, Jack, Jaringan) bertipe `angka`, `pilihan`, atau `teks`.
   - **Produk**: Induk katalog dengan kategori `fast_moving` atau `recycle`.
   - **Tipe (Varian)**: Varian produk spesifik dengan nama otomatis yang disusun dari urutan atribut (`masuk_nama = 1`).
2. **Aturan ID Item Fleksibel**:
   - `scan_sn`: Pemindaian barcode/QR serial number pabrik.
   - `otomatis`: Penomoran serial otomatis berseri (`PREFIX-000123`).
   - `manual`: Pengetikan manual dengan validasi Regex (`pola_id`).
   - `tanpa_id`: Mode stok jumlah per box (untuk barang curah/kabel).
   - *Penguncian Otomatis*: Aturan ID terkunci (`id_dikunci = 1`) begitu stok pertama masuk. Perubahan aturan wajib melalui persetujuan Tingkat 3.
3. **Penyimpanan Box Fleksibel & Input Cepat**:
   - Satu Box dapat memuat campuran berbagai macam produk dan tipe.
   - Pemindaian kamera barcode/QR responsif.
   - Input massal N unit / scan beruntun diproses dalam **satu transaksi tunggal** dengan ID Aktivitas format `AKT-YYYYMMDD-NNNN`.
4. **Antarmuka Katalog Toko Online (Catalog View)**:
   - Tampilan visual ala toko online modern dengan kartu produk interaktif.
   - Indikator total stok segala tipe, detail sebaran box, dan riwayat mutasi langsung dari audit log.
   - Modal Rincian ID Fisik ber-status aktif.
5. **Barang Keluar, Arsip, & Restore**:
   - Soft delete status `keluar` (tidak merusak relasi database).
   - Pengeluaran massal dengan konfirmasi server Tingkat 2 (`approve`).
   - Pemulihan (restore) barang dari Arsip ke Box pilihan dengan validasi pencegahan duplikasi ID yang sedang aktif dan verifikasi kesesuaian produk.
6. **Alur Request Teknisi & Persetujuan Cepat Atomik**:
   - Teknisi mengajukan permohonan pengambilan barang berstatus `menunggu`.
   - Persetujuan cepat atomik: **1 approval cukup** dari 3 peran (`developer`, `admin`, `warehouse_admin`).
   - Perlindungan *race condition* dengan klausa `UPDATE request SET status = 'disetujui' WHERE id = ? AND status = 'menunggu'`.
   - Pengurangan stok otomatis (*auto-deduct*) dan pencatatan transaksi mutasi.
7. **Label Batch & Cetak A4 Presisi**:
   - Sesuai standar cetak `cetak_label.html`.
   - Ukuran kartu label tetap **190 × 89 mm**, memuat 2 tabel 5×3 (maks. 10 produk per kartu).
   - Titik potong celah presisi **195 × 94 mm** di celah 5 mm antar label.
   - SVG QR Code resolusi tinggi (bebas blur) langsung menautkan ke halaman detail katalog.
   - Opsi slot 1-3 dan 1-3 label per lembar A4 untuk menghemat kertas stiker sisa.
8. **Notifikasi WhatsApp (Fonnte)**:
   - Pengiriman notifikasi otomatis saat request baru diajukan oleh teknisi.
   - Pengiriman asinkron dan terisolasi: kegagalan gateway WA tidak akan pernah menggagalkan transaksi database.
9. **Sistem Desain & Tema (Zero-Pill Discipline)**:
   - Dual theme (Terang / Gelap / Sistem) berbasis CSS Design Tokens WCAG AA compliant.
   - Pembersihan border tajam dan kontras pill yang menyilaukan pada mode gelap.

---

## 🔒 2. Matriks Keamanan & Hak Akses

| Peran (Role) | Hak Akses Utama | Konfirmasi Aksi |
| :--- | :--- | :--- |
| **Developer / Master Admin** | Akses penuh sistem, koreksi aturan ID, audit log, konfigurasi WhatsApp, backup | Tier 0 - Tier 3 |
| **Admin** | Pengelolaan pengguna, katalog, stok, persetujuan request, laporan | Tier 0 - Tier 3 |
| **Admin Gudang (`warehouse_admin`)** | Kelola box, input stok, persetujuan request, cetak label, barang keluar/masuk | Tier 0 - Tier 2 |
| **Teknisi (`technician`)** | Lihat katalog & stok, buat request barang, checklist tas lapangan | Tier 0 |

### Tingkat Konfirmasi Sensitif (Server-Enforced Single-Use Token 120s):
- **Tingkat 0**: Aksi biasa tanpa konfirmasi tambahan (misal: ubah catatan).
- **Tingkat 1**: Dialog konfirmasi sederhana (misal: barang keluar 1 unit, restore 1 unit).
- **Tingkat 2**: Mengetik kata `"approve"` persis (misal: persetujuan/penolakan request, barang keluar/masuk massal).
- **Tingkat 3**: Mengetik nama objek persis + kata sandi akun (jika login > 15 menit) untuk aksi destruktif (misal: hapus permanen, hapus produk/tipe/box, koreksi aturan ID).

---

## 📁 3. Struktur Tabel & Skema Database MariaDB 11.x

Migrasi SQL otomatis dijalankan berurutan saat server pertama kali start:
1. `01_auth_schema.sql`: Tabel `users`, `sessions`, `api_keys`.
2. `02_inventory_schema.sql`: Tabel master barang lama, `categories`, `items`, `transactions`.
3. `03_audit_trail_schema.sql`: Tabel `audit_logs`.
4. `04_v2_foundation_schema.sql`: Tabel `sesi` (server-authoritative), `pengaturan`, `sampah_hapus`, `transaksi` (`AKT-YYYYMMDD-NNNN`), `transaksi_detail`, `token_konfirmasi`.
5. `05_v2_catalog_schema.sql`: Tabel `jenis`, `atribut`, `atribut_opsi`, `produk`, `tipe`, `tipe_nilai`.
6. `06_v2_stock_schema.sql`: Tabel `box`, `item`, `stok_jumlah`.
7. `07_v2_request_schema.sql`: Tabel `request` (alur permohonan & persetujuan teknisi).

---

## 🧪 4. Rekapitulasi Pengujian Otomatis (97/97 Tes Lulus 100%)

Semua suite pengujian unit dan integrasi lulus verifikasi secara menyeluruh:
- `backend/src/tests/tahap1Foundation.test.ts`: **19/19 PASS**
- `backend/src/tests/tahap2Catalog.test.ts`: **13/13 PASS**
- `backend/src/tests/tahap3Stock.test.ts`: **17/17 PASS**
- `backend/src/tests/tahap4CatalogView.test.ts`: **14/14 PASS**
- `backend/src/tests/tahap5ArchiveRestore.test.ts`: **15/15 PASS**
- `backend/src/tests/tahap6Requests.test.ts`: **11/11 PASS**
- `backend/src/tests/tahap7Labels.test.ts`: **8/8 PASS**

---

## 🚀 5. Panduan Menjalankan Sistem

```bash
# 1. Menjalankan pengujian lengkap
npm test

# 2. Memeriksa kualitas kode & type-checking
npm run lint

# 3. Membangun aplikasi produksi
npm run build

# 4. Menjalankan server aplikasi
npm start
```
