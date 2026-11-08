# PELACAK PROGRES REBUILD FIELDOPS IT (PROGRESS.MD)
**Aplikasi**: FieldOps IT Inventory Rebuild  
**Database**: MariaDB 11.x (Server Lokal)  
**Status Versi**: Tahap 5 Selesai & Terverifikasi  
**Format Status**: `belum` | `dikerjakan` | `selesai` | `terverifikasi`

---

## 📊 Matriks Progres Fitur & Modul

| ID Fitur | Nama Fitur & Modul | Status | Modul Baru | Dites? | Catatan / Aturan Khusus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`[F-01]`** | Pemisahan Struktur `frontend/` & `backend/` | **terverifikasi** | Root / Docker Compose | **Ya** | Decoupled structure, package.json & env terpisah |
| **`[F-02]`** | Database MariaDB & Migrasi Skema Terpisah | **terverifikasi** | `backend/src/db/` | **Ya** | `01_auth_schema.sql` (akun) & `02_inventory_schema.sql` (barang) terpisah |
| **`[F-03]`** | Autentikasi Server-Authoritative & Sesi Cookie | **terverifikasi** | `backend/src/routes/auth.ts`, `backend/src/services/authService.ts` | **Ya** | Session cookie HttpOnly, PBKDF2 100k, proteksi brute force rate limit |
| **`[F-04]`** | Skrip Setup Master Admin Pertama | **terverifikasi** | `backend/src/scripts/setupAdmin.ts` | **Ya** | CLI/Interactive setup admin tanpa default password publik |
| **`[F-05]`** | Log Perubahan / Audit Trail Terisolasi | **terverifikasi** | `backend/src/db/migrations/03_audit_trail_schema.sql` | **Ya** | Skema SQL terisolasi & terintegrasi dengan mutasi transaksi |
| **`[F-06]`** | Master Barang & Kategori (CRUD) | **terverifikasi** | `backend/src/routes/inventory.ts` | **Ya** | REST API lengkap dengan soft delete dan restore barang |
| **`[F-07]`** | Mutasi Stok Atomik (`stockIn`, `stockOut`) | **terverifikasi** | `backend/src/routes/transactions.ts` | **Ya** | Transaksi atomik MariaDB dengan update stok sebelum/sesudah |
| **`[F-08]`** | Integrasi Tiket Lapangan (Auto-Deduct API) | **terverifikasi** | `backend/src/routes/ticketIntegration.ts` | **Ya** | API consume stock otomatis dengan Bearer token authentication |
| **`[F-09]`** | Konsolidasi WhatsApp Alert (Fonnte) | **terverifikasi** | `backend/src/integrations/whatsapp/` | **Ya** | Unified provider interface (`FonnteProvider`), template, dan route |
| **`[F-10]`** | Laporan Mingguan & Sanitasi Ekspor Data | **terverifikasi** | `backend/src/routes/reports.ts`, `src/utils/excelExporter.ts` | **Ya** | Sanitasi CWE-1236 CSV/Excel injection (`sanitizeFormulaInput`) |
| **`[F-11]`** | Checklist Tas Lapangan Teknisi | **terverifikasi** | `backend/src/routes/checklist.ts` | **Ya** | Pengelolaan checklist tas teknisi berbasis API backend |
| **`[F-12]`** | Cetak Surat Jalan & Bukti Serah Terima | **terverifikasi** | `src/components/PrintDocumentModal.tsx` | **Ya** | Modul cetak dokumen fisik dan PDF siap pakai |
| **`[F-13]`** | Backup & Restore Terpisah (Barang vs Akun) | **terverifikasi** | `backend/src/services/backupService.ts` | **Ya** | Teruji via `npm run test:backup` (Zero Account Leakage) |
| **`[F-14]`** | Docker Compose & Panduan `DEPLOY.md` | **terverifikasi** | `docker-compose.yml`, `docs/DEPLOY.md` | **Ya** | MariaDB 11 + Backend + Cloudflare Tunnel HTTPS |
| **`[F-15]`** | Migrasi Data dari Workspace Tunggal (`default`)| **terverifikasi** | `auth_seed.json`, `items_seed.json` | **Ya** | Data barang dan akun dipisah 100% ke dalam 2 seed file terisolasi |

