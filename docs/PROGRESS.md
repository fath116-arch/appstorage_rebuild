# PELACAK PROGRES FIELDOPS IT (PROGRESS.MD)
**Aplikasi**: FieldOps IT Inventory  
**Database**: MariaDB 11.4 LTS (Server Lokal, UTC)  
**Status Versi**: v1.2.6 Selesai & Terverifikasi  
**Format Status**: `belum` | `dikerjakan` | `selesai` | `terverifikasi`

---

## 📊 Matriks Progres Fondasi & Modul Inti (v1.0.0 – v1.2.6)

> *Catatan Arsitektur*: Modul legacy awal v1 (`/api/inventory`, `/api/transactions`) telah disatukan ke dalam **Model Kanonik Tunggal v1.2.6** (`CatalogService`, `StockService`, `RequestService`, `BagService`, `ActivityLogService`).

| ID Fitur | Nama Fitur & Modul | Status | Modul / Lokasi Aktual | Dites? | Catatan / Aturan Khusus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`[F-01]`** | Pemisahan Struktur `frontend/` & `backend/` | **terverifikasi** | Root / Docker Compose | **Ya** | Decoupled structure, build Vite & Express 5 terpadu |
| **`[F-02]`** | Database MariaDB & Migrasi Skema (`01` s/d `12`) | **terverifikasi** | `backend/src/db/migrations/` | **Ya** | Skema akun, fondasi keamanan, katalog, stok, request, WA alert, & unifikasi |
| **`[F-03]`** | Autentikasi Server-Authoritative & Sesi Cookie | **terverifikasi** | `backend/src/routes/auth.ts`, `authService.ts`, `sessionService.ts` | **Ya** | Cookie HttpOnly (30 hari), PBKDF2 100k, rotasi refresh anti-replay, rate limit |
| **`[F-04]`** | Skrip Setup Master Admin Pertama | **terverifikasi** | `backend/src/scripts/setupAdmin.ts` | **Ya** | CLI interaktif `npm run setup:admin` |
| **`[F-05]`** | Ledger Aktivitas Append-Only & Audit Koreksi | **terverifikasi** | `backend/src/routes/activities.ts`, `activityLogService.ts` | **Ya** | ID harian `AKT-YYYYMMDD-NNNN`, `actor_id` vs `recorded_by_id`, koreksi `correction_of_id` |
| **`[F-06]`** | Katalog Bertingkat, Ubah & Hapus Terproteksi | **terverifikasi** | `backend/src/routes/catalog.ts`, `catalogService.ts` | **Ya** | Jenis, Atribut, Produk, Tipe, proteksi stok/request terbuka, & Kotak Sampah 14 hari |
| **`[F-07]`** | Manajemen Box & Mutasi Stok Atomik | **terverifikasi** | `backend/src/routes/box.ts`, `stock.ts`, `stockService.ts` | **Ya** | Box campuran, `SCAN_SN` ketat, Keranjang Keluar, Arsip & Restore, kondisi item |
| **`[F-08]`** | Integrasi Tiket Lapangan (Auto-Deduct API) | **terverifikasi** | `backend/src/routes/ticketIntegration.ts` | **Ya** | `POST /api/tickets/consume`, `GET/POST /api/tickets/keys` dengan `X-API-Key` / Bearer |
| **`[F-09]`** | Konsolidasi WhatsApp Alert (Fonnte) | **terverifikasi** | `backend/src/routes/whatsapp.ts`, `whatsappAlertService.ts` | **Ya** | Ambang berjenjang (*tipe > produk > global*), watchlist, & cooldown 15 menit |
| **`[F-10]`** | Laporan Mingguan WIB & Sanitasi Ekspor Data | **terverifikasi** | `backend/src/routes/reports.ts`, `excelExporter.ts` | **Ya** | Rentang Senin–Minggu WIB, ExcelJS wall-clock WIB, & sanitasi CWE-1236 |
| **`[F-11]`** | Inspeksi Tas & Multi-Tas Kerja Lapangan | **terverifikasi** | `backend/src/routes/checklist.ts`, `bagService.ts` | **Ya** | `TOOLKIT_CHECK` & multi-template `BAG_TEMPLATE` terhubung ke Katalog & Request |
| **`[F-12]`** | Cetak Laporan A4 & Label QR Batch A4 Presisi | **terverifikasi** | `PrintReportModal.tsx`, `BatchLabelPrintModal.tsx` | **Ya** | Kop surat formal A4 & label `190 × 89 mm` dengan titik potong celah presisi |
| **`[F-13]`** | Backup & Restore Bebas Kredensial Akun | **terverifikasi** | `backend/src/services/backupService.ts` | **Ya** | Teruji via `npm run test:backup` (Zero Account Leakage) |
| **`[F-14]`** | Docker Compose & Panduan `DEPLOY.md` | **terverifikasi** | `docker-compose.yml`, `docs/DEPLOY.md` | **Ya** | MariaDB 11.4 + Backend + Cloudflare Tunnel HTTPS + panduan native |

---

## 🚀 Road Map v1.2.0 (FieldOps Inventory v2)

