# PELACAK PROGRES FIELDOPS IT (PROGRESS.MD)
**Aplikasi**: FieldOps IT Inventory  
**Database**: MariaDB 11.4 LTS (Server Lokal, UTC)  
**Status Versi**: v1.2.9 Selesai & Terverifikasi  
**Format Status**: `belum` | `dikerjakan` | `selesai` | `terverifikasi`

---

## 📊 Matriks Progres Fondasi & Modul Inti (v1.0.0 – v1.2.9)

> *Catatan Arsitektur*: Modul legacy awal v1 (`/api/inventory`, `/api/transactions`) telah disatukan ke dalam **Model Kanonik Tunggal** (`CatalogService`, `StockService`, `RequestService`, `BagService`, `ActivityLogService`).

| ID Fitur | Nama Fitur & Modul | Status | Modul / Lokasi Aktual | Dites? | Catatan / Aturan Khusus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`[F-01]`** | Pemisahan Struktur `frontend/` & `backend/` | **terverifikasi** | Root / Docker Compose | **Ya** | Decoupled structure, build Vite & Express 5 terpadu |
| **`[F-02]`** | Database MariaDB & Migrasi Skema (`01` s/d `14`) | **terverifikasi** | `backend/src/db/migrations/` | **Ya** | Termasuk `feature_permissions`, peleburan role `admin`, & Dual WA Gateway |
| **`[F-03]`** | Autentikasi Server-Authoritative & Sesi Cookie | **terverifikasi** | `backend/src/routes/auth.ts`, `authService.ts`, `sessionService.ts` | **Ya** | Cookie HttpOnly (30 hari), PBKDF2 100k, rotasi refresh anti-replay, rate limit |
| **`[F-04]`** | Skrip Setup Master Admin Pertama | **terverifikasi** | `backend/src/scripts/setupAdmin.ts` | **Ya** | CLI interaktif `npm run setup:admin` |
| **`[F-05]`** | Ledger Aktivitas Append-Only & Audit Koreksi | **terverifikasi** | `backend/src/routes/activities.ts`, `activityLogService.ts` | **Ya** | ID harian `AKT-YYYYMMDD-NNNN`, `actor_id` vs `recorded_by_id`, koreksi `correction_of_id` |
| **`[F-06]`** | Katalog Bertingkat, Ubah & Hapus Terproteksi | **terverifikasi** | `backend/src/routes/catalog.ts`, `catalogService.ts` | **Ya** | Jenis, Atribut, Produk, Tipe, proteksi stok/request terbuka, & Kotak Sampah 14 hari |
| **`[F-07]`** | Manajemen Box & Mutasi Stok Atomik | **terverifikasi** | `backend/src/routes/box.ts`, `stock.ts`, `stockService.ts` | **Ya** | Box campuran, `SCAN_SN` ketat, Keranjang Keluar, Arsip & Restore, kondisi item |
| **`[F-08]`** | Integrasi Tiket Lapangan (Auto-Deduct API) | **terverifikasi** | `backend/src/routes/ticketIntegration.ts` | **Ya** | `POST /api/tickets/consume`, `GET/POST /api/tickets/keys` dengan `X-API-Key` / Bearer |
| **`[F-09]`** | Konsolidasi WhatsApp Alert (Fonnte, 4 Slot ON/OFF, & WA Selektif) | **terverifikasi** | `backend/src/routes/whatsapp.ts`, `whatsappAlertService.ts` | **Ya** | Maks. 4 slot penerima ON/OFF, WA selektif hanya `beli` + stok alert, & cooldown 15m |
| **`[F-10]`** | Laporan Mingguan WIB & Sanitasi Ekspor Data | **terverifikasi** | `backend/src/routes/reports.ts`, `excelExporter.ts` | **Ya** | Rentang Senin–Minggu WIB, ExcelJS wall-clock WIB, & sanitasi CWE-1236 |
| **`[F-11]`** | Inspeksi Tas & Multi-Tas Kerja Lapangan | **terverifikasi** | `backend/src/routes/checklist.ts`, `bagService.ts` | **Ya** | `TOOLKIT_CHECK` & multi-template `BAG_TEMPLATE` terhubung ke Katalog & Request |
| **`[F-12]`** | Cetak Laporan A4 Dinamis & Label QR Batch A4 | **terverifikasi** | `PrintReportModal.tsx`, `PrintDocumentModal.tsx`, `BatchLabelPrintModal.tsx` | **Ya** | Kop & Lembar Pengesahan dinamis (`REPORT_APPROVAL_CONFIG`) + label `190 × 89 mm` |
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