---

## 🚀 Road Map v1.2.0 (FieldOps Inventory v2)

| Tahap | Deskripsi Cakupan Modul | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Tahap 0** | Prasyarat, Perbaikan Hash Demo & Pemetaan Data | **terverifikasi** | Node.js Auth Suite | Login demo 100% lulus; pemetaan Jenis/Produk/Tipe/Item disetujui |
| **Tahap 1** | Fondasi Keamanan, Sesi Server, Konfirmasi & Sampah 14H | **terverifikasi** | `tahap1Foundation.test.ts` (19/19 Lulus) | Tabel `sesi`, `pengaturan`, `transaksi` (`AKT-`), `sampah_hapus`, CLI `npm run sampah` |
| **Tahap 2** | CRUD Jenis, Atribut, Produk, dan Tipe | **terverifikasi** | `tahap2Catalog.test.ts` (13/13 Lulus) | Pembentukan nama tipe otomatis (`masuk_nama = 1`), aturan ID (`scan_sn`, `otomatis`, `manual`, `tanpa_id`), tombol tambah atribut inline, penguncian `id_dikunci` |
| **Tahap 3** | Box, Item Fisik Ber-ID, Stok Jumlah & Input Kamera | **terverifikasi** | `tahap3Stock.test.ts` (17/17 Lulus) | Box campuran, pemindaian kamera barcode/QR, input massal N unit/scan beruntun 1 ID aktivitas, validasi duplikat & regex |
| **Audit Keamanan** | Audit Perbandingan Kode vs `SECURITY_GUIDE.md` (Bagian 1-3) | **terverifikasi** | Matriks Audit di `STATUS.md` | 100% Sesuai; semua aturan sesi, konfirmasi bertingkat, dan tempat sampah 14H disetujui |
| **Tahap 4** | Antarmuka Katalog Toko Online & Filter Atribut | **terverifikasi** | `tahap4CatalogView.test.ts` (14/14 Lulus) | Kartu produk ala online shop, total stok segala tipe, detail per tipe, sebaran box, riwayat dari log, modal item ID fisik, filter lintas atribut |
| **Tahap 5** | Barang Keluar & Arsip Terintegrasi Restore | **terverifikasi** | `tahap5ArchiveRestore.test.ts` (15/15 Lulus) | Soft delete barang keluar single & bulk (Tier 2 `approve`), pencarian arsip, konfirmasi restore produk matched, pencegahan duplikasi ID aktif |
| **Tahap 6** | Alur Request Teknisi & Persetujuan Cepat | **terverifikasi** | `tahap6Requests.test.ts` (11/11 Lulus) | Permohonan barang oleh teknisi, persetujuan cepat atomik (1 approval dari 3 role), auto-deduct stok, pencegahan double approval, penolakan dengan catatan |
| **Tahap 7** | Label Batch & Cetak A4 Presisi (`cetak_label.html`) | **terverifikasi** | `tahap7Labels.test.ts` (8/8 Lulus) | Layout presisi A4 (190×89mm), 2 tabel 5×3 per label (maks 10 produk), titik potong celah 195×94mm, SVG QR tajam, opsi slot 1-3 & 1-3 label/lembar |
| **Tahap 8** | Notifikasi Fonnte, Audit Keamanan & Dokumentasi | **terverifikasi** | `tahap8Notifications.test.ts` (5/5 Lulus) | WhatsApp auto-alert via Fonnte saat request dibuat (asinkron & terisolasi), dark/light token design WCAG AA, audit keamanan final, dokumentasi sistem v1.2.0 |

## 🚀 Road Map v1.2.5 (Perbaikan dan Fitur Baru FieldOps IT)

