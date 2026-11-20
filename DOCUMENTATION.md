# DOCUMENTATION.md - Dokumentasi Teknis & Panduan Operasional FieldOps IT

![System Version](https://img.shields.io/badge/System_Version-v1.2.6-emerald.svg)
![React](https://img.shields.io/badge/React-19.3.0-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5.0.0-000000?logo=express)
![MariaDB](https://img.shields.io/badge/MariaDB-11.4_LTS-003545?logo=mariadb)
![Vite](https://img.shields.io/badge/Vite-8.3.0-646CFF?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38BDF8?logo=tailwindcss)
![Node](https://img.shields.io/badge/Node.js-22+_LTS-339933?logo=node.js)

Dokumen ini memuat panduan lengkap setup lingkungan, penjelasan arsitektur modul `frontend/` + `backend/` berbasis **MariaDB 11.4 LTS**, keamanan sesi server-authoritative, penggunaan REST API, serta prosedur pemeliharaan sistem **FieldOps IT (`v1.2.6`)**.

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

Salin file `.env.example` di root repositori menjadi `.env`:
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
5. **Jalankan Mode Produksi**:
   ```bash
   npm start
   ```
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
   - Mendukung 4 peran kanonis: `developer` (alias legacy `superadmin`), `admin`, `warehouse_admin`, dan `technician`.
2. **`InventoryContext.tsx`**:
   - Mengelola sinkronisasi satu sumber data kanonik dari endpoint `/api/catalog/*`, `/api/boxes`, `/api/stock/*`, `/api/activities`, dan `/api/requests/*`.
   - Setiap mutasi otomatis memanggil `refreshData()` tanpa perlu muat ulang halaman.
3. **`ToastContext.tsx` & `ThemeContext.tsx`**:
   - `ToastContext` menggantikan dialog `alert()`/`confirm()` bawaan browser dengan toast dan modal in-app (`ConfirmDeleteModal.tsx`).
   - `ThemeContext` mengelola preferensi `light`, `dark`, dan `system` melalui kelas `.dark` dan token CSS di `frontend/src/index.css`.
4. **Komponen Operasional Utama**:
   - **Katalog & Box**: `CatalogV2Manager.tsx` (subtab `Produk`, `Kategori`, `Storage Box`, `Kelola`), `BoxContentModal.tsx`, `BatchLabelPrintModal.tsx`.
   - **Mutasi & Scanner**: `StockInputModal.tsx` (`SCAN_SN` ketat + Uji Regex + `useBarcodeScanner.ts`), `StockInOutModal.tsx` (Keranjang Keluar multi-item + Hubungkan ke Request).
   - **Request & Tas Kerja**: `TechnicianRequestsView.tsx` (Ambil Satuan, Pilih Paket Tas, Kembalikan dengan 3 kondisi, Selesai Terpakai Pelanggan untuk Barang Habis Pakai), `FieldTripChecklistModal.tsx` (Inspeksi Harian + Manajemen Multi-Tas Kerja Kantor).
   - **Laporan & Audit**: `TransactionHistory.tsx` (Ledger append-only + Catat Koreksi Audit), `WeeklyReport.tsx` (Senin–Minggu WIB, ekspor `.xlsx` ExcelJS tersanitasi CWE-1236, `PrintReportModal.tsx`).

### C. Modul Layanan Backend (`backend/src/`)
1. **Keamanan, Sesi, & Kriptografi**:
   - Kata sandi di-hash dengan **PBKDF2 SHA-256** (100.000 iterasi, 16-byte random salt).
   - Token sesi (`fieldops_access`, `fieldops_refresh`, `fieldops_device`, `fieldops_session`) disimpan sebagai cookie **HttpOnly**, divalidasi di tabel `sesi` dengan rotasi refresh token anti-replay.
   - Aksi sensitif ditegakkan di server oleh `ConfirmationService` (`token_konfirmasi` sekali pakai, TTL 120 detik, Tingkat 0–3).
2. **Transaksi Atomik & Zona Waktu (`timezone.ts`)**:
   - Server mengunci `process.env.TZ = 'UTC'` untuk penyimpanan konsisten di MariaDB, sementara seluruh tampilan UI, perhitungan ID Aktivitas (`AKT-YYYYMMDD-NNNN`), dan rekap laporan menggunakan zona waktu **WIB (`Asia/Jakarta`)**.
   - Mutasi stok (`StockService`, `RequestService`, `TicketIntegration`) dijalankan dalam `runTransaction()` untuk mencegah *race condition* dan menjaga konsistensi stok fisik vs reservasi (`dipesan` / `reserved_qty`).

---

## 🔌 3. RINGKASAN ENDPOINT API UTAMA

Seluruh endpoint REST berada di bawah prefix `/api/*` dengan autentikasi cookie sesi server (`requireAuth`), kecuali `/api/health`, `/api/auth/login`, `/api/auth/register`, `/api/auth/reset-password`, dan webhook `/api/tickets/consume` (menggunakan `X-API-Key` atau `Bearer <api_key>`):

- **Autentikasi & Administrasi (`/api/auth`)**: Login/refresh/logout, profil `/me`, daftar `/actors`, manajemen `/users`, `/confirm-token`, `/settings`, dan `/trash`.
- **Katalog & Storage Box (`/api/catalog`, `/api/boxes`)**: CRUD Kategori (`jenis`), Atribut & Opsi, Produk, Varian Tipe, aturan ID (`/types/:id/id-rule`), label cetak A4 (`/labels`), serta manajemen Storage Box dan pemindahan antar box (`/boxes/move`).
- **Stok & Ledger Aktivitas (`/api/stock`, `/api/activities`)**: Pencarian terpadu, cek duplikasi ID, input single/bulk/quantity, output single/keranjang keluar (`/out/bulk`), arsip & restore, kondisi item, serta feed aktivitas & koreksi append-only (`/activities/:id/correct`).
- **Request & Multi-Tas (`/api/requests`, `/api/checklists`)**: Permohonan ambil satuan, paket tas (`/requests/bag`), pengembalian (`/requests` dengan `request_type: 'kembalikan'`), persetujuan, serah terima (`/pickup`), verifikasi kembali (`/return`), selesai pemakaian pelanggan (`/complete`), barang di tangan teknisi (`/held`), dan CRUD Multi-Tas (`/checklists/bags`).
- **Laporan, Pola SN, WA Alert, Setting & Diagnostik, Tiket & Backup**: `/api/reports/weekly` & `/debug-clock`, `/api/sn-patterns`, `/api/whatsapp/*`, `/api/setup/*` (`SystemSetupService`), `/api/tickets/consume` & `/keys`, serta `/api/backup/inventory/download`.

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