## 🚀 Road Map v1.2.7 (Pembelian Barang, WA 4 Slot ON/OFF, Auto-Refresh 5m, Pengesahan Dinamis, & MariaDB Strict Auth)

| Paket / Modul | Deskripsi Cakupan | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Request Pembelian Barang (`beli`)** | Opsi `Ajukan Pembelian` (katalog / ketik barang baru), harga opsional, & WA selektif | **terverifikasi** | `purchaseWa4ReportConfig.test.ts` (20/20 Lulus) | Tanpa potong stok fisik saat disetujui; hanya `beli` yang memicu notif WA |
| **4 Slot Penerima WA + ON/OFF** | Batas 4 slot (`Slot 1..4`) dengan saklar ON/OFF individual per nomor | **terverifikasi** | `purchaseWa4ReportConfig.test.ts`, `v125Paket6WaAlert.test.ts` | Hanya slot `enabled = true` yang dikirimi pesan; tanpa fallback `.env` bila semua OFF |
| **Auto-Refresh Senyap 5 Menit** | Sinkronisasi latar belakang otomatis tiap `300.000 ms` tanpa spinner/toast error | **terverifikasi** | `npm run lint` & `npm run build` | Terintegrasi `visibilitychange` pada `InventoryContext.tsx` |
| **Lembar Pengesahan Dinamis** | Kop Surat & 3 penandatangan fleksibel (`REPORT_APPROVAL_CONFIG`) untuk production | **terverifikasi** | `purchaseWa4ReportConfig.test.ts` | `GET/PUT /api/reports/approval-config`, profil login (`useCurrentUser`), cetak identik |
| **MariaDB Strict Auth & `setup:test-login`** | Format `TIMESTAMP` UTC SQL, sanitasi IP proxy, & diagnostik login 6 tahap | **terverifikasi** | `authLoginMariaDbCompat.test.ts` (22/22 Lulus), `systemSetup.test.ts` (45/45 Lulus) | Kompatibel HTTP/HTTPS cookie, `setup:admin`, & probe tulis/cleanup `sessions`/`sesi` |

## 🚀 Road Map v1.2.8 (Login-Only, Peleburan Admin, Izin Fitur Slider, Dual WA Gateway, Hapus Massal + "delete", Impor Excel/Sheet, & "Data Barang")