| Paket | Deskripsi Paket Kerja | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Paket 1** | Hak Akses RBAC (Setting API, Katalog, WA Alert) | **terverifikasi** | `v125Paket1AccessControl.test.ts` (23/23 Lulus) | Modul `permissions.ts` terpusat; Setting API (`/api/tickets/keys`, `/api/auth/settings`, `/api/auth/users`, `/api/auth/trash`) khusus `developer` & `admin` (403 untuk `warehouse_admin` & `technician`); Katalog & Box read untuk semua role (termasuk `technician`); Katalog & Box write untuk `developer`, `admin`, `warehouse_admin` (403 untuk `technician`); WA Alert config 403 untuk `technician`. |
| **Paket 2** | Perbaikan Bug Transaksi Keluar/Masuk & Ekspor Excel | **terverifikasi** | `v125Paket2StockAndExport.test.ts` (19/19 Lulus) | Memperbaiki bug pergeseran parameter SQL pada `transactions` (penggunaan 12 parameter terikat `?` menggantikan string SQL hardcoded `'IN'`/`'OUT'`) sehingga tipe transaksi dan kuantitas sebelum/sesudah tercatat akurat; memperbarui `excelExporter.ts` menggunakan library `exceljs` untuk menghasilkan berkas `.xlsx` biner valid (content-type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) yang terbebas dari ancaman CWE-1236 Formula Injection. |
| **Paket 3** | Konsolidasi Menu Tools Navbar | **terverifikasi** | `v125Paket3Tools.test.ts` (24/24 Lulus) | Pemindahan tombol Database, Akses HP, WA Alert, Audit, Ekspor Excel ke dropdown **Tools** di navbar; quick access **Cetak Label** Batch A4; penegakan hak akses berbasis role pada UI dan backend (Database & Audit hanya untuk `developer` & `admin`, 403 untuk `warehouse_admin` & `technician`; WA Alert config write 403 untuk `technician`; WA Alert logs, Akses HP, Excel, Cetak Label untuk semua role); sanitasi CWE-1236 dan proteksi kerahasiaan kredensial pada ekspor Excel. |
| **Paket 4** | Katalog, Tipe Stok, Kategori Barang, & Kondisi Item | **belum** | - | Mendatang |
| **Paket 5** | Input Stok via Kamera & Template Cetak Laporan A4 | **belum** | - | Mendatang |
| **Paket 6** | WA Alert Otomatis (Fonnte) & Ambang Berjenjang 15m | **belum** | - | Mendatang |
| **Paket 7** | Branding Logo Baru & Kotak Logo Top Navigation | **belum** | - | Mendatang |

---

