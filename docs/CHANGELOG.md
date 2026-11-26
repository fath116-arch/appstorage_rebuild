# CHANGELOG.md - Riwayat Versi & Perubahan FieldOps IT

![Version](https://img.shields.io/badge/version-v1.2.8.5-emerald.svg)

Semua perubahan penting dan riwayat rilis proyek **FieldOps IT** dicatat secara kronologis dalam file ini.

---

## 🚀 [v1.2.8.5] - Pembaruan Otomatis Senyap Production, Anti-Cache PWA/Proxy, Pemisahan Log Aktivitas User ke Kartu Kelola User, & Kompatibilitas Start Production - 2026-11-26
Fokus rilis pemeliharaan & penyempurnaan dari pembaruan 6 jam terakhir hingga rilis terbaru:
- **1. Kontrol Cache Production & Muat Ulang Otomatis Senyap Tanpa Hapus Cache Browser Manual**:
  - **Identitas Build & Workbox PWA (`frontend/vite.config.ts`, `frontend/src/vite-env.d.ts`)**: Menghasilkan `__APP_BUILD_ID__` unik tiap build dan `dist/build-meta.json` (`fieldops-build-meta`), mengaktifkan `skipWaiting: true`, `clientsClaim: true`, dan `cleanupOutdatedCaches: true`, mengecualikan `/build-meta.json` & `/api/*` di `navigateFallbackDenylist`, memperbaiki `devOptions.enabled: true` (boolean), serta menyelaraskan deskripsi manifest PWA menjadi `"data barang"`.
  - **Header Anti-Cache Server & `/api/health` (`backend/src/server.ts`)**: `GET /api/health` mengekspos `version: '1.2.8.5'`, `buildId`, & `builtAt` tanpa cache. Shell `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest`, `build-meta.json`, dan `workbox-*.js` dikirim dengan `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, sedangkan aset hash `/assets/*` tetap di-cache 1 tahun `immutable`.
  - **Auto-Updater Aman (`frontend/src/utils/appUpdater.ts`, `frontend/src/main.tsx`)**: Mengecek pembaruan Service Worker & membandingkan `buildId` server saat buka halaman, `visibilitychange`, `focus`, dan interval 5 menit. Jika versi berubah, browser membersihkan cache lama dan reload senyap hanya saat tidak ada modal (`z-50`/`[role="dialog"]`) atau input aktif, dengan jeda anti-loop 30 detik di `sessionStorage`.
- **2. Pemisahan Log Aktivitas Login/Logout, Sesi, & Manajemen Akun ke Kartu Kelola User**:
  - **Isolasi Feed Inventaris (`activityLogService.ts`, `authMemory.ts`)**: Mengecualikan `USER_ACTIVITY_ACTIONS` (`login`, `logout`, `cabut_sesi_otomatis`, `deteksi_token_reuse`, `cabut_seluruh_sesi_admin`, `buat_akun`, `setujui_akun`, `tolak_akun`, `ubah_status_akun`, `ubah_akses_fitur`, `reset_sandi`, `hapus_akun`) secara bawaan dari `GET /api/activities` & `GET /api/reports/weekly` agar *Riwayat Barang Masuk & Keluar* murni berisi mutasi barang/operasional; menyelaraskan kueri `IN` / `NOT IN`, pencarian `LIKE`, & pengayaan `username_pelaku` pada adapter memori `authMemory.ts`.
  - **Audit Akun Lengkap & Endpoint `GET /api/auth/user-logs` (`routes/auth.ts`)**: Mencatat audit non-blocking seluruh aksi manajemen akun (`buat_akun`, `setujui_akun`, `tolak_akun`, `ubah_status_akun`, `reset_sandi`, `hapus_akun`), memperbaiki `PUT /api/auth/users/:id/features` agar kompatibel dengan payload `feature_permissions` maupun `featurePermissions` + reset `null`, serta menambahkan `GET /api/auth/user-logs` (`requireAuth` + `requireFeature('users_manage')`, Admin & Developer) dengan filter kategori (`all` | `auth` | `session` | `account`) dan pencarian.
  - **Tab `Log Aktivitas User` di Kartu Kelola User (`UserActivityLogsTab.tsx`, `UserRoleSwitcher.tsx`, `api.ts`)**: Menyajikan log otentikasi, sesi, & manajemen akun di dalam kartu **Kelola User** dengan filter kategori, pencarian, timestamp WIB `tabular-nums`, lencana semantik, skeleton loading, & state kosong/error.
- **3. Start Production Cross-Platform & Pengujian (`package.json`, `userLogsAndCache.test.ts`)**:
  - Memperbarui skrip `"start"` menjadi `cross-env NODE_ENV=production tsx backend/src/server.ts`.
  - Terverifikasi melalui `backend/src/tests/userLogsAndCache.test.ts` (**24/24 LULUS**), `v128Updates.test.ts` (**41/41 LULUS**), `npm run lint`, & `npm run build`.

---

## 🚀 [v1.2.8] - Login-Only & Tutup Registrasi Publik, Peleburan Role Admin, Izin Fitur Slider ON/OFF (Developer), Dual WA Gateway, Hapus Massal + Konfirmasi "delete", Impor Excel/Google Sheet, & Istilah "Data Barang" - 2026-11-24
- **1. Layar Login Khusus Masuk (Tutup Pendaftaran Publik)**:
  - Menghapus fitur pendaftaran mandiri dari `LoginScreen.tsx` (hanya Login & Lupa Kata Sandi) dan menutup `POST /api/auth/register` (`HTTP 403 Forbidden`); pembuatan akun hanya melalui dalam aplikasi oleh Admin/Developer atau CLI server `npm run setup:admin`.
- **2. Peleburan Role `admin` & `warehouse_admin` Menjadi 1 Role `admin` (`14_v128_rbac_wa2_and_features.sql`, `permissions.ts`)**:
  - Konsolidasi peran menjadi 3 peran kanonis (`developer`, `admin`, `technician`) dengan normalisasi otomatis alias legacy (`warehouse_admin`/`supervisor`/`superadmin`).
  - Role `admin` memiliki wewenang operasional harian bawaan dan pengelolaan akun terbatas hanya untuk `admin` dan `technician` (`HTTP 403` untuk akun `developer`).
- **3. Izin Fitur Per Akun dengan Slider ON/OFF (Khusus `developer`)**:
  - Menambahkan `users.feature_permissions`, `PUT /api/auth/users/:id/features`, penegakan middleware `requireFeature()`, dan UI **Atur Fitur** dengan saklar slider ON/OFF murni per akun serta tombol **Reset ke Bawaan Peran**.
- **4. Dual WhatsApp Gateway Bersaklar ON/OFF (Khusus `developer`)**:
  - Menambahkan `wa_config.gateways_json` (`gateway1`, `gateway2`) & `wa_config.gateway_mode` (`failover`/`primary_only`/`broadcast_both`) serta `POST /api/whatsapp/test-gateway` yang hanya bisa diakses `developer`, sementara `admin` tetap mengelola 4 slot penerima ON/OFF & ambang.
- **5. Hapus Massal Multi-Pilih & Konfirmasi Ketik `"delete"`**:
  - Konfirmasi Tier 3 pada `ConfirmDeleteModal.tsx` & `ConfirmationService` disederhanakan menjadi mengetik kata **`delete`**, disertai multi-pilih hapus massal pada **Produk**, **Kategori**, **Atribut**, **Storage Box**, dan **Item Fisik Ber-ID**.
- **6. Impor Excel (`.xlsx`/`.csv`) & Google Spreadsheet Publik (`/api/import/*`)**:
  - Menyediakan unduhan Template Excel resmi, pratinjau validasi, dan impor atomik Katalog + Box + Stok Awal (`ImportService`, `CatalogImportModal.tsx`).
- **7. Perubahan Istilah `"Suku Cadang"` → `"Data Barang"`** di seluruh antarmuka, laporan, dan ekspor.

---

## 🚀 [v1.2.7] - Pengajuan Pembelian Barang, WA 4 Slot ON/OFF, Auto-Refresh 5 Menit, Lembar Pengesahan Dinamis, & MariaDB Strict Auth - 2026-11-23
- **1. Request Pengajuan Pembelian Barang (`request_type = 'beli'`) & Notifikasi WA Selektif**:
  - **Opsi Baru `Ajukan Pembelian` (`13_purchase_wa4_and_report_config.sql`, `TechnicianRequestsView.tsx`, `requestService.ts`)**: Menambahkan jenis permohonan ke-3 di samping `Ambil Barang` (`ambil`) dan `Kembalikan` (`kembalikan`). Pengguna dapat memilih barang/varian dari katalog maupun mengetik nama barang baru non-katalog (`tipe_id = NULL`), mengisi **Jumlah**, **Estimasi Harga (Rp)** opsional, serta **Alasan Pengajuan**.
  - **Persetujuan Pengadaan Tanpa Memotong Stok**: Admin dan Admin Gudang dapat menyetujui (*Setujui Pembelian*) tanpa memotong atau mereservasi stok fisik gudang, dan menandainya selesai (`Sudah Dibeli`, `return_condition = 'Dibeli'`) setelah pengadaan tuntas; jalur `pickup` gudang dikunci agar tidak memproses pengajuan pembelian.
  - **Notifikasi WhatsApp Selektif (`notificationService.ts`)**: Pengiriman notifikasi WhatsApp otomatis (`notifyPurchaseRequest`) kini **hanya** dipicu pada pengajuan pembelian barang (`beli`). Permohonan **Ambil Barang** (`ambil` maupun paket tas) dan **Kembalikan** tidak lagi mengirim notifikasi ke WhatsApp.
- **2. Batas 4 Slot Penerima WhatsApp + Saklar ON/OFF Individual (`WaConfigTab.tsx`, `whatsappAlertService.ts`, `whatsappService.ts`)**:
  - Mengganti daftar penerima bebas menjadi tepat **4 slot terstruktur** (`Slot 1..4`, disimpan di kolom baru `wa_config.recipient_slots_json`) dengan label keterangan, nomor HP/ID grup, tombol bersihkan cepat, proteksi nomor duplikat, serta **saklar ON/OFF individual** per slot.
  - Hanya slot bersaklar **ON** yang disinkronkan ke daftar penerima aktif (`recipients` / `getTargetPhoneNumbers()`); bila keempat slot bersaklar **OFF**, sistem mengembalikan daftar kosong tanpa fallback ke `.env`.
- **3. Auto-Refresh Senyap Setiap 5 Menit (`InventoryContext.tsx`)**:
  - Menambahkan sinkronisasi latar belakang otomatis setiap 5 menit (`300.000 ms`) secara senyap (tanpa *loading spinner* pengganggu maupun toast error) yang sadar visibilitas tab (`visibilitychange`), sehingga tab yang sempat tidak aktif langsung diperbarui saat dibuka kembali jika sudah melewati interval 5 menit.
- **4. Lembar Pengesahan Produksi Dinamis (`GET/PUT /api/reports/approval-config`, `WeeklyReport.tsx`, `PrintReportModal.tsx`, `PrintDocumentModal.tsx`)**:
  - Tata letak cetak A4 pada versi production dan development dipastikan identik.
  - Kop Surat (*Nama Perusahaan, Divisi, Alamat*) serta 3 kolom penandatangan (*Dibuat Oleh, Diperiksa Oleh, Disetujui Oleh*) kini dibaca secara dinamis dari `pengaturan.REPORT_APPROVAL_CONFIG`, dapat disesuaikan langsung melalui panel editor **Sesuaikan Kop & Penandatangan** (termasuk saklar *Gunakan nama akun login* per penandatangan) dan disimpan permanen oleh pengelola.
- **5. Perbaikan Autentikasi & Sesi MariaDB Strict Mode serta Diagnostik Tes Login (`setup:test-login`)**:
  - **Format `TIMESTAMP` UTC SQL & Sanitasi IP Proxy (`authService.ts`, `sessionService.ts`, `activityLogService.ts`, `confirmationService.ts`, `trashService.ts`, `dataConsolidationService.ts`, `authMemory.ts`, `timezone.ts`)**: Memperbaiki kegagalan autentikasi HTTP 500 saat login ke MariaDB dengan mengganti string ISO `'...Z'` dan objek `Date` mentah menjadi format SQL UTC ketat `YYYY-MM-DD HH:mm:ss` (`toMysqlUtcSeconds`) di seluruh kolom `TIMESTAMP` (`sessions.expires_at`, `sesi.kedaluwarsa_mutlak`, `transaksi.waktu`, `token_konfirmasi.expires_at`, `sampah_hapus.purge_setelah`) serta membaca ulang secara konsisten dengan `parseToDate`; mengekstrak & memangkas header `x-forwarded-for` Cloudflare Tunnel agar selalu muat di kolom `VARCHAR(45)` (`sanitizeClientIp`); dan membungkus pencatatan log login agar tidak menggagalkan otentikasi bila ledger `transaksi` mengalami kendala.
  - **Atribut Cookie Adaptif & Konsistensi `setup:admin` (`routes/auth.ts`, `setupAdmin.ts`, `database.ts`)**: Atribut `; Secure` pada cookie sesi kini hanya dipasang pada permintaan HTTPS aktual (`req.secure` / `x-forwarded-proto: https`) agar login via HTTP lokal/LAN maupun HTTPS Cloudflare Tunnel berjalan mulus; skrip `setup:admin` diselaraskan menggunakan `parseCliArgs()`, trimming sandi konsisten, dan verifikasi hash pasca-simpan; serta penambahan penanda `Strict TIMESTAMP SQL Compat` pada log koneksi MariaDB.
  - **Diagnostik Tes Login Akun CLI & Web (`setup:test-login`, `/api/setup/test-login`, `SystemCheckPanel.tsx`)**: Menambahkan alat uji diagnostik login 6 tahap (Runtime DB → Lookup `users` → Status `ACTIVE` → Verifikasi PBKDF2 → Probe tulis/cleanup tabel `sessions` & `sesi` → Kesiapan `transaksi`) di terminal dan tab **Setting** tanpa membocorkan hash/salt.

---

## 🚀 [v1.2.6] - Unifikasi Model Data Tunggal, Alur Output & Request Teknisi, Akuntabilitas Audit, & Zona Waktu UTC/WIB - 2026-11-15
- **1. Unifikasi Satu Model Data Kanonik (Penghapusan Pemisahan v1/v2)**:
  - Menghapus seluruh endpoint, service, repository, modal, dan data dummy v1 (`/api/inventory`, `/api/transactions`, `inventoryService`, `transactionService`, `legacyMigrationService`, `mockData.ts`, `ItemFormModal`, `ItemDetailModal`, `CategoryManager`) serta meniadakan label `v1`/`v2` dari UI.
  - Seluruh menu (Dashboard, Katalog, Input Barang Masuk, Output Barang Keluar, Request Teknisi, Riwayat Transaksi, & Laporan Mingguan) membaca satu sumber kebenaran kanonik (`jenis` → `produk` → `tipe` → `item` / `stok_jumlah` → `transaksi` & `transaksi_detail` → `request`).
  - Setiap mutasi otomatis menyinkronkan `InventoryContext.refreshData()` tanpa perlu muat ulang manual.
- **2. Alur Input, Ekstraksi Ketat `SCAN_SN`, & Output Keranjang Keluar**:
  - **Input (`StockInputModal`) & Koreksi Aturan ID**: Validasi regex `SCAN_SN` per token hasil pemindaian foto/kamera tanpa pernah fallback ke MAC/D-SN/raw scan, kolom interaktif **Uji Regex**, teks bantuan pola `^ZTEGD[0-9A-Fa-f]{7}$`, peringatan bila pola dikosongkan, serta perbaikan tampilan kondisional pada modal Koreksi Aturan ID.
  - **Output (`StockInOutModal`)**: Pencarian terpadu (debounce 300ms) berdasarkan SN/produk/tipe/box, integrasi scanner bersama, proteksi item berkondisi `Rusak` dan item reservasi `dipesan`, dukungan **Keranjang Keluar** multi-item, serta pembatasan jumlah `TANPA_ID` sesuai stok tersedia.
- **3. Akuntabilitas Pelaku (`actor_id`) vs Pencatat (`recorded_by_id`) & Ledger Koreksi Append-Only**:
  - Pemisahan kolom `actor_id`/`actor_nama`, `recorded_by_id`/`recorded_by_nama`, `is_on_behalf`, dan `on_behalf_reason` (wajib minimal 3 karakter, khusus `developer`/`admin`/`warehouse_admin` via `GET /api/auth/actors`).
  - Validasi waktu kejadian (`occurred_at`): dilarang di masa depan; batas maksimal 7 hari ke belakang untuk `warehouse_admin` dan bebas untuk `admin`/`developer`.
  - Fitur **Catat Koreksi Audit** pada `TransactionHistory.tsx` (`POST /api/activities/:id/correct`) secara append-only (`correction_of_id`) tanpa pernah mengubah/menghapus log transaksi historis.
- **4. Siklus Request Teknisi Terintegrasi & *"Barang di Tangan Teknisi"***:
  - Migrasi `12_unify_single_model_and_wib.sql`: memperluas siklus request menjadi `diajukan` → `disetujui` (reservasi `'dipesan'` / `reserved_qty`) → `diambil` (`'keluar'`, `taken_at`, via `POST /api/requests/:id/pickup`) → `dikembalikan` (`'aktif'` + kondisi barang, wajib untuk `Alat`, via `POST /api/requests/:id/return`) | `ditolak` | `dibatalkan` (melepas reservasi).
  - Menambahkan endpoint `GET /api/requests/held`, `GET /api/requests/open-for-actor/:actorId`, dan `GET /api/requests/:id/timeline`, serta integrasi 1-klik **"Hubungkan ke Request"** pada pencatatan Output atas nama teknisi.
- **5. Kebijakan Zona Waktu Ketat (Simpan UTC ↔ Tampilkan & Laporkan WIB / `Asia/Jakarta`)**:
  - Utilitas terpadu `timezone.ts` di backend dan frontend: penyimpanan UTC penuh (`process.env.TZ = 'UTC'`), tampilan konsisten `DD/MM/YYYY HH:mm WIB`, dan perhitungan Laporan Mingguan tepat pada rentang **Senin 00:00:00.000 WIB – Minggu 23:59:59.999 WIB** (`GET /api/reports/weekly`).
  - Ekspor Excel (`excelExporter.ts`) menyematkan serial tanggal wall-clock WIB (`dd/mm/yyyy hh:mm`) dengan kolom `Waktu Kejadian (WIB)` dan sanitasi **CWE-1236** penuh (`sanitizeFormulaInput()`).
  - Menambahkan panel verifikasi jam server (`GET /api/reports/debug-clock`) di `WeeklyReport.tsx` dan membersihkan seluruh tanggal hardcoded `2026`.
- **6. Pemangkasan Memory Adapter & Pengujian Kanonik**:
  - Pembaruan `stockMemory.ts` (matching `SJ.TIPE_ID`, `COALESCE(reserved_qty, 0) - ?`, literal `R.STATUS = 'DIAMBIL'`, dan `WHERE TIPE_ID = ? AND STATUS = 'DIPESAN'`) serta `legacyMemory.ts`.
  - Verifikasi suite `canonicalSystem.test.ts` (19/19 LULUS), `tahap6Requests.test.ts` (17/17 LULUS), `scanSnExtraction.test.ts` (6/6 LULUS), `tahap2Catalog.test.ts` (13/13), `tahap3Stock.test.ts` (17/17), `tahap4CatalogView.test.ts` (14/14), `tahap5ArchiveRestore.test.ts` (15/15), `v125Paket3Tools.test.ts` (24/24), dan `testReportsAndChecklists.ts` (LULUS).
- **7. Kontrol Hapus & Ubah Katalog, Perbaikan Buka Isi Box, serta Alur Request "Kembalikan"**:
  - **Hapus Terproteksi Data Aktif (Kategori, Produk, Storage Box, Atribut)**: Menambahkan tombol & endpoint hapus (`DELETE /api/catalog/jenis/:id`, `/api/catalog/attributes/:id`, `/api/catalog/products/:id`, `/api/boxes/:id`) yang menolak penghapusan jika masih ada isi stok aktif/dipesan, request terbuka, produk aktif, atau pemakaian oleh varian tipe aktif. Kategori/Produk/Box kosong dipindahkan ke Kotak Sampah 14 hari dengan konfirmasi Tingkat 3 melalui modal in-app (`ConfirmDeleteModal.tsx`).
  - **Modifikasi Kategori & Atribut di Subtab Kelola**: Menambahkan aksi **Ubah** pada Kategori (`PUT /api/catalog/jenis/:id`) dan Atribut (`PUT /api/catalog/attributes/:id`), termasuk pengelolaan opsi dropdown (`pilihan`) dengan proteksi agar `tipe_isian` maupun opsi yang sedang dipakai varian aktif tidak berubah/terhapus sembarangan.
  - **Perbaikan Buka Isi Box (`BoxContentModal.tsx`)**: Memperbaiki crash layar blank (*React Rules of Hooks* — pemanggilan `useEffect` setelah `return null`), menambahkan penangan error muat & muat ulang otomatis, serta beralih ke `catalogApi.updateItemCondition`.
  - **Form Request "Ambil" vs "Kembalikan" & 3 Kondisi Terpetakan (`TechnicianRequestsView.tsx` & `requestService.ts`)**: Menambahkan opsi **Kembalikan** pada form pembuatan request dengan pemilih barang yang sedang dibawa (`diambil`), pencegahan duplikasi pengajuan, box tujuan pengembalian, serta 3 opsi kondisi (**Belum Terpakai** → `Baru`, **Normal** → `Baik`, **Rusak** → `Rusak`). Pengelola gudang memverifikasi penerimaan lewat tombol **Verifikasi & Terima** yang memulihkan stok dan menutup request pengembalian beserta request pengambilan asal sebagai `dikembalikan`, tanpa perubahan skema MariaDB serta mengganti `window.prompt` penolakan menjadi modal in-app.
- **8. Multi-Tas Kerja Lapangan & Status "Selesai (Terpakai Pelanggan)"**:
  - **Multi-Tas Kerja Kantor (`bagService.ts`, `/api/checklists/bags`, `FieldTripChecklistModal.tsx`)**: Mendukung pembuatan, pengubahan, dan penghapusan beberapa paket **Tas Kerja** kantor dari satu sumber Katalog menggunakan tabel `checklists` (`inspection_type = 'BAG_TEMPLATE'`) tanpa mengubah skema MariaDB, terhubung ke subtab inspeksi harian.
  - **Pilih Satuan vs Paket Tas di Request (`POST /api/requests/bag`, `TechnicianRequestsView.tsx`)**: Pada form pengambilan request, pengguna dapat memilih **Alat / Barang Satuan** atau **Pilih Paket Tas** untuk mengajukan seluruh alat di dalam tas sekaligus lengkap dengan validasi stok live sebelum pengiriman dan penanda `[Tas: <Nama Tas>]`.
  - **Status `Selesai (Terpakai Pelanggan)` Khusus Barang Habis Pakai (`POST /api/requests/:id/complete`, `requestService.ts`)**: Baik teknisi pemilik maupun pengelola gudang dapat menandai barang habis pakai (modem/material) yang sedang dipegang (`diambil`) sebagai `selesai` dengan pengisian wajib **Nama / ID Pelanggan** dan **Catatan Pemasangan**; barang kategori `Alat` tetap dikunci wajib kembali (`dikembalikan`), dan log dicatat pada timeline request & `ActivityLog` (`selesai_request`).
- **9. Tab Setting Terpadu, Suite Skrip Setup CLI Interaktif, & Akses Selektif Admin Gudang**:
  - **Suite Skrip Setup & Diagnostik CLI (`backend/src/scripts/setup*.ts`, `package.json`)**: Menambahkan `npm run setup:db`, `npm run setup:tunnel`, `npm run setup:wa`, `npm run setup:check`, dan `npm run setup:help` / `setup:list` (mendukung mode interaktif & flag non-interaktif) sejajar dengan `npm run setup:admin`.
  - **Backend `SystemSetupService` & Route `/api/setup/*`**: Mengelola penyimpanan aman variabel `.env` lokal (anti-injeksi CRLF/null-byte + *secret masking*), reload pool koneksi MariaDB tanpa restart proses, validasi/decode token Cloudflare Tunnel & uji URL publik `/api/health`, sinkronisasi WhatsApp Fonnte ke `.env` + `wa_config`, serta diagnostik live 5 lapis sistem.
  - **Tab Setting Web (`SettingsHub.tsx`, `SystemCheckPanel.tsx`, `DatabaseSetupPanel.tsx`, `TunnelSetupPanel.tsx`)**: Mengonsolidasikan kartu **Status & Cek Sistem**, **Koneksi Database MariaDB**, **Cloudflare Tunnel**, **Notifikasi WhatsApp Alert**, **Manajemen Pengguna**, **Pengaturan Pola SN**, **Database, Backup & Sampah**, **Laporan Keamanan & Audit**, serta **Integrasi Tiket Eksternal** dalam tampilan penuh inline dengan tombol Kembali. Menu dropdown **Tools** dirapikan khusus untuk alat operasional harian (*Akses HP & QR Code*, *Ekspor Katalog Excel*, *Cetak Label Batch A4*).
  - **Akses Selektif `warehouse_admin` & Dokumentasi Skrip (`docs/SKRIP_CLI.md`)**: Memberikan akses tab **Setting** terbatas untuk `warehouse_admin` khusus kartu **Notifikasi WhatsApp Alert** (penerima/ambang/log tanpa token Fonnte) dan **Pengaturan Pola Serial Number (SN)** (`POST/PUT/DELETE /api/sn-patterns` diperbarui di backend), serta menambahkan panduan lengkap seluruh skrip NPM & CLI di `docs/SKRIP_CLI.md`.
  - **Perbaikan Migrasi Tabel `request`, Sinkronisasi Skrip `backend/`, & Resolusi `.env` Berjenjang**: Memperbaiki mismatch foreign key `request.tipe_id` pada `07_v2_request_schema.sql` menjadi `INT UNSIGNED NOT NULL` (sesuai `tipe.id`) beserta indeks idempoten di `07`/`12` untuk menghilangkan galat MariaDB `errno: 150`; menyinkronkan seluruh perintah `setup:*`, `sampah`, dan `test:backup` ke `backend/package.json` serta mengganti path `process.cwd()` ke `PROJECT_ROOT_DIR`; dan menetapkan `.env` root sebagai berkas konfigurasi utama/tulis dengan fallback baca otomatis ke `backend/.env`.
*(Untuk catatan rilis menengah `v1.2.5`, lihat pula [`CHANGELOG.md`](../CHANGELOG.md) di root repositori.)*

---

## 🛡️ [v1.2.0-tahap1] - 2026-11-06 (FieldOps v2 Foundation: Sesi Server, Konfirmasi Bertingkat, ID Mutasi & Sampah 14 Hari)

### 🔑 Sesi Server-Authoritative & Rotasi Token (SECURITY_GUIDE.md Bagian 1)
- **Tabel `sesi` Server-Authoritative**: Token sesi disimpan dan divalidasi langsung di sisi server dengan cookie HttpOnly (`fieldops_access`, `fieldops_refresh`, `fieldops_device`).
- **Access Token 900 Detik & Rotasi Refresh Token**: Access token berumur pendek (15 menit) dengan refresh token yang dirotasi otomatis di setiap pemakaian (`POST /api/auth/refresh`).
- **Deteksi Anti-Replay & Token Copying**: Upaya pemakaian ulang refresh token lama yang sudah dirotasi akan otomatis mencabut seluruh sesi pengguna demi keamanan.
- **Device ID Hash & Kuota Sesi Tunggal**: Cookie `fieldops_device` terpisah untuk validasi perangkat dan penegakan batas 1 sesi aktif per akun (`MAX_SESI_PER_AKUN`), di mana login baru otomatis mencabut sesi lama.
- **Batas Kedaluwarsa Idle (30 Menit) & Mutlak (12 Jam)**: Sesi otomatis dinonaktifkan jika tidak ada aktivitas selama 30 menit atau melampaui batas 12 jam.

### 🛡️ Penegakan Konfirmasi Sensitif Bertingkat (Tingkat 0 s/d 3)
- **Konfirmasi Server-Enforced**: Menerapkan token konfirmasi sekali pakai (`token_konfirmasi`, TTL 120 detik) via endpoint `POST /api/auth/confirm-token`.
- **Tingkat 2**: Wajib mengetik kata `"approve"` (persetujuan request, mutasi massal).
- **Tingkat 3**: Wajib mengetik nama objek persis + kata sandi ulang jika login > 15 menit (hapus permanen, ubah role, koreksi ID, hapus produk/tipe/box).
- **Middleware `requireConfirmation`**: Endpoint aksi sensitif menolak permintaan tanpa token konfirmasi sah dari server.

### 📋 Log Transaksi & Mutasi Format `AKT-YYYYMMDD-NNNN`
- **Tabel `transaksi` & `transaksi_detail`**: Format ID Aktivitas unik `AKT-YYYYMMDD-NNNN` dengan nomor urut harian otomatis.
- **Prinsip Append-Only**: Log mutasi tidak dapat diubah atau dihapus lewat antarmuka aplikasi. Menyimpan `nama_snapshot` agar riwayat tetap valid walau master data berubah.

### 🗑️ Tempat Sampah Hapus Permanen (Retensi 14 Hari) & CLI Pemulihan
- **Tabel `sampah_hapus`**: Snapshot JSON objek asli beserta data turunannya disimpan selama 14 hari (`RETENSI_SAMPAH_HARI`) sebelum pemusnahan total.
- **Perintah CLI Terminal `npm run sampah`**:
  - `npm run sampah -- --list`: Menampilkan daftar entri di tempat sampah beserta sisa hari retensi.
  - `npm run sampah -- --pulihkan <id> --dry-run`: Uji coba pemulihan tanpa mengubah data.
  - `npm run sampah -- --pulihkan <id>`: Eksekusi pemulihan utuh dengan pemeriksaan konflik dan pencatatan audit log oleh pelaku `terminal`.
  - `npm run sampah -- --purge`: Pembersihan otomatis entri sampah yang melewati masa 14 hari.

### ⚙️ Konfigurasi Dinamis Bebas Hardcode (`pengaturan`)
- **Tabel `pengaturan` & `SettingService`**: Parameter sistem (`ACCESS_TOKEN_TTL_DETIK`, `IDLE_TIMEOUT_MENIT`, `ABSOLUTE_TIMEOUT_JAM`, `MAX_SESI_PER_AKUN`, `REAUTH_MENIT`, `RETENSI_SAMPAH_HARI`, `CONFIRMATION_TIERS`) dimuat secara dinamis dari database/environment.
- **Endpoint Manajemen Pengaturan**: `GET /api/auth/settings` dan `PUT /api/auth/settings/:key` untuk Developer & Admin.

---

## 🌟 [v1.1.0] - 2026-11-05 (Soft Delete Recycle Bin, Production Auth & Demo Removal)

### 🗑️ Modul Antarmuka Kotak Sampah (Soft Delete Recycle Bin & Restore)
- **Komponen `TrashModal.tsx`**: Antarmuka visual khusus untuk mengelola barang inventori yang dihapus sementara (*soft-deleted*).
- **Pemulihan Barang (1-Click Restore)**: Admin dan Supervisor dapat memulihkan barang kembali ke katalog aktif kapan saja tanpa merusak nomor SKU, riwayat mutasi masuk/keluar, maupun audit trail transaksi.
- **Pemusnahan Permanen (Hard Delete)**: Opsi penghapusan permanen dari database MariaDB dengan dialog konfirmasi keamanan via endpoint `DELETE /api/inventory/items/:id/permanent`.
- **Integrasi Tombol Katalog**: Tombol "Kotak Sampah" lengkap dengan indikator badge jumlah item yang berada di tempat sampah pada toolbar katalog inventori.

### 🔐 Penyempurnaan Autentikasi Internal & Penghapusan Akun Demo
- **Penghapusan Fitur Akun Demo**: Tombol pembantu preset demo pada layar login (`LoginScreen.tsx`) telah dihapus total guna kesiapan sistem produksi riil.
- **Otentikasi Internal Fleksibel**: Mesin verifikasi kata sandi (`authService.ts`) mendukung format kata sandi langsung (*plain-text*) maupun *hash PBKDF2* (100.000 iterasi). Staf IT dapat membuat akun via skrip `npm run setup:admin`, API endpoint `POST /api/auth/users`, atau query SQL manual di database MariaDB tanpa risiko terkunci.
- **Pencarian Username Bebas Sensitivitas Karakter**: Mendukung login dengan toleransi huruf besar/kecil (`case-insensitive`) dan pembersihan spasi otomatis.

---

## 🚀 [v1.0.0-rebuild] - 2026-11-03 (Full On-Premise Rebuild & MariaDB Migration)

### 🏗️ Rebuild Total Arsitektur On-Premise Single-Office
- **Penghapusan Total Firebase**: Menghapus 100% Firebase Authentication, Firestore SDK, `firestore.rules`, `firebase-blueprint.json`, dan `firebase-applet-config.json`. Seluruh aplikasi berjalan mandiri di server lokal.
- **Penghapusan Konsep Multi-Tenant & Workspace**: Menghapus selector workspace, kolom `workspace_id`, dan tipe `DatabaseWorkspace`. Aplikasi dikonsolidasi untuk 1 kantor/kantor cabang ISP tunggal.
- **Database MariaDB 11.x & Pemisahan 2 File Data**: Mengadopsi MariaDB 11.x via Express 5 & TypeScript dengan struktur skema terisolasi 100% antara data autentikasi (`01_auth_schema.sql` / `auth_seed.json`) dan data bisnis inventaris (`02_inventory_schema.sql` / `items_seed.json`).
- **Autentikasi Server-Authoritative & Sesi Cookie**: Otentikasi berbasis HTTP-only session cookie dengan algoritma PBKDF2 SHA-256 (100.000 iterasi + 16-byte random salt). Perlindungan brute-force rate-limiting dan verifikasi peran server-side pada setiap REST endpoint.
- **Konsolidasi WhatsApp Gateway (Fonnte)**: Menyatukan modul notifikasi WhatsApp ke dalam `backend/src/integrations/whatsapp/` (`provider.ts`, `fonnte.ts`, `templates.ts`) dan `backend/src/routes/whatsapp.ts`. Menghapus duplikasi kode legacy pada `server/whatsapp-gateway.js`.
- **Integrasi REST API Auto-Deduct Tiket Lapangan**: Endpoint `/api/tickets/consume` dengan enkripsi Bearer token untuk auto-deduct stok dari Jira, Zendesk, GLPI, atau aplikasi mobile teknisi.
- **Layanan Backup & Pemulihan Tanpa Kebocoran Kredensial**: `backupService.ts` menghasilkan ekspor JSON murni data bisnis (barang & transaksi) tanpa menyertakan kredensial atau hash akun pengguna (`Zero Account Leakage`).
- **Sanitasi Ekspor Data (CWE-1236)**: Mempertahankan fungsi `sanitizeFormulaInput()` pada ekspor CSV, Excel, dan PDF untuk mencegah serangan formula injection.
- **Dukungan Akses Jarak Jauh Cloudflare Tunnel**: Konfigurasi `docker-compose.yml` dan dokumen `docs/DEPLOY.md` untuk akses HTTPS jarak jauh aman melalui Cloudflare Tunnel tanpa membuka port MariaDB ke internet publik.

---

## 🔒 [v0.3.1] - 2026-10-30 (Security Remediation Release)

### 🛡️ Remidiasi Menyeluruh Temuan Audit Keamanan (SEC-01 s/d SEC-05)
- **`[SEC-01]` Pengerasan Aturan Firestore**: Mengganti aturan terbuka publik `allow read, write: if true;` dengan aturan autentikasi wajib `isSignedIn()` (`request.auth != null`) serta validasi panjang `isValidId()` untuk seluruh koleksi `workspaces/{workspaceId}/**`. Mengisolasi tes koneksi diagnostik pada `/test/{docId}`. Aturan berhasil dideploy ke Firebase.
- **`[SEC-02]` Enforce RBAC Otoritas Server-Side**: Menambahkan endpoint backend `POST /api/security/verify-action` untuk memverifikasi tindakan administratif destruktif (seperti pengosongan dan reset database) dengan validasi kredensial server dan role supervisor/admin.
- **`[SEC-03]` Penutupan Celah Bypass WA Gateway**: Menghilangkan celah bypass otentikasi saat environment variable kosong. Middleware `authenticateWaProxy` pada `server.ts` dan `server/whatsapp-gateway.js` kini mewajibkan `X-App-Secret-Key` atau `Bearer Token` valid secara *fail-closed*.
- **`[SEC-04]` Mitigasi Dependensi & Verifikasi Runtime**: Memverifikasi runtime isolasi paket, lolos build TypeScript tanpa galat, dan memitigasi celah dependensi.
- **`[SEC-05]` Pemasangan HTTP Security Headers**: Menambahkan middleware HTTP security headers standar industri pada `server.ts` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy`).
- **Pembaruan Runtime ke Node.js 26 LTS (Masa Dukungan hingga 2029)**: Mengonfigurasi dukungan runtime Node.js 26 LTS dengan dukungan aktif jangka panjang hingga 2029, memperbarui `@types/node` ke versi `^26.6.6`, dan memutakhirkan endpoint `/api/health` dengan informasi detail runtime Node.js 26.
- **Penerapan Desain Glassmorphism (Variation 5)**: Mengintegrasikan desain modern *frosted glassmorphism* (`.glass` dengan backdrop-filter blur 14px), tipografi `Inter` untuk display/sans dan `Space Mono` untuk metrik & kode, hero banner analitik dengan kontrol rentang tanggal 7/14/30 hari, kartu KPI individual beraksen emerald & amber, penataan grafik tren Recharts, serta quiet glass footer `v0.3.1`.
- **Dashboard Modal Audit (`SecurityReportModal.tsx`)**: Memperbarui status seluruh temuan audit SEC-01 s/d SEC-05 menjadi teratasi (*100% Resolved*) dengan badge `v0.3.1 (Security Patched)`.

---

## 🚀 [v0.3.0] - 2026-10-30

### 🛡️ Implementasi Sistem Pelaporan Keamanan & Audit Interaktif
- **Komponen Dashboard Keamanan Baru (`SecurityReportModal.tsx`)**: Pembuatan modal visual interaktif yang merangkum hasil temuan dari `AUDIT_REPORT.md` untuk diakses khusus oleh Admin & Supervisor.
- **Kartu Temuan & Filter Kategori**: Penataan kartu temuan `SEC-01` s/d `SEC-05` dan kontrol positif dengan filter keparahan (*Critical, High, Medium, Positif*), tag lokasi file:line, deskripsi risiko, dan contoh solusi kode.
- **Pelacak Remidiasi & Task Progress**: Fitur *checklist* tugas perbaikan yang tersimpan secara otomatis di `localStorage` untuk memantau persentase penyelesaian remidiasi secara real-time.
- **Analisis Ukuran Bundle & Performa**: Tab analisis *chunk size* (1.67 MB) dengan rekomendasi optimasi *lazy loading* dan *code splitting*.
- **Integrasi Tombol Navigasi Admin**: Penambahan tombol "Audit System" di header utama dan menu dropdown aplikasi (`Navbar.tsx`).

### 🛡️ Penyelesaian Audit Keamanan & Performa System (`AUDIT_REPORT.md`)
- **Pelaksanaan Audit 5-Fase**: Penyelesaian audit menyeluruh mencakup Inventaris Teknologi (Fase 1), Audit Keamanan & Privasi (Fase 2), Performa & Efisiensi Resource (Fase 3), Kualitas Kode & Offline Sync (Fase 4), serta Peta Jalan Remidiasi (Fase 5).
- **Identifikasi Temuan Kritis**: Evaluasi aturan Firestore terbuka (`SEC-01`), client-side RBAC enforcement (`SEC-02`), bypass otorisasi WA gateway (`SEC-03`), kerentanan `npm audit` (`SEC-04`), dan HTTP security headers (`SEC-05`).
- **Pencatatan Kontrol Keamanan Positif**: Penegasan standar hashing PBKDF2 (100k SHA-256 iterations) dan sanitasi ekspor formula Excel/CSV (**CWE-1236**).

### 📄 Pembuatan Dokumentasi Teknis Komprehensif (`DOCUMENTATION.md`)
- **Penerbitan DOCUMENTATION.md**: Penyusunan file panduan teknis utama di root folder yang mencakup:
  - **Setup Lingkungan**: Tabel konfigurasi `.env`, prasyarat Node.js/Bun, serta perintah instalasi dan kompilasi produksi.
  - **Arsitektur Modul**: Diagram sistem ASCII, penjelasan `InventoryContext` (*Optimistic UI & Offline Queue*), `AuthContext` (*PBKDF2 & RBAC*), `ThemeContext`, dan Express WA Gateway Proxy.
  - **Panduan Fitur API**: Endpoint Express Proxy `/api/whatsapp/send`, header otorisasi `X-App-Secret-Key`, perintah cURL, serta contoh payload JSON lengkap untuk respons `200 OK`, `401 Unauthorized`, `400 Bad Request`, dan `500 Error`.
  - **Prosedur Pemeliharaan**: Prosedur backup/restore harian Firestore, kliring cache PWA/localStorage, dan tabel *troubleshooting*.

### ⚙️ Optimasi Bundler & PWA Cache
- **Peningkatan Batas Workbox Cache**: Pembaruan konfigurasi `maximumFileSizeToCacheInBytes` (5 MB) pada `vite.config.ts` untuk memastikan kelancaran kompilasi Service Worker PWA saat build.

---

## 📦 [v0.2.9] - 2026-10-30

### 🎨 Pembaruan Antarmuka & Tema (UI/UX Refinements)
- **Perbaikan Garis Pemisah Tema Gelap**: Menghapus garis pemisah putih tajam pada kelompok menu sidebar tema gelap dan menggantinya dengan border subtle `dark:border-slate-800/60`.
- **Tema Gelap Profil Pengguna**: Menyelaraskan komponen profil pengguna di header dengan tema gelap (`dark:bg-slate-800/80` & `dark:text-slate-200`), menghilangkan efek "pill putih" menyilaukan.
- **Optimasi Viewport Seluler**: Memperbaiki padding modal dan keterbacaan menu navigasi pada layar ponsel.

### 📖 Dokumentasi Suite
- Penerbitan suite dokumentasi awal pada direktori `docs/` (`ARSITEKTUR.md`, `DATA.md`, `PERAN_DAN_AKSES.md`, `PANDUAN_PENGGUNA.md`, `DEPLOY_DAN_OPERASIONAL.md`, `TEMA_DAN_DESAIN.md`, `CHANGELOG.md`).

---

## 📦 [v0.2.4] - 2026-10-25
- Penambahan mode tampilan Gelap / Terang / Sistem via `ThemeContext`.
- Integrasi PWA Service Worker untuk dukungan penggunaan offline.
- Peningkatan batas alert stok minimum pada katalog barang.

---

## 📦 [v0.1.0] - 2026-10-10
- Peluncuran versi perdana aplikasi FieldOps IT.
- Katalog Inventaris, Pencatatan Mutasi Barang Masuk/Keluar.
- Checklist Tas Lapangan Teknisi.