| Paket / Modul | Deskripsi Cakupan | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Login-Only & Tutup Registrasi Publik** | Hapus form daftar dari `LoginScreen.tsx`, kunci `POST /api/auth/register` (`403`) | **terverifikasi** | `v128Updates.test.ts` | Akun dibuat hanya via panel web (`admin`/`developer`) atau CLI `setup:admin` |
| **Peleburan Role `admin` & Batas Akun** | Gabung `admin` + `warehouse_admin` → `admin`; batasi `admin` kelola hanya `admin`/`technician` | **terverifikasi** | `v128Updates.test.ts`, `v125Paket1AccessControl.test.ts` | Migrasi `14`, normalisasi alias legacy otomatis, & isolasi akun `developer` |
| **Izin Fitur Per Akun (Slider ON/OFF)** | Panel **Atur Fitur** khusus `developer` + `PUT /api/auth/users/:id/features` + `requireFeature()` | **terverifikasi** | `v128Updates.test.ts` | 21 fitur `FEATURE_CATALOG` bersaklar slider murni ON/OFF + **Reset ke Bawaan Peran** |
| **Dual WA Gateway (Khusus `developer`)** | 2 Gateway (`gateway1`/`gateway2`) bersaklar ON/OFF + `gatewayMode` + `POST /api/whatsapp/test-gateway` | **terverifikasi** | `v128Updates.test.ts`, `v125Paket6WaAlert.test.ts` | `admin` tetap mengelola 4 slot penerima ON/OFF & ambang tanpa akses gateway |
| **Hapus Massal Multi-Pilih + Ketik `"delete"`** | Multi-pilih & hapus massal Produk, Kategori, Atribut, Box, & Item Fisik; ketik `"delete"` | **terverifikasi** | `v128Updates.test.ts`, `catalogDeleteEditAndReturnRequest.test.ts` | Proteksi atomik stok/request terbuka di semua endpoint `/bulk` & `ConfirmDeleteModal` |
| **Impor Excel & Google Spreadsheet Publik** | Template `.xlsx`, pratinjau file/link Google Sheet, & impor atomik Katalog + Box + Stok Awal | **terverifikasi** | `v128Updates.test.ts` | `ImportService`, `/api/import/{template,preview,commit}`, & `CatalogImportModal` |
| **Istilah `"Suku Cadang"` → `"Data Barang"`** | Pembaruan label antarmuka, kolom ExcelJS, Dashboard, Tiket, & dokumen cetak | **terverifikasi** | `npm run lint` & `npm run build` | Konsisten di seluruh komponen frontend & layanan backend |

## 🚀 Road Map v1.2.8.5 (Anti-Cache & Silent Production Auto-Update, Pemisahan Log User, & Start Production Cross-Platform)

| Paket / Modul | Deskripsi Cakupan | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Build Metadata & Workbox PWA** | `__APP_BUILD_ID__`, plugin `fieldops-build-meta` (`build-meta.json`), Workbox `skipWaiting`/`clientsClaim` | **terverifikasi** | `userLogsAndCache.test.ts` (24/24 Lulus) | `navigateFallbackDenylist` `/api/` & `/build-meta.json`; fix `devOptions.enabled: true` |
| **Header Anti-Cache & `/api/health`** | Non-cache `no-store` pada HTML, SW, manifest, & `build-meta.json`; `buildId` di `/api/health` | **terverifikasi** | `userLogsAndCache.test.ts` | Aset `/assets/*` tetap ter-cache immutable 1 tahun tanpa menahan versi HTML baru |
| **Auto-Updater Senyap Aman** | Cek `buildId` & SW saat buka halaman, `visibilitychange`, `focus`, & 5m; reload saat aman | **terverifikasi** | `userLogsAndCache.test.ts` | Tunda reload bila ada modal/dialog/input aktif + penjaga loop 30 detik `sessionStorage` |
| **Pemisahan Log User dari Riwayat Barang** | Eksklusi `USER_ACTIVITY_ACTIONS` dari `GET /api/activities` & laporan mingguan | **terverifikasi** | `userLogsAndCache.test.ts`, `authMemory.ts` | *Riwayat Barang Masuk & Keluar* murni mutasi barang; paritas SQL & `authMemory` |
| **Audit Siklus Akun & Tab `Log Aktivitas User`** | Audit penuh akun (`routes/auth.ts`), `GET /api/auth/user-logs`, & `UserActivityLogsTab.tsx` | **terverifikasi** | `userLogsAndCache.test.ts`, `v128Updates.test.ts` (41/41) | Di dalam kartu Kelola User (Admin & Developer `users_manage`); fix `feature_permissions` |
| **Start Production `cross-env`** | Perbarui `"start"` di `package.json` dengan `cross-env NODE_ENV=production` | **terverifikasi** | `npm run lint` & `npm run build` | Kompatibel Windows PowerShell/CMD & Linux/Docker |

## 🚀 Road Map v1.2.9 (Hapus Stok Non-SN Langsung, Rename Tipe, Impor Multi-Tipe, Pindah Barang/Kategori/Tipe, 4-Kartu Pengaturan, & Hapus Kategori)