| Tahap | Deskripsi Cakupan Modul | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Tahap 0** | Prasyarat, Perbaikan Hash & Pemetaan Data | **terverifikasi** | Node.js Auth Suite | Pemetaan Jenis/Produk/Tipe/Item disetujui |
| **Tahap 1** | Fondasi Keamanan, Sesi Server, Konfirmasi & Sampah 14H | **terverifikasi** | `tahap1Foundation.test.ts` (19/19 Lulus) | Tabel `sesi`, `pengaturan`, `transaksi` (`AKT-`), `sampah_hapus`, CLI `npm run sampah` |
| **Tahap 2** | CRUD Jenis, Atribut, Produk, dan Tipe | **terverifikasi** | `tahap2Catalog.test.ts` (13/13 Lulus) | Pembentukan nama tipe otomatis (`masuk_nama = 1`), aturan ID (`scan_sn`, `otomatis`, `manual`, `tanpa_id`), penguncian `id_dikunci` |
| **Tahap 3** | Box, Item Fisik Ber-ID, Stok Jumlah & Input Kamera | **terverifikasi** | `tahap3Stock.test.ts` (17/17 Lulus) | Box campuran, kamera barcode/QR, input massal N unit 1 ID aktivitas, relokasi antar box |
| **Audit Keamanan** | Audit Perbandingan Kode vs Kebijakan Keamanan | **terverifikasi** | Matriks Audit di `STATUS.md` | 100% Sesuai; sesi server, konfirmasi bertingkat, & sampah 14H disetujui |
| **Tahap 4** | Antarmuka Katalog Toko Online & Filter Atribut | **terverifikasi** | `tahap4CatalogView.test.ts` (14/14 Lulus) | Kartu produk modern, sebaran box, riwayat log, modal Rincian ID Fisik, filter dinamis |
| **Tahap 5** | Barang Keluar & Arsip Terintegrasi Restore | **terverifikasi** | `tahap5ArchiveRestore.test.ts` (15/15 Lulus) | Soft delete barang keluar single & bulk (Tier 2 `approve`), restore ke box pilihan |
| **Tahap 6** | Alur Request Teknisi & Persetujuan Cepat | **terverifikasi** | `tahap6Requests.test.ts` (17/17 Lulus) | Permohonan, persetujuan atomik, reservasi stok, serah terima, & pengembalian alat |
| **Tahap 7** | Label Batch & Cetak A4 Presisi (`cetak_label.html`) | **terverifikasi** | `tahap7Labels.test.ts` (8/8 Lulus) | Layout A4 `190×89mm`, titik potong celah `195×94mm`, SVG QR tajam, opsi slot |
| **Tahap 8** | Notifikasi Fonnte, Audit Keamanan & Dokumentasi | **terverifikasi** | `tahap8Notifications.test.ts` (5/5 Lulus) | WhatsApp alert asinkron saat request dibuat, desain WCAG AA, dokumentasi v1.2.0 |

## 🚀 Road Map v1.2.5 (Perbaikan dan Fitur Baru FieldOps IT)

| Paket | Deskripsi Paket Kerja | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Paket 1** | Hak Akses RBAC (Setting API, Katalog, WA Alert) | **terverifikasi** | `v125Paket1AccessControl.test.ts` (23/23 Lulus) | `permissions.ts` terpusat; 4 peran kanonis; isolasi endpoint admin/developer |
| **Paket 2** | Perbaikan Bug Transaksi & Ekspor Excel | **terverifikasi** | `v125Paket2StockAndExport.test.ts` (19/19 Lulus) | Ekspor `.xlsx` ExcelJS biner asli terbebas CWE-1236 Formula Injection |
| **Paket 3** | Konsolidasi Menu Tools Navbar | **terverifikasi** | `v125Paket3Tools.test.ts` (24/24 Lulus) | Dropdown **Tools** & quick access Cetak Label Batch A4 sesuai role |
| **Paket 4** | Katalog, Tipe Stok, Kategori Barang, & Kondisi Item | **terverifikasi** | `v125Paket4Catalog.test.ts` (13/13 Lulus) | Storage Box campuran, satuan stok dinamis, `Alat` vs `Barang Habis Pakai`, & kondisi item |
| **Paket 5** | Input Stok via Kamera & Template Cetak Laporan A4 | **terverifikasi** | `v125Paket5CameraPrint.test.ts` (15/15 Lulus) | Scanner kamera terintegrasi & kop surat laporan cetak A4 |
| **Paket 6** | WA Alert Otomatis (Fonnte) & Ambang Berjenjang 15m | **terverifikasi** | `v125Paket6WaAlert.test.ts` (13/13 Lulus) | Ambang tipe > produk > global, watchlist, & cooldown 15 menit |
| **Paket 7** | Branding Logo Baru & Kotak Logo Top Navigation | **terverifikasi** | `v125Paket7Branding.test.ts` (6/6 Lulus) | Kotak logo terpadu, favicon, PWA icons, & responsif mobile |

---

## 🚀 Road Map v1.2.6 (Unifikasi Tunggal, Request & Multi-Tas, Kontrol Katalog & UTC/WIB)

