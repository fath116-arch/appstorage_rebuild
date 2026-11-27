# DOCUMENTATION.md - Dokumentasi Teknis & Panduan Operasional FieldOps IT

![System Version](https://img.shields.io/badge/System_Version-v1.2.9-emerald.svg)
![React](https://img.shields.io/badge/React-19.3.0-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5.0.0-000000?logo=express)
![MariaDB](https://img.shields.io/badge/MariaDB-11.4_LTS-003545?logo=mariadb)
![Vite](https://img.shields.io/badge/Vite-8.3.0-646CFF?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38BDF8?logo=tailwindcss)
![Node](https://img.shields.io/badge/Node.js-22+_LTS-339933?logo=node.js)

Dokumen ini memuat panduan lengkap setup lingkungan, penjelasan arsitektur modul `frontend/` + `backend/` berbasis **MariaDB 11.4 LTS**, keamanan sesi server-authoritative, pembaruan otomatis produksi anti-cache, pemisahan log aktivitas user, pengelolaan katalog & pemindahan stok v1.2.9, penggunaan REST API, serta prosedur pemeliharaan sistem **FieldOps IT (`v1.2.9`)**.

---

## 🛠️ 1. PANDUAN SETUP LINGKUNGAN (ENVIRONMENT SETUP)

### A. Prasyarat Sistem (Prerequisites)
Sebelum menjalankan atau men-deploy aplikasi secara lokal maupun on-premises, pastikan sistem memenuhi prasyarat berikut:
- **Node.js**: `>=22.0.0` (Direkomendasikan Node.js 22/26 LTS).
- **Package Manager**: `npm` (v10+).
- **Database Engine**: **MariaDB 11.4 LTS** (atau MariaDB 11.x via Docker Compose / instalasi lokal).
  > *Catatan Pengembangan*: Saat MariaDB lokal belum aktif pada mode pengujian/pengembangan tertentu, adapter memori mandiri di `backend/src/db/` otomatis aktif sebagai fallback sementara, namun untuk produksi **MariaDB 11.x wajib aktif**.
- **Opsional Produksi**: Docker Engine v24.0+ & Docker Compose V2, serta **Cloudflare Tunnel** untuk akses HTTPS eksternal.

---

### B. Konfigurasi Variabel Lingkungan (`.env`)

Salin file `.env.example` di **root repositori** menjadi `.env` *(berkas utama yang dibaca oleh Docker Compose, backend, dan antarmuka web Setting; jika terdapat `backend/.env`, sistem membacanya sebagai fallback untuk variabel yang kosong di root)*:
```bash
cp .env.example .env
```

Variabel lingkungan yang didukung sesuai `.env.example` dan konfigurasi server:

```ini
# Runtime Server
PORT=3000
NODE_ENV=production
APP_SECRET_KEY=ganti_dengan_kunci_acak_panjang_rahasia

# Koneksi Database MariaDB (Wajib di Produksi)
DB_HOST=mariadb
DB_PORT=3306
DB_NAME=fieldops_inventory
DB_USER=fieldops_user
DB_PASSWORD=password_user_mariadb_anda
DB_ROOT_PASSWORD=password_root_mariadb_anda

# Pengaturan Frontend (Vite)
VITE_API_BASE_URL=
VITE_APP_TITLE=FieldOps IT Inventory

# Integrasi WhatsApp Gateway (Fonnte)
WHATSAPP_API_URL=https://api.fonnte.com/send
WHATSAPP_API_TOKEN=
WHATSAPP_TARGET_PHONES=
WHATSAPP_AUTO_ALERT=true

# Akses Jarak Jauh HTTPS (Opsional)
CLOUDFLARE_TUNNEL_TOKEN=
CLOUDFLARE_PUBLIC_URL=
```

#### Deskripsi Variabel Lingkungan:
| Variabel | Lingkungan | Wajib | Fungsi / Deskripsi |
| :--- | :--- | :---: | :--- |
| `PORT` | Backend | Tidak | Port Express server (Default: `3000`). |
| `NODE_ENV` | Backend | Ya | Mode runtime (`development` atau `production`). |
| `APP_SECRET_KEY` | Backend | Ya | Kunci rahasia internal server. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` | Backend & MariaDB | Ya (Prod) | Kredensial koneksi MariaDB 11.x (`mysql2`). |
| `VITE_API_BASE_URL` | Frontend | Tidak | Base URL API opsional jika frontend dipisah origin (kosong = same-origin `/api/*`). |
| `VITE_APP_TITLE` | Frontend | Tidak | Judul kustom aplikasi di sisi klien. |
| `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_TARGET_PHONES`, `WHATSAPP_AUTO_ALERT` | Backend | Tidak | Konfigurasi gateway Fonnte bawaan (token rahasia tetap diproteksi di backend). |
| `CLOUDFLARE_TUNNEL_TOKEN`, `CLOUDFLARE_PUBLIC_URL` | Docker Compose & Backend | Tidak | Token Cloudflare Tunnel & URL publik HTTPS untuk akses jarak jauh serta pengecekan `/api/health`. |

---

### C. Perintah Instalasi, Suite Setup CLI, & Mode Running

1. **Instal Dependensi**:
   ```bash
   npm install
   ```
2. **Konfigurasi Server via Skrip Setup Interaktif** *(Lihat detail di [`docs/SKRIP_CLI.md`](./docs/SKRIP_CLI.md))*:
   ```bash
   npm run setup:help    # Menampilkan seluruh command setup & fungsinya
   npm run setup:db      # Konfigurasi & uji koneksi MariaDB ke .env
   npm run setup:admin   # Buat akun Admin / Developer pertama
   npm run setup:tunnel  # Konfigurasi Cloudflare Tunnel & URL publik
   npm run setup:wa      # Konfigurasi WhatsApp Gateway (Fonnte)
   npm run setup:test-login # Uji diagnostik login akun 6 tahap (PBKDF2 & MariaDB)
   npm run setup:check   # Cek apakah DB, Admin, WA, & Tunnel sudah terhubung
   ```
3. **Jalankan Mode Pengembangan (Express 5 + Vite Middleware di Port 3000)**:
   ```bash
   npm run dev
   ```
4. **Kompilasi Produksi & Type-Check**:
   ```bash
   npm run lint
   npm run build
   ```
5. **Jalankan Mode Produksi (`cross-env NODE_ENV=production`)**:
   ```bash
   npm start
   ```
   *(Menjalankan Express 5 dalam mode produksi yang melayani aset dari `dist/` dengan header anti-cache pada shell HTML/SW/`build-meta.json` dan auto-update klien senyap).*
6. **Perintah Pemeliharaan CLI Tambahan**:
   - `npm run sampah -- --list` / `--pulihkan <id> [--dry-run]` / `--purge`: Kelola & pulihkan data di Kotak Sampah 14 hari (`sampah_hapus`).
   - `npm run test:backup`: Verifikasi integritas ekspor/impor backup JSON bebas akun.
   - `docker compose up -d --build`: Menjalankan stack produksi (`mariadb`, `backend`, `cloudflared`).

---

## 📐 2. ARSITEKTUR MODUL (DECOUPLED REACT 19 + EXPRESS 5 + MARIADB)

### A. Diagram Arsitektur Sistem

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        KLIEN WEB & MOBILE PWA                              │
│          React 19 SPA (frontend/) • Tailwind CSS v4 • ExcelJS              │
│   ┌──────────────┐ ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐  │
│   │ AuthContext  │ │ InventoryContext │ │ ToastContext │ │ ThemeContext │  │
│   └──────┬───────┘ └────────┬─────────┘ └──────────────┘ └──────────────┘  │
└──────────┼──────────────────┼──────────────────────────────────────────────┘
           │ Cookie HttpOnly  │ REST JSON (/api/*)
           ▼                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   EXPRESS 5 API SERVER (backend/src/server.ts)             │
│   Middleware: Security Headers (SEC-05) • Rate Limit • authenticate • RBAC │
│   ┌────────────────────┬─────────────────────────┬──────────────────────┐  │
│   │ Auth & Keamanan    │ Katalog, Stok & Request │ Operasional & Ekspor │  │
│   │ • AuthService      │ • CatalogService        │ • ActivityLogService │  │
│   │ • SessionService   │ • StockService          │ • WhatsappAlertSvc   │  │
│   │ • ConfirmationSvc  │ • RequestService        │ • NotificationSvc    │  │
│   │ • SettingService   │ • BagService (MultiTas) │ • TicketIntegration  │  │
│   │ • TrashService     │ • SNPatterns (/sn-pat)  │ • BackupService      │  │
│   └────────────────────┴─────────────────────────┴──────────────────────┘  │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ mysql2 (UTC Connection Pool)
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     MARIADB 11.4 LTS (On-Premises, UTC)                    │
│  Akun & Sesi: users, sesi, pengaturan, token_konfirmasi, sampah_hapus      │
│  Kanonis Bisnis: jenis, atribut, atribut_opsi, produk, tipe, tipe_nilai,   │
│                  box, item, stok_jumlah, request, transaksi,               │
│                  transaksi_detail, checklists (TOOLKIT_CHECK/BAG_TEMPLATE) │
│  Integrasi & Log: api_keys, wa_config, wa_thresholds, wa_alert_status,     │
│                   wa_delivery_logs, audit_logs                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### B. Modul Utama Frontend (`frontend/src/`)
1. **`AuthContext.tsx` & `utils/permissions.ts`**:
   - Memverifikasi sesi aktif langsung dari server (`GET /api/auth/me`) tanpa menyimpan token sesi maupun peran di `localStorage`.
   - Mendukung **3 peran kanonis** (`developer`, `admin`, `technician`) hasil peleburan `admin` + `warehouse_admin` beserta kustomisasi 21 izin fitur per akun via slider ON/OFF (`isFeatureEnabled(user, key)`).
   - `LoginScreen.tsx` hanya melayani **Login** dan **Lupa Kata Sandi** (pendaftaran publik ditutup total).
2. **`utils/appUpdater.ts`, `main.tsx`, & `vite.config.ts` (Anti-Cache & Auto-Update Production)**:
   - Setiap kompilasi menghasilkan `__APP_BUILD_ID__` unik dan berkas `dist/build-meta.json` (`fieldops-build-meta`), dengan Workbox `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true`, serta `navigateFallbackDenylist` untuk `/api/*` & `/build-meta.json`.
   - Saat buka halaman, `visibilitychange`, `focus`, maupun polling 5 menit, `appUpdater.ts` membandingkan `__APP_BUILD_ID__` dengan `buildId` di `GET /api/health` dan memperbarui Service Worker lalu melakukan reload senyap hanya saat aman (tidak ada dialog/modal `z-50` atau input aktif, plus anti-loop 30 detik `sessionStorage`).
3. **`InventoryContext.tsx`**:
   - Mengelola sinkronisasi satu sumber data kanonik dari endpoint `/api/catalog/*`, `/api/boxes`, `/api/stock/*`, `/api/activities`, dan `/api/requests/*`.
   - Setiap mutasi otomatis memanggil `refreshData()`, ditambah **auto-refresh senyap setiap 5 menit** yang sadar visibilitas tab (`visibilitychange`).
4. **`ToastContext.tsx` & `ThemeContext.tsx`**:
   - `ToastContext` menggantikan dialog `alert()`/`confirm()` bawaan browser dengan toast dan modal in-app (`ConfirmDeleteModal.tsx` dengan konfirmasi ketik **`delete`** untuk aksi penghapusan).
   - `ThemeContext` mengelola preferensi `light`, `dark`, dan `system` melalui kelas `.dark` dan token CSS di `frontend/src/index.css`.
5. **Komponen Operasional Utama**:
   - **Manajemen Pengguna & Log Aktivitas User**: `UserRoleSwitcher.tsx` memuat kartu **Kelola User** lengkap dengan saklar **Atur Fitur** (`developer`) dan tab baru **`Log Aktivitas User`** (`UserActivityLogsTab.tsx`, akses Admin & Developer) untuk memantau login, logout, pencabutan sesi, token reuse, dan manajemen akun terpisah dari riwayat barang.
   - **Katalog, Box, Pemindahan, Hapus Non-SN, & Impor Multi-Tipe**: `CatalogV2Manager.tsx` (subtab `Produk`, `Kategori`, `Storage Box`, serta `Kelola & Pengaturan` dengan **4 kartu pengaturan** menggantikan *Atur Atribut* beserta keanggotaan kategori manual; mendukung rename/penamaan manual varian Tipe, pindah kategori/produk/tipe/box, hapus kategori dengan opsi pindah atau cascade, hapus massal multi-pilih Produk/Kategori/Tipe/Box), `BoxContentModal.tsx` (hapus & pindah item ber-ID maupun stok non-SN), `CatalogImportModal.tsx` (Template Excel multi-tipe berkolom `Pola_ID` terpisah per tipe & Impor `.xlsx`/`.csv`/Google Spreadsheet publik), dan `BatchLabelPrintModal.tsx`.
   - **Mutasi & Scanner**: `StockInputModal.tsx` (`SCAN_SN` ketat + Uji Regex + `useBarcodeScanner.ts`), `StockInOutModal.tsx` (Keranjang Keluar multi-item + Hubungkan ke Request).
   - **Request & Tas Kerja**: `TechnicianRequestsView.tsx` (Ambil Satuan, Pilih Paket Tas, Kembalikan dengan 3 kondisi, Pengajuan Pembelian Barang `beli` + WA selektif, Selesai Terpakai/Sudah Dibeli), `FieldTripChecklistModal.tsx` (Inspeksi Harian + Manajemen Multi-Tas Kerja Kantor).
   - **Laporan & Audit**: `TransactionHistory.tsx` (Ledger append-only khusus mutasi barang + Catat Koreksi Audit), `WeeklyReport.tsx` (Senin–Minggu WIB, ekspor `.xlsx` ExcelJS tersanitasi CWE-1236, `PrintReportModal.tsx`, `PrintDocumentModal.tsx`, serta editor Kop Surat & Lembar Pengesahan `REPORT_APPROVAL_CONFIG`).
   - **Notifikasi WhatsApp**: `WhatsAppConfigModal.tsx` & `WaConfigTab.tsx` (4 slot nomor penerima dengan saklar ON/OFF individual + **Dual Gateway ON/OFF** khusus `developer`).

### C. Modul Layanan Backend (`backend/src/`)
1. **Keamanan, Sesi, Kriptografi, & Kontrol Cache Production**:
   - Kata sandi di-hash dengan **PBKDF2 SHA-256** (100.000 iterasi, 16-byte random salt).
   - Token sesi (`fieldops_access`, `fieldops_refresh`, `fieldops_device`, `fieldops_session`) disimpan sebagai cookie **HttpOnly**, divalidasi di tabel `sesi` dengan rotasi refresh token anti-replay.
   - Aksi sensitif ditegakkan di server oleh `ConfirmationService` (`token_konfirmasi` sekali pakai, TTL 120 detik, Tingkat 0–3).
   - `server.ts` menyajikan `GET /api/health` (`buildId`, `builtAt`, `version: '1.2.9'`) serta file `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest`, `build-meta.json`, dan `workbox-*.js` dengan header `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, sedangkan `/assets/*` memakai cache `max-age=31536000, immutable`.
2. **Transaksi Atomik, Isolasi Log User, & Zona Waktu (`timezone.ts`)**:
   - Server mengunci `process.env.TZ = 'UTC'` untuk penyimpanan konsisten di MariaDB, sementara seluruh tampilan UI, perhitungan ID Aktivitas (`AKT-YYYYMMDD-NNNN`), dan rekap laporan menggunakan zona waktu **WIB (`Asia/Jakarta`)**.
   - `ActivityLogService` & `authMemory.ts` mengecualikan `USER_ACTIVITY_ACTIONS` dari feed barang (`GET /api/activities` & `GET /api/reports/weekly`) dan menyediakannya melalui `getUserActivityLogs()` (`GET /api/auth/user-logs`), sementara `routes/auth.ts` mencatat penuh aktivitas akun (`buat_akun`, `setujui_akun`, `tolak_akun`, `ubah_status_akun`, `ubah_akses_fitur`, `reset_sandi`, `hapus_akun`).
   - Mutasi stok (`StockService`, `RequestService`, `TicketIntegration`) dijalankan dalam `runTransaction()` untuk mencegah *race condition* dan menjaga konsistensi stok fisik vs reservasi (`dipesan` / `reserved_qty`).

---

## 🔌 3. RINGKASAN ENDPOINT API UTAMA

Seluruh endpoint REST berada di bawah prefix `/api/*` dengan autentikasi cookie sesi server (`requireAuth` & `requireFeature`), kecuali `/api/health`, `/api/auth/login`, `/api/auth/reset-password`, dan webhook `/api/tickets/consume` (menggunakan `X-API-Key` atau `Bearer <api_key>`). Endpoint `POST /api/auth/register` mengembalikan `HTTP 403 Forbidden`:

- **Autentikasi, Log User, & Administrasi (`/api/auth`)**: Login/refresh/logout, profil `/me`, daftar `/actors`, **`GET /user-logs`** (log login/logout/sesi/akun untuk Admin & Developer dengan `users_manage`), manajemen `/users` (`admin` terbatas `admin`/`technician`), `/users/:id/features` (izin fitur slider khusus `developer`, mendukung `feature_permissions` & `featurePermissions`), `/confirm-token` (ketik `"delete"` untuk penghapusan), `/settings`, dan `/trash`.
- **Katalog, Impor Multi-Tipe, & Storage Box (`/api/catalog`, `/api/import`, `/api/boxes`)**: CRUD, pindah produk (`/products/move`) & pindah tipe (`/types/:id/move`), hapus kategori dengan opsi `move_products`/`cascade`, rename varian tipe & aturan ID (`/types/:id/id-rule`), hapus tunggal/massal Kategori, Produk, Tipe (`/types/:id`, `/types/bulk`), label cetak A4 (`/labels`), impor Excel/Google Sheet multi-tipe berkolom `Pola_ID` (`/api/import/{template,preview,commit}`), serta manajemen Storage Box (`/boxes/bulk` & `/boxes/move`).
- **Stok, Pindah Unit, Hapus Non-SN, & Ledger Aktivitas (`/api/stock`, `/api/activities`)**: Pencarian terpadu, cek duplikasi ID, input single/bulk/quantity, output single/keranjang keluar (`/out/bulk`), pindah unit `per_id` & `jumlah` antar Box/Tipe kompatibel (`/stock/move`), arsip & restore, kondisi item, hapus tunggal/massal item fisik ber-ID (`/items/:id`, `/items/bulk`) maupun stok jumlah non-SN (`/quantity`, `/quantity/bulk`), serta feed mutasi barang (tanpa log login/logout/akun) & koreksi append-only (`/activities/:id/correct`).
- **Request & Multi-Tas (`/api/requests`, `/api/checklists`)**: Permohonan ambil satuan, paket tas (`/requests/bag`), pengembalian (`request_type: 'kembalikan'`), pengajuan pembelian barang (`request_type: 'beli'` dengan WA selektif), persetujuan, serah terima (`/pickup`), verifikasi kembali (`/return`), selesai pemakaian/pembelian (`/complete`), barang di tangan teknisi (`/held`), dan CRUD Multi-Tas (`/checklists/bags`).
- **Laporan, Pola SN, Dual WA Gateway, Setting & Diagnostik, Tiket & Backup**: `/api/reports/weekly`, `/debug-clock`, & `/approval-config`, `/api/sn-patterns`, `/api/whatsapp/*` (4 slot ON/OFF + **Dual Gateway** & `/test-gateway` khusus `developer`), `/api/setup/*` (`SystemSetupService` + `test-login`), `/api/tickets/consume` & `/keys`, serta `/api/backup/inventory/download`.

*(Daftar lengkap seluruh rute, metode HTTP, dan otorisasi peran tersedia pada [`docs/DEPLOY.md`](./docs/DEPLOY.md), [`docs/PERAN_DAN_AKSES.md`](./docs/PERAN_DAN_AKSES.md), dan [`docs/SKRIP_CLI.md`](./docs/SKRIP_CLI.md).)*

---

## ⚙️ 4. PROSEDUR PEMELIHARAAN SISTEM (MAINTENANCE PROCEDURES)

### A. Prosedur Cadangan Data (Backup & Restore)
1. **Backup Harian Otomatis & Manual (JSON Bebas Akun)**:
   - `BackupService` menyimpan cadangan data bisnis (tanpa kredensial/hash pengguna) secara berkala di folder `./backups/`.
   - Developer & Admin dapat mengunduh snapshot JSON via `GET /api/backup/inventory/download` (tab **Setting → Database, Backup & Kotak Sampah**).
2. **Cadangan Native MariaDB (`mariadb-dump`)**:
   ```bash
   docker compose exec mariadb mariadb-dump -u root -p"$DB_ROOT_PASSWORD" fieldops_inventory > backup_fieldops_$(date +%F).sql
   ```
3. **Pemulihan Data Hapus Permanen (Retensi 14 Hari)**:
   ```bash
   npm run sampah -- --list
   npm run sampah -- --pulihkan <ID_SAMPAH> --dry-run
   npm run sampah -- --pulihkan <ID_SAMPAH>
   ```

### B. Proteksi Ekspor Data (Injeksi Formula CWE-1236)
Seluruh fungsi ekspor CSV (`/api/reports/export/csv`) dan ExcelJS (`frontend/src/utils/excelExporter.ts`) wajib melewati `sanitizeFormulaInput()`, yang menambahkan awalan petik tunggal (`'`) pada nilai string yang diawali karakter eksekusi formula (`=`, `+`, `-`, `@`, `\t`, `\r`).

### C. Troubleshooting Umum & Penanganan Insiden

| Insiden / Gejala | Penyebab Kemungkinan | Langkah Penanganan |
| :--- | :--- | :--- |
| **HTTP 401 pada endpoint `/api/*`** | Sesi cookie kedaluwarsa atau belum login | Login ulang; periksa pengaturan cookie & `ACCESS_TOKEN_TTL_DETIK` di tabel `pengaturan`. |
| **HTTP 403 saat ubah pengaturan / hapus katalog** | Peran tidak memenuhi syarat atau belum menyertakan token Konfirmasi Tingkat 2/3 | Pastikan peran sesuai matriks RBAC (`docs/PERAN_DAN_AKSES.md`) dan lengkapi dialog konfirmasi in-app. |
| **Gagal terhubung ke MariaDB saat startup** | Layanan MariaDB belum siap atau kredensial `.env` salah | Periksa `DB_HOST`, `DB_USER`, `DB_PASSWORD`, dan status container `docker compose ps`. |
| **Notifikasi WhatsApp tidak terkirim** | Token Fonnte kosong, akun di luar jam aktif, atau tertahan jeda *cooldown* 15 menit | Cek konfigurasi di **Setting → Notifikasi WhatsApp Alert** dan log pengiriman `GET /api/whatsapp/logs`. |
| **Pencetakan Label A4 meluap ke 2 halaman** | Pengaturan margin cetak browser aktif | Pastikan skala cetak 100%, ukuran kertas A4, dan margin default CSS `@page { margin: 0 }` tidak ditimpa printer. |
| **Tampilan web tertahan di build produksi lama** | Cache proxy/reverse proxy eksternal menyimpan shell lama | Sejak `v1.2.8.5`, shell HTML, `sw.js`, dan `build-meta.json` mengirim header `no-store` serta `appUpdater.ts` memuat ulang otomatis saat aman; jika memakai CDN/proxy eksternal, pastikan `Cache-Control: no-store` tidak di-override. |