| Paket / Modul | Deskripsi Cakupan | Status | Pengujian Otomatis | Catatan Kunci |
| :--- | :--- | :--- | :--- | :--- |
| **Hapus Stok Non-SN (`stok_jumlah`)** | `DELETE /api/stock/quantity` & `/quantity/bulk` tanpa kuras transaksi keluar | **terverifikasi** | `v129CatalogAndStock.test.ts` (17/17) | Proteksi `reserved_qty`, konfirmasi Tier 3 `"delete"`, & Kotak Sampah 14H (`stockMemory.ts` fix) |
| **Penamaan & Rename Varian Tipe** | Input `nama_tipe` manual tanpa atribut + rename di `PUT /api/catalog/types/:id/id-rule` & hapus tipe | **terverifikasi** | `v129CatalogAndStock.test.ts`, `tahap2Catalog.test.ts` | Kompatibel mundur atribut lama; wajib token `change_id_rule` bila `id_dikunci = 1` |
| **Impor Multi-Tipe & `Pola_ID`** | Template `.xlsx` multi-baris per produk dengan `Pola_ID` & `Daftar_Serial_Number` tiap tipe | **terverifikasi** | `v129CatalogAndStock.test.ts`, `v128Updates.test.ts` | Satu produk bisa langsung dibuat dengan banyak varian tipe dan aturan ID berbeda |
| **Pindah Storage, Kategori, & Tipe** | `POST /api/catalog/products/move`, `/types/:id/move`, & `POST /api/stock/move` | **terverifikasi** | `v129CatalogAndStock.test.ts` | Pindah unit `per_id`/`jumlah` antar Box & Tipe kompatibel, produk antar kategori, tipe antar produk |
| **4-Kartu Pengaturan & Hapus Kategori** | Ganti *Atur Atribut* dengan 4 kartu tab + keanggotaan kategori manual & hapus kategori Move/Cascade | **terverifikasi** | `v129CatalogAndStock.test.ts` | `DELETE /api/catalog/jenis/:id` mode `move_products` vs `cascade` (tolak jika ada stok aktif) |

---

## 📈 Log Perubahan Status Terkini
- **Tahap 0 s/d Tahap 8 (v1.2.0)**: Fondasi keamanan server-authoritative (`sesi`, `pengaturan`, `token_konfirmasi`, `sampah_hapus`), Katalog bertingkat, Box & stok fisik, antarmuka katalog modern, arsip & restore, siklus request awal, cetak label QR A4 presisi, dan notifikasi Fonnte tuntas & terverifikasi.
- **v1.2.5 (Paket 1 s/d 7 & Solid Refactor)**: Penegakan RBAC terpusat, perbaikan ekspor ExcelJS bebas CWE-1236, konsolidasi menu Tools, kategori `Alat` vs `Barang Habis Pakai` & kondisi item, scanner kamera, template cetak A4, WA Alert berjenjang 15 menit, dan branding logo baru.
- **v1.2.6 (Unifikasi Tunggal, Kontrol Katalog, Multi-Tas, Request `Kembalikan` & `Selesai`, UTC/WIB)**:
  - Menghapus seluruh jalur legacy v1 sehingga aplikasi berjalan 100% di atas satu model kanonik dengan `refreshData()` otomatis, `SCAN_SN` ketat, Keranjang Keluar, akuntabilitas `actor_id` vs `recorded_by_id`, dan koreksi audit append-only.
  - Menambahkan fitur ubah/hapus terproteksi Kategori, Atribut, Produk, dan Box; perbaikan layar blank `BoxContentModal`; alur request **Kembalikan** 3 kondisi + verifikasi gudang; **Multi-Tas Kerja Kantor** (`BAG_TEMPLATE`) + pengajuan **Pilih Paket Tas** (`POST /api/requests/bag`); serta status **Selesai (Terpakai Pelanggan)** khusus `Barang Habis Pakai` (`POST /api/requests/:id/complete`).