| Paket / Modul | Deskripsi Cakupan | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Unifikasi Data** | Penghapusan jalur legacy v1 (`items`/`transactions`) ke 1 model kanonik | **terverifikasi** | `canonicalSystem.test.ts` (19/19 Lulus) | Seluruh menu memakai Katalog + Ledger tunggal & `refreshData()` otomatis |
| **Input `SCAN_SN` & Output Cart** | Ekstraksi token regex ketat & Keranjang Keluar multi-item | **terverifikasi** | `scanSnExtraction.test.ts` (6/6 Lulus), `tahap3Stock.test.ts` (17/17 Lulus) | Uji Regex, `/api/sn-patterns`, debounce search 300ms, guard `Rusak`/`dipesan` |
| **Akuntabilitas & Koreksi** | Pemisahan `actor_id` vs `recorded_by_id`, `occurred_at`, & koreksi append-only | **terverifikasi** | `canonicalSystem.test.ts` | Alasan `on_behalf` wajib, validasi backdate 7H (`warehouse_admin`), `POST /api/activities/:id/correct` |
| **Kontrol Katalog & Box Content** | Ubah & Hapus Terproteksi Kategori/Atribut/Produk/Box + fix `BoxContentModal` | **terverifikasi** | `catalogDeleteEditAndReturnRequest.test.ts` (25/25 Lulus) | Tolak hapus jika ada stok/varian/produk aktif/request terbuka; konfirmasi Tier 3; fix Hooks modal box |
| **Siklus Request `Kembalikan`** | Pengajuan pengembalian dari barang dibawa + 3 kondisi + verifikasi gudang | **terverifikasi** | `catalogDeleteEditAndReturnRequest.test.ts` (25/25 Lulus) | Pemetaan **Belum Terpakai**→`Baru`, **Normal**→`Baik`, **Rusak**→`Rusak` + cegah duplikasi |
| **Multi-Tas & Paket Tas Request** | Beberapa Tas Kerja Kantor (`BAG_TEMPLATE`) & request 1-klik paket tas | **terverifikasi** | `bagAndCompleteRequest.test.ts` (20/20 Lulus) | `BagService`, `/api/checklists/bags`, & `POST /api/requests/bag` dengan validasi stok live |
| **Status `Selesai` Pelanggan** | Penyelesaian transaksi `Barang Habis Pakai` dengan data pelanggan | **terverifikasi** | `bagAndCompleteRequest.test.ts` (20/20 Lulus) | `POST /api/requests/:id/complete` untuk teknisi pemilik & gudang; `Alat` tetap wajib kembali |
| **Zona Waktu UTC ↔ WIB** | Penyimpanan UTC, tampilan WIB, Laporan Mingguan & ExcelJS WIB | **terverifikasi** | `canonicalSystem.test.ts`, `v125Paket3Tools.test.ts` (24/24 Lulus) | Senin 00:00 – Minggu 23:59:59 WIB, `debug-clock`, CWE-1236 `sanitizeFormulaInput()` |

---

## 📈 Log Perubahan Status Terkini
- **Tahap 0 s/d Tahap 8 (v1.2.0)**: Fondasi keamanan server-authoritative (`sesi`, `pengaturan`, `token_konfirmasi`, `sampah_hapus`), Katalog bertingkat, Box & stok fisik, antarmuka katalog modern, arsip & restore, siklus request awal, cetak label QR A4 presisi, dan notifikasi Fonnte tuntas & terverifikasi.
- **v1.2.5 (Paket 1 s/d 7 & Solid Refactor)**: Penegakan RBAC terpusat, perbaikan ekspor ExcelJS bebas CWE-1236, konsolidasi menu Tools, kategori `Alat` vs `Barang Habis Pakai` & kondisi item, scanner kamera, template cetak A4, WA Alert berjenjang 15 menit, dan branding logo baru.
- **v1.2.6 (Unifikasi Tunggal, Kontrol Katalog, Multi-Tas, Request `Kembalikan` & `Selesai`, UTC/WIB)**:
  - Menghapus seluruh jalur legacy v1 sehingga aplikasi berjalan 100% di atas satu model kanonik dengan `refreshData()` otomatis, `SCAN_SN` ketat, Keranjang Keluar, akuntabilitas `actor_id` vs `recorded_by_id`, dan koreksi audit append-only.
  - Menambahkan fitur ubah/hapus terproteksi Kategori, Atribut, Produk, dan Box; perbaikan layar blank `BoxContentModal`; alur request **Kembalikan** 3 kondisi + verifikasi gudang; **Multi-Tas Kerja Kantor** (`BAG_TEMPLATE`) + pengajuan **Pilih Paket Tas** (`POST /api/requests/bag`); serta status **Selesai (Terpakai Pelanggan)** khusus `Barang Habis Pakai` (`POST /api/requests/:id/complete`).
  - Terverifikasi melalui `canonicalSystem.test.ts` (19/19), `catalogDeleteEditAndReturnRequest.test.ts` (25/25), `bagAndCompleteRequest.test.ts` (20/20), suite Tahap 2–6, Paket 1–7, `npm run lint`, dan `npm run build`.
