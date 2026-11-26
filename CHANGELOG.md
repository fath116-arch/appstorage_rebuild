# CHANGELOG.md - Riwayat Versi & Perubahan FieldOps IT

![Version](https://img.shields.io/badge/version-v1.2.8.5-emerald.svg)

Semua perubahan penting dan riwayat rilis proyek **FieldOps IT** dicatat secara kronologis dalam file ini.

## 🚀 [v1.2.8.5] - Pembaruan Otomatis Senyap Production, Anti-Cache PWA/Proxy, Pemisahan Log Aktivitas User ke Kartu Kelola User, & Kompatibilitas Start Production - 2026-11-26
Fokus rilis pemeliharaan & penyempurnaan dari pembaruan 6 jam terakhir hingga rilis terbaru:
- **1. Penghapusan Kebutuhan Hapus Cache Manual & Muat Ulang Otomatis Senyap di Build Production**:
  - **Identitas Build & Manifest Anti-Cache (`frontend/vite.config.ts`, `frontend/src/vite-env.d.ts`)**: Menambahkan generator `__APP_BUILD_ID__` unik per kompilasi beserta plugin `fieldops-build-meta` yang menghasilkan `dist/build-meta.json`; mengaktifkan Workbox `skipWaiting: true`, `clientsClaim: true`, dan `cleanupOutdatedCaches: true`; mengecualikan `/build-meta.json` dan `/api/*` di `navigateFallbackDenylist`; memperbaiki tipe boolean `devOptions.enabled: true`; serta menyelaraskan deskripsi manifest PWA ke *"data barang"*.
  - **Header HTTP Anti-Cache Ketat & `/api/health` (`backend/src/server.ts`)**: Endpoint `GET /api/health` kini mengekspos `version: '1.2.8.5'`, `buildId`, dan `builtAt` dengan header `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`. Shell SPA `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest`, `build-meta.json`, dan `workbox-*.js` dikirim tanpa cache browser/proxy, sementara aset ber-hash `/assets/*` tetap mendapat cache `max-age=31536000, immutable`.
  - **Pembaruan Senyap Aman (`frontend/src/utils/appUpdater.ts`, `frontend/src/main.tsx`)**: Klien otomatis memeriksa pembaruan Service Worker dan membandingkan `buildId` server saat halaman dibuka, `visibilitychange`, `focus`, serta interval 5 menit. Jika versi baru terdeteksi, pembaruan dilakukan secara senyap dan halaman dimuat ulang otomatis hanya saat aman (tidak ada dialog/modal `z-50` atau input aktif yang sedang diisi pengguna) disertai penjaga anti-loop reload 30 detik di `sessionStorage`.
- **2. Pemisahan Log Aktivitas Login/Logout, Sesi, & Manajemen Akun ke Kartu Kelola User**:
  - **Isolasi Feed Inventaris (`backend/src/services/activityLogService.ts`, `backend/src/db/memoryHandlers/authMemory.ts`)**: Mendefinisikan `USER_AUTH_ACTIONS`, `USER_SESSION_ACTIONS`, `USER_ACCOUNT_ACTIONS`, dan `USER_ACTIVITY_ACTIONS` (`login`, `logout`, `cabut_sesi_otomatis`, `deteksi_token_reuse`, `cabut_seluruh_sesi_admin`, `buat_akun`, `setujui_akun`, `tolak_akun`, `ubah_status_akun`, `ubah_akses_fitur`, `reset_sandi`, `hapus_akun`). Seluruh aksi user tersebut dikecualikan secara bawaan dari `getTransactionsFeed()` (`GET /api/activities` & `GET /api/reports/weekly`) sehingga halaman **Riwayat Barang Masuk & Keluar** murni berisi mutasi barang/operasional; sekaligus menyelaraskan kueri `IN` / `NOT IN`, pencarian `LIKE`, dan pengayaan `username_pelaku` pada adapter memori `authMemory.ts`.
  - **Audit Siklus Hidup Akun & Endpoint `GET /api/auth/user-logs` (`backend/src/routes/auth.ts`)**: Melengkapi pencatatan audit non-blocking pada rute pembuatan akun (`buat_akun`), persetujuan (`setujui_akun`), penolakan (`tolak_akun`), perubahan status (`ubah_status_akun`), reset kata sandi (`reset_sandi`), dan penghapusan akun (`hapus_akun`); memperbaiki `PUT /api/auth/users/:id/features` agar mendukung properti `feature_permissions` maupun `featurePermissions` serta reset `null`; dan menambahkan endpoint `GET /api/auth/user-logs` (`requireAuth` + `requireFeature('users_manage')`, khusus **Admin** & **Developer**) dengan filter kategori (`all` | `auth` | `session` | `account`), pencarian teks, dan paginasi.
  - **Tab `Log Aktivitas User` di Kartu Kelola User (`frontend/src/components/users/UserActivityLogsTab.tsx`, `UserRoleSwitcher.tsx`, `api.ts`)**: Menyajikan riwayat login/logout, keamanan sesi, dan manajemen akun langsung di dalam kartu **Kelola User** lengkap dengan filter kategori, kotak pencarian, timestamp WIB (`tabular-nums`), lencana status semantik, skeleton loading, serta status kosong/galat.
- **3. Kompatibilitas Perintah Start Production Cross-Platform & Verifikasi Regresi (`package.json`, `userLogsAndCache.test.ts`)**:
  - Memperbarui skrip `"start"` di `package.json` menjadi `cross-env NODE_ENV=production tsx backend/src/server.ts` agar berjalan seragam di Windows dan Linux/Docker.
  - Menambahkan suite pengujian `backend/src/tests/userLogsAndCache.test.ts` (**24/24 LULUS**) bersama verifikasi ulang `v128Updates.test.ts` (**41/41 LULUS**), `npm run lint`, dan `npm run build`.

---

## 🚀 [v1.2.8] - Login-Only & Tutup Registrasi Publik, Peleburan Role Admin, Izin Fitur Slider ON/OFF (Developer), Dual WA Gateway, Hapus Massal + Konfirmasi "delete", Impor Excel/Google Sheet, & Istilah "Data Barang" - 2026-11-24
- **1. Layar Login Khusus Masuk (Tutup Pendaftaran Publik)**:
  - Menghapus tab dan tautan pendaftaran mandiri dari `LoginScreen.tsx` sehingga halaman masuk hanya melayani **Login** dan **Lupa Kata Sandi / Reset**.
  - Mengunci endpoint `POST /api/auth/register` dengan respons `HTTP 403 Forbidden` (pendaftaran mandiri ditutup; akun baru hanya dibuat oleh **Developer** / **Admin** dari panel web atau CLI server `npm run setup:admin`).
- **2. Peleburan Peran `admin` & `warehouse_admin` Menjadi 1 Peran `admin` (`14_v128_rbac_wa2_and_features.sql`, `permissions.ts`)**:
  - Konsolidasi peran menjadi 3 peran kanonis: **`developer`**, **`admin`** (melebur `admin` + `warehouse_admin` + `supervisor`), dan **`technician`**. Nilai legacy `warehouse_admin`/`supervisor`/`superadmin` tetap dinormalisasi otomatis untuk kompatibilitas mundur.
  - Peran `admin` dibekali wewenang operasional harian bawaan (Gudang, Request, Katalog & Impor, Kelola User khusus `admin`/`technician`, WA Alert 4 slot penerima & ambang tanpa gateway, Pola SN, Laporan/Riwayat).
  - Pembatasan ketat akun: `Admin` hanya dapat membuat, menyetujui, menonaktifkan, mereset kata sandi, dan menghapus akun berlevel **`admin`** atau **`technician`** (`HTTP 403` jika menyentuh akun `developer`).
- **3. Manajemen Akses Fitur Per Akun via Slider ON/OFF (Khusus `developer`)**:
  - Menambahkan kolom `users.feature_permissions` (JSON override atas `FEATURE_CATALOG`), endpoint `PUT /api/auth/users/:id/features` (khusus `developer`), serta penegakan runtime `requireFeature()` pada rute REST dan `isFeatureEnabled(user, key)` di frontend.
  - Di tab **Setting → Manajemen Pengguna**, role `Developer` memiliki tombol **Atur Fitur** untuk menyalakan/mematikan akses modul per akun non-developer menggunakan saklar slider ON/OFF murni (`w-11 h-6`) serta tombol **Reset ke Bawaan Peran**.
- **4. Dual WhatsApp Gateway dengan Slider ON/OFF (Khusus `developer`)**:
  - Menambahkan dukungan **2 WhatsApp Gateway** (`gateway1` & `gateway2` beserta `gatewayMode`: `failover` | `primary_only` | `broadcast_both`) pada `wa_config.gateways_json` & `wa_config.gateway_mode`, masing-masing dengan nama, API URL, API Token ter-mask, dan **slider ON/OFF**.
  - Akses konfigurasi & uji gateway (`POST /api/whatsapp/test-gateway`) dikunci **hanya untuk role `developer`**; role `admin` tetap dapat mengelola 4 slot penerima bersaklar ON/OFF, jam aktif, cooldown, dan ambang stok tanpa pernah menerima URL/token gateway (`HTTP 403` jika mencoba mengubah gateway).
- **5. Hapus Massal (Multi-Pilih) & Konfirmasi Ketik `"delete"` di 5 Target Katalog/Stok**:
  - Menyederhanakan konfirmasi penghapusan Tingkat 3 pada `ConfirmDeleteModal.tsx` & `ConfirmationService`: pengguna cukup mengetik kata **`delete`** (tidak lagi harus mengetik nama kategori/produk/box yang panjang).
  - Menambahkan pemilihan multi-baris (*Pilih Semua* + checkbox + tombol *Hapus Terpilih*) dan endpoint massal atomik dengan proteksi stok/request terbuka untuk ke-5 target: **Produk** (`DELETE /api/catalog/products/bulk`), **Kategori** (`DELETE /api/catalog/jenis/bulk`), **Atribut** (`DELETE /api/catalog/attributes/bulk`), **Storage Box** (`DELETE /api/boxes/bulk`), dan **Item Fisik Ber-ID** (`DELETE /api/stock/items/:id` & `DELETE /api/stock/items/bulk`).
- **6. Impor Data Katalog, Box, & Stok Awal dari Excel (`.xlsx`/`.csv`) atau Google Spreadsheet Publik**:
  - Menambahkan `ImportService` dan rute `/api/import/*` (`GET /template`, `POST /preview`, `POST /commit`) bersama modal `CatalogImportModal.tsx`.
  - Mendukung pengunduhan **Template Excel Resmi** (sheet `Data_Barang` & `Panduan_Isi`), unggah file `.xlsx`/`.csv` atau tempel tautan **Google Spreadsheet publik**, pratinjau validasi baris demi baris (*mode tambah stok* atau *lewati yang sudah ada*), serta eksekusi impor atomik untuk membuat Kategori, Produk, Varian Tipe, Storage Box baru, dan saldo stok awal (termasuk daftar Serial Number).
- **7. Penyelarasan Istilah `"Suku Cadang"` → `"Data Barang"`**:
  - Mengganti seluruh label antarmuka, kolom laporan ExcelJS, ringkasan Dashboard, Riwayat Transaksi, Integrasi Tiket, dan modal operasional dari *"Suku Cadang"* menjadi **"Data Barang"**.

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

---

## 🔧 [v1.2.5.3-refactor] - Refaktor Prinsip SOLID, Modularisasi & Type Safety
- **1. Klien HTTP Terpusat & Perbaikan Kontrak WA Alert**: Menambahkan `httpClient.ts` (`requestJson` dengan penanganan `res.ok`, `credentials: 'include'`, dan `getErrorMessage`) pada `api.ts`, `catalogApi.ts`, `stockApi.ts`, serta `whatsappService.ts`; memisahkan `getInternalConfig()` dari `getConfig()` yang disanitasi di `whatsappAlertService.ts`, menginjeksikan `WhatsAppProvider`, dan memperbaiki kueri tabel `item`/`stok_jumlah`.
- **2. Pemecahan Internal `database.ts`**: Memisahkan `memoryStore.ts`, `migrator.ts`, `memorySeed.ts`, dan handler memori terpisah (`legacyMemory`, `authMemory`, `catalogMemory`, `stockMemory`) di balik fasad `database.ts` yang kompatibel mundur.
- **3. Konsolidasi Logika Transaksi & Katalog**: Menyatukan `syncLegacyItemStock` dan `recordStockTransaction` di `transactionService.ts` / `ticketIntegration.ts`, serta mengekstrak helper status & ambang berjenjang pada `catalogService.ts`.
- **4. Pemusatan RBAC, Pemisahan `ToastContext`, Hook Scanner & Modularisasi UI**:
  - Menambahkan helper peran terpusat di `backend/src/utils/permissions.ts` dan `frontend/src/utils/permissions.ts`.
  - Mengekstrak `ToastContext.tsx` dari `InventoryContext.tsx`.
  - Mengekstrak `useBarcodeScanner.ts` untuk `StockInOutModal.tsx` dan `StockInputModal.tsx`.
  - Memecah `Navbar.tsx` (`ThemeSelector.tsx`), `WhatsAppConfigModal.tsx` (`whatsapp/*.tsx`), dan `UserRoleSwitcher.tsx` (`users/*.tsx`).
- **5. Pembersihan Kode Mati, Type Safety & Penghapusan `alert()`**: Menghapus kode mati brute-force di `authService.ts`, mengganti tipe `any` dan `catch (err: any)` di `activityLogService.ts`, `sessionService.ts`, `stockService.ts`, `auth.ts`, serta `TicketIntegrationHub.tsx` (mengganti `alert()` dengan `useToast()` dan integrasi endpoint `/api/tickets/keys`).

---

## 🚀 [v1.2.5.3] - Restrukturisasi Sub-tab Katalog, Agregasi Status WhatsApp Alert & Audit Trail Terpadu - 2026-11-10
- **1. Pencatatan Transaksi Terpadu**: Fungsi sentral `recordStockTransaction` di `transactionService.ts` memastikan setiap mutasi stok (masuk, keluar, alokasi tiket) menyimpan snapshot lengkap (`nama_barang`, `sku`, `satuan`, `tipe_id`, `tipe_mutasi`, `alasan`) tanpa ketergantungan wajib pada tabel lama `items`.
- **2. Pelepasan Foreign Key `item_id`**: Menghapus kekakuan relasi kunci asing `transactions.item_id` ke tabel `items` via migrasi `11_drop_transactions_item_id_fk.sql` sehingga transaksi v2 berbasis varian dan tipe dapat dicatat mulus.
- **3. Migrasi & Transisi Data Lama**: Seluruh item lawas dimigrasikan ke katalog v2 via `legacyMigrationService.ts`, dan antarmuka legacy "Inventori Stok Fisik" sepenuhnya dilepas untuk menyatukan pengalaman pengguna.
- **4. Satukan API Baca & Agregasi Status WhatsApp**: Endpoint `/api/catalog/products-v2` mengembalikan seluruh produk beserta varian, stok fisik aktif, dan status stok teragregasi (`aman`, `menipis`, `habis`) yang dihitung berjenjang sesuai ambang alert WhatsApp (`tipe > produk > global`).
- **5. Standarisasi Istilah & Perbaikan Chip Kategori**: Seluruh label antarmuka distandarisasi menggunakan istilah **Kategori** (menggantikan "Jenis"), dan hitungan chip kategori diperbaiki konsistensi propertinya (`(item.category_id || item.categoryId)`).
- **6. 4 Sub-tab Baru Menu Katalog**:
  - **Produk**: Kartu status klik-filter (Semua, Aman, Menipis, Habis), bilah pencarian, filter kategori, dan kartu produk bertingkat dengan detail varian.
  - **Kategori (Jelajah Shopee)**: Tampilan visual ramah sentuhan berbasis kartu folder kategori, ringkasan stok, dan tombol cepat "Pakai untuk Tiket" (default untuk peran teknisi).
  - **Storage Box**: Tampilan kartu box penyimpanan, isi suku cadang fisik, dan pencetakan QR box.
  - **Kelola**: Manajemen definisi kategori, atribut dinamis, aturan format Serial Number, pemulihan arsip JSON, dan kotak sampah (khusus peran admin, warehouse, dan developer; disembunyikan untuk teknisi).
- **7. Modularisasi Komponen Katalog**: Pemecahan berkas besar `CatalogV2Manager.tsx` menjadi subkomponen terisolasi (`CatalogSummaryCards.tsx`, `CatalogBrowseCategoriesTab.tsx`, `CatalogBoxesTab.tsx`, `CatalogManageTab.tsx`).
- **8. Riwayat Masuk/Keluar Murni Audit Trail**: `TransactionHistory.tsx` dispesialisasikan sebagai riwayat audit terlindung dengan integrasi ekspor Excel aman (`sanitizeFormulaInput`).
- **9. Sinkronisasi Versi**: Pembaruan menyeluruh nomor versi ke `v1.2.5.3` pada `version.ts`, `package.json`, dan footer.
- **10. Pembersihan File Usang**: Audit dan penghapusan duplikat berkas panduan markdown di `public/assets/aistudio/` serta file dokumentasi kadaluarsa di root workspace.

---
- **Eliminasi Bug Halaman A4 Berlebih**: Memperbaiki bug di mana pencetakan 1 atau 2 label menghasilkan 2 lembar cetak A4 alih-alih 1 lembar.
- **Standarisasi Dimensi Lembar**: Lembar cetak (`.print-sheet`) dikunci pada ukuran presisi A4 `210mm × 296mm` (disisakan margin toleransi 1mm dari 297mm dengan `box-sizing: border-box` dan `overflow: hidden`) guna mencegah browser Chromium/Edge meluapkan halaman ke lembar ekstra.
- **Implementasi Slot Kosong (`.label-slot-empty`)**: Menyediakan elemen penampung slot kosong berdimensi tetap (`190mm × 89mm`) dengan `visibility: hidden` pada lembar yang tidak terisi penuh (layout 1 atau 2 label), menjamin stabilitas DOM dan layouting cetak.
- **Titik Petunjuk Potong Presisi**: Posisi titik potong (celah 195 × 94 mm) dihitung dari ukuran label tetap dan jarak celah antar label (bukan dari jumlah label terisi), dengan nilai Y maksimum 289.5 mm yang berada di dalam area batas 296 mm.
- **Isolasi `@media print` & Normalisasi `@page`**: Memperbaiki konflik `@page` margin di `frontend/src/index.css` menjadi `margin: 0` dan mengisolasi modal wrapper serta elemen latar belakang agar tidak tercetak.
- **Sinkronisasi Dokumen Referensi**: Menjadikan `FIX_PRINT_LABEL.md` dan `docs/v1.2.0/cetak_label.html` sebagai dokumen acuan resmi implementasi cetak label presisi.

---

## 🚀 [v1.2.5] - Paket 7: Branding Logo Baru & Kotak Logo Top Navigation - 2026-11-08
- **Model Baru Top Navigation (Sisi Kiri)**: Menggantikan logo kecil lama dengan satu blok klik terpadu yang memuat **[Kotak Logo] + Teks "FieldOps IT" (Tebal) + Ikon Panah Dropdown Chevron Abu-abu**.
- **Desain Kotak Logo**: Persegi bersudut membulat (`rounded-xl`) dengan latar terang (`bg-white` / `dark:bg-slate-100`) berborder halus sehingga logo kubus terlihat jernih dan kontras di mode tema terang maupun tema gelap.
- **Responsif Layar Sempit (HP)**: Teks "FieldOps IT" disembunyikan secara otomatis di layar kecil (`hidden sm:inline-block`), sedangkan kotak logo dan panah chevron tetap tampil presisi.
- **Konsistensi Branding di Seluruh Aplikasi**:
  - Favicon dan shortcut icon di `frontend/index.html` menggunakan `/logo.png`.
  - Apple Touch Icon (`/apple-touch-icon.png`, 180x180 px) dengan latar solid.
  - PWA Icons (`pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`) dengan latar solid non-transparan dan ukuran sangat efisien (~162 KB total, jauh di bawah batas cache PWA 5 MB).
  - Halaman Login (`LoginScreen.tsx`) dengan kotak logo hero berlatar terang.
  - Modal Manajemen Akun/Peran (`UserRoleSwitcher.tsx`) dengan kotak logo berlatar terang.
  - Template Cetak Laporan Resmi A4 (`PrintReportModal.tsx`) menggunakan `/logo.webp` pada Kop Surat resmi.
  - Template Cetak Label QR A4 190x89 mm (`BatchLabelPrintModal.tsx`) menggunakan `/logo.png` pada header kartu.
  - Footer aplikasi (`App.tsx`) dengan kotak logo dan teks tebal "FieldOps IT".
- **Pengujian Otomatis**: Lulus 6/6 pengujian di `backend/src/tests/v125Paket7Branding.test.ts`.

---

## 🚀 [v1.2.5] - Paket 6: WA Alert Otomatis (Fonnte) & Ambang Berjenjang 15 Menit - 2026-11-08
- **Akses Role & Proteksi Read-Only**: Menu WA Alert di modal Tools dapat diakses oleh seluruh peran (`developer`, `admin`, `warehouse_admin`, `technician`). Peran teknisi dilindungi secara ketat dengan status *read-only* (hanya melihat riwayat log); pengubahan konfigurasi, pengubahan ambang, dan pengiriman alert ditolak dengan status HTTP 403 Forbidden di backend.
- **3 Jenis Pesan Otomatis (Tanpa Teks Bebas)**: Peringatan Stok Habis (0 unit), Stok Menipis (stok $\le$ ambang menipis), dan Peringatan Dini (khusus produk/tipe di daftar pantauan/watchlist dengan stok $\le$ ambang dini).
- **Pengecualian Stok Rusak**: Item fisik berkondisi `Rusak` tidak dihitung sebagai stok yang tersedia dalam seluruh proses evaluasi ambang batas alert.
- **Ambang Berjenjang (*Hierarchical Thresholds*)**: Resolusi ambang otomatis dengan prioritas bertingkat: **tipe > produk > global**. Antarmuka dan API menampilkan nilai ambang berlaku secara transparan beserta label asal sumbernya (`dari tipe`, `dari produk`, `dari global`).
- **Daftar Pantauan (*Watchlist*)**: Pengguna dapat menambahkan tipe atau produk ke dalam daftar pantauan khusus dengan ambang batas dini masing-masing.
- **Batas Jeda 15 Menit di Backend & Penggabungan Konsolidasi**: Jeda pengiriman (*cooldown*) minimal 1 menit, default 15 menit, dan dilarang disetel 0 menit. Peringatan yang terjadi dalam rentang jeda ditahan di antrean dan dikonsolidasi menjadi satu pesan ringkasan lengkap. Tombol pesan uji (*test message*) juga mematuhi jeda 15 menit.
- **Anti-Duplikat Berbasis Status**: Barang dengan status alert yang sama tidak dikirimkan berulang kali; status direset saat stok naik di atas ambang batas (`NORMAL`).
- **Sanitasi & Deduplikasi Penerima**: Mendukung grup WhatsApp (`...-group` atau `...@g.us`) dan nomor telepon individual; nomor duplikat otomatis dibersihkan sehingga hanya dikirim satu kali.
- **Ekstensibilitas Estimasi Sisa Hari**: Metode penentuan estimasi hari sisa pakai (`estimateDaysRemaining`) dirancang ekstensibel tanpa mengubah skema tabel.
- **Pengujian Otomatis**: Lulus 13/13 pengujian di `backend/src/tests/v125Paket6WaAlert.test.ts`.

---

## 🚀 [v1.2.5] - Paket 5: Kamera dan Laporan Cetak - 2026-11-08
- **Input Stok via Kamera di Menu Keluar/Masuk (`StockInOutModal.tsx`)**: Integrasi pemindai kamera barcode/QR (memanfaatkan kembali aliran kamera `navigator.mediaDevices.getUserMedia` dan video targeting overlay) pada modal Barang Masuk (IN) dan Barang Keluar (OUT).
- **Penanganan Scan Presisi**: Pemindaian otomatis mendeteksi kode SKU, Barcode, atau ID fisik. Kode valid memvalidasi ketersediaan stok fisik dan mengisi form secara instan; kode tidak valid atau barang tidak ditemukan ditolak dengan notifikasi kesalahan yang jelas.
- **Validasi Transaksi Keluar**: Transaksi keluar (OUT) menolak pemrosesan jika barang kosong (0 unit) atau kuantitas melebihi stok yang tersedia.
- **Template Cetak Laporan Formal Presisi (`PrintReportModal.tsx`)**: Template cetak dokumen A4 resmi berstandar korporat dengan Kop Surat resmi PT. Solusi Informatika Lapangan, logo institusi, judul audit, periode laporan, tanggal & waktu cetak, nama pencetak (*printed by*), tabel data mutasi dengan header berulang di tiap halaman (`thead { display: table-header-group; }`), serta lembar tanda tangan pengesahan (Admin Logistik, Teknisi Lapangan, Supervisor IT).
- **Isolasi Cetak Kertas**: Konfigurasi `@page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }` dan aturan `@media print` yang secara ketat menyembunyikan navbar, footer, sidebar, filter toolbar, dan tombol interaktif (`.no-print { display: none !important; }`).
- **Pengujian Otomatis**: Lulus 15/15 pengujian di `backend/src/tests/v125Paket5CameraPrint.test.ts`.

---

## 🚀 [v1.2.5] - Paket 4: Katalog dan Produk (Storage Box, Tipe Stok, Kategori Barang, Kondisi Item) - 2026-11-07
- **Daftar Storage Box**: Submenu/tab view terintegrasi di Katalog untuk melihat daftar semua box dan rincian isinya (produk, tipe, jumlah, kondisi). Satu box mendukung penyimpanan campuran berbagai suku cadang.
- **Tipe Satuan Stok**: Input manual dengan tag saran interaktif (*clickable suggestions*) dari nilai yang pernah digunakan (misal: `unit`, `roll`, `meter`, `pcs`, `box`, `set`) untuk konsistensi penulisan data.
- **Kategori Barang**: Pembeda jenis produk `Alat` (toolkit / equipment) vs `Barang Habis Pakai` di form produk dan filter toolbar katalog.
- **Kondisi Item**: Pelacakan kondisi item fisik (`Baru`, `Baik`, `Perlu Perbaikan`, `Rusak`) beserta catatan kondisi. Item berkondisi `Rusak` tidak dihitung sebagai stok tersedia dan dicegah secara atomik saat permohonan (*request*) teknisi.
- **Pengujian Otomatis**: Lulus 13/13 pengujian di `backend/src/tests/v125Paket4Catalog.test.ts`.

---

## 🚀 [v1.2.0] - 2026-11-06 (Rilis Final Versi 1.2.0 Lengkap)

### 📦 Pembaruan Tahap 4 s/d 8 (Tuntas & Terverifikasi 100%)
- **Tahap 4 (Antarmuka Katalog Toko Online)**:
  - Tampilan kartu produk ala online shop dengan indikator total stok segala tipe, detail sebaran box penyimpanan, riwayat mutasi dari audit log, dan modal Rincian ID Fisik.
  - Lulus 14/14 pengujian otomatis (`tahap4CatalogView.test.ts`).
- **Tahap 5 (Barang Keluar, Arsip, & Restore)**:
  - Soft delete barang keluar (`status = 'keluar'`) tunggal maupun massal (Tier 2 `approve`).
  - Halaman dan filter pencarian Arsip lengkap.
  - Pemulihan (restore) barang dari Arsip ke Box pilihan dengan validasi kesesuaian produk (`confirm_product_matched`) dan pencegahan duplikasi ID yang sedang aktif.
  - Lulus 15/15 pengujian otomatis (`tahap5ArchiveRestore.test.ts`).
- **Tahap 6 (Alur Request Teknisi & Persetujuan Cepat Atomik)**:
  - Skema tabel `request` (`07_v2_request_schema.sql`).
  - Persetujuan cepat: 1 approval cukup dari 3 peran (`developer`, `admin`, `warehouse_admin`).
  - Proteksi *race condition* / double approval atomik (`UPDATE request SET status = 'disetujui' WHERE id = ? AND status = 'menunggu'`).
  - Pengurangan stok otomatis (*auto-deduct*) dan pencatatan transaksi mutasi `AKT-YYYYMMDD-NNNN`.
  - Lulus 11/11 pengujian otomatis (`tahap6Requests.test.ts`).
- **Tahap 7 (Label Batch & Cetak A4 Presisi)**:
  - Modul cetak presisi `BatchLabelPrintModal.tsx` dan endpoint `/api/catalog/labels`.
  - Dimensi kartu label tetap **190 × 89 mm**, 2 tabel 5×3 (maks. 10 produk per kartu).
  - Titik potong celah presisi **195 × 94 mm** di celah 5 mm antar label.
  - Generator vektor SVG QR Code tajam resolusi tinggi (bebas blur).
  - Pilihan slot 1-3 dan 1-3 label per lembar A4 untuk efisiensi kertas sisa.
  - Lulus 8/8 pengujian otomatis (`tahap7Labels.test.ts`).
- **Tahap 8 (Notifikasi Fonnte, Audit Keamanan & Dokumentasi)**:
  - Service `NotificationService.ts` untuk pengiriman otomatis alert WhatsApp Fonnte saat request barang dibuat.
  - Pengiriman asinkron dan terisolasi tanpa memblokir transaksi database.
  - Sistem tema gelap/terang berbasis token CSS (`--color-*`) dengan disiplin zero-pill border.
  - Dokumentasi sistem lengkap di `docs/v1.2.0/PANDUAN_SISTEM_V1.2.0.md` dan `docs/STATUS.md`.
  - Total pengujian otomatis seluruh tahap: **97/97 tes (100% LULUS)**.

---

## 🌟 [v1.2.0-tahap3] - 2026-11-06 (Box, Item Fisik Ber-ID, Stok Jumlah & Input Kamera)

### 📦 Manajemen Box Storage & Pemindaian Stok (Single & Bulk)
- **Skema Fisik Box & Item (`06_v2_stock_schema.sql`)**: 3 tabel relasional (`box`, `item`, `stok_jumlah`) mendukung lokasi box campuran, pencatatan item fisik ber-ID unik, dan stok jumlah bulk.
- **Pemindaian Kamera & Scan Beruntun**: Komponen `StockInputModal.tsx` dengan pengintegrasian kamera browser/scanner, pemindaian SN beruntun, serta validasi pola regex (`pola_id`) dan pencegahan ID duplikat secara real-time.
- **Transaksi Massal N Unit 1 Activity ID**: Seluruh pemrosesan batch N unit (misal 20 SN sekaligus) dicatat sebagai **1 transaksi tunggal** dengan ID aktivitas `AKT-YYYYMMDD-NNNN` dan detail baris per unit.
- **Penguncian Aturan ID Automatis**: Memasukkan stok fisik pertama kali secara otomatis mengubah `id_dikunci = 1` pada tipe varian terkait untuk menjamin konsistensi format.
- **Relokasi Antar Box (`pindah_box`)**: Fitur pemindahan item atau stok jumlah antar box dengan dialog `BoxContentModal.tsx` yang mencatat riwayat transaksi `pindah_box`.
- **Pengujian Otomatis (`tahap3Stock.test.ts`)**: 17/17 pengujian lulus 100% mencakup pembuatan box, validasi regex, penolakan SN duplikat, batch 20 SN 1 activity ID, stok jumlah, kueri isi box terstruktur, dan relokasi item antar box.

---

## 🌟 [v1.2.0-tahap2] - 2026-11-06 (Katalog Bertingkat: Jenis, Atribut, Produk & Tipe)

### 🏷️ Hierarki Katalog Dinamis (Jenis, Atribut, Produk, dan Tipe)
- **Skema Relasional Terstruktur (`05_v2_catalog_schema.sql`)**: 6 tabel relasional (`jenis`, `atribut`, `atribut_opsi`, `produk`, `tipe`, `tipe_nilai`) dengan relasi foreign key dan cascade constraint.
- **Pembentukan Nama Tipe Otomatis (`generateTipeName`)**: Nama varian tipe dibentuk secara otomatis dari atribut yang memiliki penanda `masuk_nama = 1` berurutan berdasarkan kolom `urutan` (contoh: `"12V / 1A"`, `"12V / 3A / Jack 5.5mm"`, `"Cat6 / 305m"`).
- **Aturan ID per Tipe**: Konfigurasi per varian (`scan_sn`, `otomatis`, `manual`, `tanpa_id`), format `prefix_id`, validasi regex `pola_id`, dan penguncian `id_dikunci` setelah stok pertama masuk.
- **Tombol Tambah Atribut Inline di Modal Produk**: Di halaman pembuatan produk, jika Jenis yang dipilih belum memiliki atribut, sistem langsung menampilkan tombol `+ Tambah Atribut untuk Jenis Ini` di dalam modal tanpa perlu berpindah layar.
- **Filter Spesifikasi Dinamis**: Filter katalog secara dinamis menghasilkan pilihan dropdown/checkbox untuk atribut `pilihan` dan input rentang angka untuk atribut `angka` (contoh: "Arus ≥ 2A").
- **Pengujian Otomatis (`tahap2Catalog.test.ts`)**: 13/13 pengujian lulus 100% mencakup pembuatan jenis, relasi atribut, auto-naming tipe, penolakan nama duplikat, validasi atribut wajib, penambahan opsi baru dinamis, dan koreksi aturan ID.

---

## 🔒 [v1.2.0-tahap1] - 2026-11-06 (Fondasi Keamanan, Sesi Server & Sampah 14 Hari)

### 🛡️ Sesi Server & Konfirmasi Bertingkat
- **Server-Authoritative Sessions (`sesi`)**: Access token 15 menit, refresh token berotasi, deteksi anti-replay reuse token, dan batas kuota sesi tunggal per akun (`MAX_SESI_PER_AKUN = 1`).
- **Konfirmasi Bertingkat (Tier 0-3)**: Penegakan verifikasi server dengan token sekali pakai (TTL 120s), proteksi penghapusan tingkat 3 (wajib ketik nama objek + verifikasi password).
- **Log Aktivitas Append-Only (`transaksi`)**: Format ID Aktivitas harian `AKT-YYYYMMDD-NNNN` untuk setiap mutasi dan aksi administratif.
- **Sampah Hapus Permanen 14 Hari (`sampah_hapus`)**: Penyimpanan snapshot data sebelum pemusnahan mutlak, dilengkapi CLI pemulihan `npm run sampah -- --list / --pulihkan <id> [--dry-run]`.
- **Pengujian Otomatis (`tahap1Foundation.test.ts`)**: 19/19 pengujian lulus 100%.

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