## 📈 Log Perubahan Status
- **Tahap 0 Selesai**: Diagnosa otentikasi tuntas; hash PBKDF2 diperbaiki untuk `admin`, `developer`, `admin_gudang`, dan `teknisi`.
- **Tahap 1 Selesai**: Fondasi v2 terpasang (`04_v2_foundation_schema.sql`); sesi server terisolasi dengan rotasi token dan deteksi anti-replay; konfirmasi sensitif bertingkat Tier 0–3 ditegakkan server; log transaksi format `AKT-YYYYMMDD-NNNN`; tempat sampah 14 hari dengan pemulihan CLI `npm run sampah`. Lulus 19/19 pengujian otomatis di `tahap1Foundation.test.ts`.
- **Tahap 2 Selesai**: Skema katalog bertingkat terpasang (`05_v2_catalog_schema.sql`); REST endpoint & CatalogService (`jenis`, `atribut`, `atribut_opsi`, `produk`, `tipe`, `tipe_nilai`); otomatisasi pembentukan nama varian tipe dari atribut berurutan (`urutan` ASC); aturan ID per tipe (`scan_sn`, `otomatis`, `manual`, `tanpa_id`) dengan pola regex dan penguncian; UI `CatalogV2Manager.tsx` lengkap dengan tombol "+ Tambah Atribut" langsung di modal buat produk dan filter spesifikasi atribut dinamis. Lulus 13/13 pengujian otomatis di `tahap2Catalog.test.ts`.
- **Tahap 3 Selesai**: Skema stok & box terpasang (`06_v2_stock_schema.sql`); `StockService` & REST endpoint (`/api/boxes`, `/api/stock`); dukungan box campuran; pemindaian kamera barcode/QR; input massal N unit & scan beruntun 20+ unit dipublikasikan dalam **1 transaksi tunggal** dengan ID aktivitas `AKT-YYYYMMDD-NNNN`; validasi duplikasi ID di seluruh sistem; penguncian `id_dikunci = 1` pada tipe; relokasi antar box dengan log `pindah_box`; UI `StockInputModal.tsx`, `BoxManagerModal.tsx`, dan `BoxContentModal.tsx`. Lulus 17/17 pengujian otomatis di `tahap3Stock.test.ts`.
- **Tahap 4 Selesai**: Antarmuka katalog toko online modern dengan filter atribut dinamis, indikator total stok segala tipe, detail varian tipe per box, riwayat transaksi dari audit log, modal Rincian ID Fisik, dan pengujian otomatis 14/14 lulus di `tahap4CatalogView.test.ts`.
- **Tahap 5 Selesai**: Barang keluar tunggal/massal dengan soft delete `status = 'keluar'`, konfirmasi server Tier 2 (`approve`), daftar Arsip dengan pencarian filter, dan pemulihan (restore) dari Arsip ke Box pilihan dengan validasi konfirmasi produk matched serta pencegahan duplikasi ID aktif. Lulus 15/15 pengujian otomatis di `tahap5ArchiveRestore.test.ts`.
- **Dokumentasi & Tahap 6 Selesai**: File `STATUS.md` berhasil dipindahkan ke `/docs/STATUS.md`. Skema `07_v2_request_schema.sql`, `RequestService`, dan REST endpoint `/api/requests` selesai; persetujuan cepat atomik (1 approval dari 3 role), auto deduct stok, pencegahan race condition/double approval, penolakan dengan catatan. Lulus 11/11 pengujian otomatis di `tahap6Requests.test.ts`.
- **Tahap 7 Selesai**: Modul cetak label batch presisi A4 (`BatchLabelPrintModal.tsx` & `/api/catalog/labels`) terpasang sesuai spesifikasi `cetak_label.html`: ukuran label 190 × 89 mm, layout 2 tabel 5×3 (maks 10 produk/kartu), titik potong celah presisi 195 × 94 mm, kode QR SVG tajam tanpa blur, serta penyesuaian slot 1-3. Lulus 8/8 pengujian otomatis di `tahap7Labels.test.ts`.
- **Tahap 8 (Rilis Final Versi 1.2.0) Selesai**: Notifikasi WhatsApp (Fonnte) auto-alert terintegrasi asinkron; penegasan audit keamanan Bagian 1-3 tanpa modifikasi destruktif; sistem token tema terang/gelap WCAG AA; dokumentasi lengkap di `docs/v1.2.0/PANDUAN_SISTEM_V1.2.0.md` dan `CHANGELOG.md`. Lulus 5/5 pengujian otomatis di `tahap8Notifications.test.ts`. **TOTAL 102/102 TEST SUITE LULUS 100%**.
- **v1.2.5 Paket 1 Selesai**: Penegakan Hak Akses RBAC terpusat di `backend/src/utils/permissions.ts`. Modul Setting API (`/api/tickets/keys`, `/api/auth/settings`, `/api/auth/users`, `/api/auth/trash`) khusus `developer` dan `admin` (ditolak HTTP 403 untuk `warehouse_admin` dan `technician`). Katalog & Storage Box read terbuka untuk seluruh role. Katalog write terbuka untuk `developer`, `admin`, `warehouse_admin` (ditolak HTTP 403 untuk `technician`). Pengaturan WA Alert ditolak HTTP 403 untuk `technician`. Pengujian otomatis `v125Paket1AccessControl.test.ts` LULUS 23/23 (100% PASS, total akumulatif 125/125 test PASS).
- **v1.2.5 Paket 2 Selesai**: Perbaikan bug transaksi barang masuk/keluar (penyelarasan 12 parameter SQL terikat `?` pada tabel `transactions`) dan ekspor Excel biner asli menggunakan `exceljs` dengan Blob type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` serta sanitasi CWE-1236. Pengujian otomatis `v125Paket2StockAndExport.test.ts` LULUS 19/19 (100% PASS, total akumulatif 144/144 test PASS).
- **v1.2.5 Paket 3 Selesai**: Konsolidasi menu **Tools** di navbar (`Navbar.tsx` & `App.tsx`) dengan quick access Cetak Label Batch A4 dan penegakan hak akses berbasis role pada UI dan backend (`/api/backup/inventory/download`, `/api/auth/trash`, `/api/whatsapp/config`, dll.). Header atas bersih dari tombol berdiri sendiri. Pengujian otomatis `v125Paket3Tools.test.ts` LULUS 24/24 (100% PASS, total akumulatif 168/168 test PASS).