- **v1.2.7 (Pengajuan Pembelian Barang, WA 4 Slot ON/OFF, Auto-Refresh 5 Menit, Lembar Pengesahan Dinamis, & MariaDB Strict Auth)**:
  - Menambahkan opsi request ke-3 **Ajukan Pembelian** (`request_type = 'beli'`, migrasi `13`) dengan pemilihan katalog atau ketik barang baru (`tipe_id = NULL`), estimasi harga opsional, serta penguncian notifikasi WA selektif agar hanya `beli` yang mengirim WhatsApp (bukan `ambil`/`kembalikan`).
  - Membatasi penerima WA tepat **4 slot dengan saklar ON/OFF individual**, menerapkan **auto-refresh senyap 5 menit** (`InventoryContext.tsx`), menyediakan kustomisasi dinamis Kop Surat & Lembar Pengesahan produksi (`REPORT_APPROVAL_CONFIG`), serta menuntaskan perbaikan autentikasi MariaDB strict `TIMESTAMP` + diagnostik `setup:test-login`.
- **v1.2.8 (Login-Only & Tutup Registrasi Publik, Peleburan Role `admin`, Izin Fitur Slider ON/OFF, Dual WA Gateway, Hapus Massal + `"delete"`, Impor Excel/Spreadsheet, & `"Data Barang"`)**:
  - Menutup pendaftaran mandiri di halaman login dan `/api/auth/register` (`403`), melebur `admin` + `warehouse_admin` menjadi peran tunggal `admin` yang terbatas mengelola akun `admin` & `technician`, menambahkan panel **Atur Fitur** slider ON/OFF khusus `developer` (`feature_permissions`), menyediakan **Dual WhatsApp Gateway** ON/OFF khusus `developer`, melengkapi hapus massal multi-pilih dengan konfirmasi ketik **`delete`** di ke-5 target katalog/stok, menghadirkan fitur **Impor Excel/Google Spreadsheet Publik**, serta menyelaraskan istilah *"Suku Cadang"* → **"Data Barang"**.
- **v1.2.8.5 (Anti-Cache & Silent Production Auto-Update, Pemisahan Log User ke Kartu Kelola User, & Start Production `cross-env`)**:
  - Menyelesaikan masalah browser tertahan di cache build lama (`__APP_BUILD_ID__`, `build-meta.json`, header `no-store`, Workbox `skipWaiting`, & `appUpdater.ts`), memisahkan seluruh log login/logout/sesi/akun (`USER_ACTIVITY_ACTIONS`) ke endpoint `GET /api/auth/user-logs` & tab **`Log Aktivitas User`** di kartu Kelola User, serta memperbarui `npm start` dengan `cross-env`.
- **v1.2.9 (Hapus Stok Non-SN Langsung, Rename Tipe, Impor Multi-Tipe, Pindah Barang/Kategori/Tipe, 4-Kartu Pengaturan, & Hapus Kategori Move/Cascade)**:
  - Memungkinkan hapus langsung parsial/penuh/massal stok non-SN (`DELETE /api/stock/quantity*`) ke Kotak Sampah 14 hari dengan proteksi `reserved_qty`, penamaan manual & rename varian Tipe di `Atur ID`, impor `.xlsx` multi-baris per produk lengkap dengan kolom `Pola_ID` terpisah per tipe, pemindahan produk antar kategori (`/products/move`), tipe antar produk (`/types/:id/move`), dan unit `per_id`/`jumlah` antar Box/Tipe (`/stock/move`).
  - Mengganti *Atur Atribut* pada `Kelola & Pengaturan` dengan **4 kartu pengaturan** (termasuk keanggotaan kategori manual & operasi massal) sekaligus menghapus kategori dengan pilihan **pindah produk** atau **hapus cascade**, serta perbaikan handler `DELETE FROM STOK_JUMLAH` di `stockMemory.ts`. Terverifikasi melalui `v129CatalogAndStock.test.ts` (17/17 PASS), `userLogsAndCache.test.ts` (24/24 PASS), `v128Updates.test.ts` (41/41 PASS), `npm run lint`, dan `npm run build`.
