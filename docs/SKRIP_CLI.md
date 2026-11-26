# Panduan Lengkap Skrip CLI & Setup Sistem (`SKRIP_CLI.md`)

**Aplikasi**: FieldOps IT Inventory (`v1.2.8.5`)  
**Cakupan**: Seluruh skrip NPM (`package.json`) dan utilitas CLI di `backend/src/scripts/`

Dokumen ini menjadi referensi resmi seluruh perintah terminal yang tersedia di **FieldOps IT**, baik untuk instalasi awal server, konfigurasi integrasi (MariaDB, Cloudflare Tunnel, WhatsApp Fonnte), pemeriksaan kesehatan sistem, pemulihan Kotak Sampah 14 hari, maupun kompilasi & runtime aplikasi.

> **Lokasi Menjalankan Perintah & Berkas `.env`**:
> - **Bisa dijalankan dari Root maupun `backend/`**: Seluruh skrip `setup:*`, `sampah`, dan `test:backup` kini terdaftar di `package.json` **root** maupun `backend/package.json`.
> - **Berkas `.env` yang Dipakai**: Berkas **`.env` utama selalu berada di root proyek** (`/.env`), sekaligus menjadi target penyimpanan otomatis saat menjalankan `setup:*` atau menyimpan dari tab **Setting**. Jika Anda sudah memiliki `backend/.env`, sistem membacanya otomatis sebagai **fallback** untuk variabel yang belum diisi di `.env` root (tanpa menimpa nilai root).

---

## 📋 1. Ringkasan Seluruh Skrip di `package.json` (Root & `backend/`)

### A. Suite Skrip Setup & Diagnostik (`setup:*`)

Seluruh skrip setup mendukung **mode interaktif** (tanya-jawab di terminal) sekaligus **mode non-interaktif / otomasi** melalui argumen flag CLI (`--flag value`).

| Perintah | File Skrip | Fungsi Utama |
| :--- | :--- | :--- |
| `npm run setup:help` | `backend/src/scripts/setupHelp.ts` | Menampilkan daftar lengkap seluruh command setup, skrip utilitas, dan ringkasan fungsinya di terminal. |
| `npm run setup:list` | `backend/src/scripts/setupHelp.ts` | Alias dari `npm run setup:help`. |
| `npm run setup:db` | `backend/src/scripts/setupDatabase.ts` | Mengatur kredensial koneksi MariaDB (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`), menguji koneksi langsung, menyimpan ke `.env`, dan opsional menjalankan migrasi database. |
| `npm run setup:admin` | `backend/src/scripts/setupAdmin.ts` | Membuat akun Master Admin / Developer / Pengelola / Teknisi pertama langsung di database, atau mereset kata sandi dan peran akun yang sudah ada. |
| `npm run setup:test-login` | `backend/src/scripts/setupTestLogin.ts` | Menguji diagnosa login bertahap: lookup akun, status `ACTIVE`, kecocokan kata sandi PBKDF2, probe tulis `sessions`/`sesi` MariaDB, dan kesiapan tabel `transaksi`. |
| `npm run setup:tunnel` | `backend/src/scripts/setupTunnel.ts` | Menyimpan `CLOUDFLARE_TUNNEL_TOKEN` & `CLOUDFLARE_PUBLIC_URL` ke `.env`, memvalidasi struktur token Tunnel, dan menguji endpoint `/api/health` via URL publik. |
| `npm run setup:wa` | `backend/src/scripts/setupWhatsapp.ts` | Mengatur integrasi WhatsApp Gateway **Fonnte** (`WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_TARGET_PHONES`, `WHATSAPP_AUTO_ALERT`), menyinkronkannya ke `.env` dan tabel `wa_config`, serta mengirim pesan tes jika diminta. |
| `npm run setup:check` | `backend/src/scripts/setupCheck.ts` | Memeriksa kesiapan menyeluruh: ketersediaan `.env`, koneksi MariaDB, akun Admin/Developer aktif, konfigurasi WhatsApp Fonnte, serta status Cloudflare Tunnel & akses `/api/health`. |

---

### B. Skrip Pemeliharaan & Pengujian Operasional

| Perintah | File Skrip | Fungsi Utama |
| :--- | :--- | :--- |
| `npm run sampah` | `backend/src/scripts/sampahCli.ts` | Mengelola Kotak Sampah retensi 14 hari (`sampah_hapus`): melihat daftar item terhapus permanen, simulasi pemulihan (*dry-run*), memulihkan data kembali ke sistem aktif, atau membersihkan entri kedaluwarsa. |
| `npm run test:backup` | `backend/src/scripts/testBackupRestore.ts` | Menguji end-to-end proses pembuatan backup JSON inventaris, memverifikasi bebas kredensial akun (*Zero Account Leakage*), serta menguji pemulihan data tanpa merusak tabel `users`. |

---

### C. Skrip Runtime, Build, & Kualitas Kode

| Perintah | Perintah Internal | Fungsi Utama |
| :--- | :--- | :--- |
| `npm run dev` | `tsx backend/src/server.ts` | Menjalankan server Express 5 + Vite middleware pada mode pengembangan di port `3000`. |
| `npm run start` | `cross-env NODE_ENV=production tsx backend/src/server.ts` | Menjalankan server produksi (Express API + aset frontend terkompilasi dari `dist/` dengan header anti-cache & dukungan lintas OS Windows/Linux). |
| `npm run build` | `npm run build:frontend` | Memicu proses build frontend produksi ke direktori `dist/`. |
| `npm run build:frontend` | `vite build --outDir dist frontend` | Membundel aplikasi React 19 + Tailwind CSS v4 menggunakan Vite. |
| `npm run build:backend` | `tsc --noEmit` | Memeriksa ketepatan tipe TypeScript (`tsconfig.json`) tanpa menghasilkan file keluaran JS. |
| `npm run lint` | `tsc --noEmit` | Menjalankan pengecekan tipe & impor TypeScript untuk seluruh kode frontend dan backend. |
| `npm run preview` | `vite preview frontend` | Menjalankan server pratinjau lokal terhadap hasil build frontend. |
| `npm run clean` | `rm -rf frontend/dist dist` | Menghapus direktori hasil kompilasi build frontend lama. |

---

## 🛠️ 2. Detail Pemakaian & Flag Tiap Skrip Setup & Utilitas

> **Penting saat memakai `npm run`**: Tambahkan pemisah `--` sebelum menuliskan argumen flag agar NPM meneruskan flag ke skrip (contoh: `npm run setup:check -- --json`).

### 1. `npm run setup:help` / `npm run setup:list`
Menampilkan katalog seluruh perintah setup & pemeliharaan yang tersedia beserta deskripsinya.
```bash
npm run setup:help
npm run setup:list
```

### 2. `npm run setup:db` — Konfigurasi & Uji Koneksi MariaDB
Mengisi variabel `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, dan `DB_ROOT_PASSWORD` ke file `.env` lokal lalu menguji koneksi pool MariaDB.

- **Mode Interaktif**:
  ```bash
  npm run setup:db
  ```
- **Mode Non-Interaktif (Flag CLI)**:
  ```bash
  npm run setup:db -- --host 127.0.0.1 --port 3306 --name fieldops_inventory --user fieldops_user --password rahasia --migrate
  ```
- **Daftar Flag**:
  - `--host <alamat>`: Alamat host MariaDB (misal `mariadb` untuk Docker atau `127.0.0.1` untuk native).
  - `--port <angka>`: Port MariaDB (default `3306`).
  - `--name <nama_db>`: Nama database target.
  - `--user <username>`: Nama user database aplikasi.
  - `--password <sandi>`: Kata sandi user database (pada mode interaktif input disembunyikan / *masked*).
  - `--root-password <sandi>`: Kata sandi `root` MariaDB untuk kebutuhan kontainer/administrasi.
  - `--migrate`: Menjalankan `initDatabase()` untuk memverifikasi dan mengeksekusi migrasi SQL `01` s/d `12` secara otomatis setelah koneksi berhasil.

### 3. `npm run setup:admin` — Inisialisasi & Reset Akun Master Admin
Membuat akun pertama (default peran `developer`) atau mereset kata sandi + peran akun yang sudah ada di tabel `users` dengan hashing **PBKDF2 SHA-256 (100.000 iterasi, 16-byte salt)**.

- **Mode Interaktif**:
  ```bash
  npm run setup:admin
  ```
- **Mode Non-Interaktif (Flag CLI)**:
  ```bash
  npm run setup:admin -- --username developer --name "Lead Developer" --email developer@fieldops.local --role developer --password SandiKuatAnda
  ```
- **Daftar Flag**:
  - `--username <username>`
  - `--name <nama_lengkap>`
  - `--email <email>`
  - `--role <developer|admin|warehouse_admin|technician>`
  - `--password <kata_sandi>`

### 4. `npm run setup:tunnel` — Konfigurasi Cloudflare Tunnel
Menyimpan token Cloudflare Tunnel dan URL publik HTTPS ke `.env`, memvalidasi token Tunnel (mendukung token Base64 JSON berproperti `t`/`a` dari Zero Trust maupun format JWT), serta menguji endpoint publik `/api/health` jika URL diisi.

- **Mode Interaktif**:
  ```bash
  npm run setup:tunnel
  ```
- **Mode Non-Interaktif (Flag CLI)**:
  ```bash
  npm run setup:tunnel -- --token <TOKEN_CLOUDFLARE> --url https://inventaris.kantor.id
  ```
- **Menghapus Token Tunnel dari `.env`**:
  ```bash
  npm run setup:tunnel -- --clear
  ```
- **Catatan Docker**: Bila token diubah pada server Docker Compose, terapkan ke kontainer `cloudflared` dengan:
  ```bash
  docker compose up -d --force-recreate cloudflared
  ```

### 5. `npm run setup:wa` — Konfigurasi WhatsApp Gateway (Fonnte)
Menulis konfigurasi Fonnte ke `.env` (`WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_TARGET_PHONES`, `WHATSAPP_AUTO_ALERT`) dan otomatis menyinkronkan ke tabel `wa_config` di database bila MariaDB sedang terhubung.

- **Mode Interaktif**:
  ```bash
  npm run setup:wa
  ```
- **Mode Non-Interaktif + Kirim Pesan Uji**:
  ```bash
  npm run setup:wa -- --url https://api.fonnte.com/send --token <TOKEN_FONNTE> --phones 081234567890,081987654321 --enabled true --test
  ```
- **Daftar Flag**:
  - `--url <endpoint>`: Default `https://api.fonnte.com/send`.
  - `--token <api_token>`: Token akun Fonnte.
  - `--phones <daftar_nomor>`: Nomor WhatsApp tujuan dipisahkan koma.
  - `--enabled <true|false>`: Mengaktifkan atau menonaktifkan alert otomatis berjenjang.
  - `--test`: Mengirim pesan percobaan langsung ke nomor target pertama setelah menyimpan.

### 6. `npm run setup:check` — Pemeriksaan Koneksi & Status Sistem
Mengecek secara menyeluruh 5 komponen utama server dan melaporkan status **TERHUBUNG / PERINGATAN / BELUM TERKONFIGURASI**:
1. File `.env` lokal & variabel inti (`APP_SECRET_KEY`, dll).
2. Koneksi live **MariaDB** (versi server, latensi ping, & kelengkapan migrasi).
3. Ketersediaan akun aktif **Admin / Developer** di database.
4. Status konfigurasi **WhatsApp Gateway (Fonnte)** (token, nomor target, status aktif).
5. Status **Cloudflare Tunnel** (validitas token & pengujian HTTP GET `<CLOUDFLARE_PUBLIC_URL>/api/health` bila URL publik disetel).

- **Pemakaian**:
  ```bash
  npm run setup:check
  npm run setup:check -- --url https://inventaris.kantor.id
  npm run setup:check -- --json
  ```

### 6a. `npm run setup:test-login` — Diagnostik Tes Login & Kesiapan Sesi Akun
Menguji kelayakan login suatu akun di database aktif secara aman (tanpa menampilkan hash/salt):
1. Memastikan target runtime database (**MariaDB** vs **Memori Lokal**).
2. Mencari akun di tabel `users` dan memverifikasi status `ACTIVE`.
3. Menguji kecocokan kata sandi terhadap hash **PBKDF2 SHA-256** (atau memeriksa kelengkapan hash jika sandi dikosongkan).
4. Menjalankan probe tulis + pembersihan otomatis pada tabel `sessions` dan `sesi` untuk memastikan kompatibilitas ketat tipe `TIMESTAMP` dan IP.
5. Memeriksa kesiapan tabel `transaksi` untuk pencatatan audit login.

- **Pemakaian**:
  ```bash
  npm run setup:test-login
  npm run setup:test-login -- --username developer --password SandiAnda
  npm run setup:test-login -- --username developer --json
  ```

### 7. `npm run sampah` — Pemulihan Kotak Sampah 14 Hari
Meninjau dan memulihkan objek yang dihapus permanen (*soft delete* ke `sampah_hapus`) selama masa retensi 14 hari.
```bash
# 1. Lihat daftar data di kotak sampah
npm run sampah -- --list

# 2. Simulasi pemulihan tanpa mengubah database (Dry-Run)
npm run sampah -- --pulihkan <ID_SAMPAH> --dry-run

# 3. Pulihkan data ke sistem aktif (catat pelaku: 'terminal')
npm run sampah -- --pulihkan <ID_SAMPAH>

# 4. Bersihkan paksa entri yang sudah lewat 14 hari
npm run sampah -- --purge
```

### 8. `npm run test:backup` — Uji Integritas Backup & Restore
Menjalankan skrip verifikasi otomatis untuk memastikan file backup inventaris JSON di `backups/` bebas dari kredensial/hash/salt pengguna (*Zero Account Leakage*) dan dapat direstore kembali ke sistem tanpa mengganggu tabel `users`.
```bash
npm run test:backup
```

---

## 🐳 3. Menjalankan Skrip di Lingkungan Docker Compose

Jika aplikasi dijalankan menggunakan Docker (`docker-compose.yml`), jalankan skrip CLI langsung dari dalam kontainer `backend`:

```bash
# Daftar seluruh command setup
docker compose exec backend npm run setup:help

# Setup koneksi database / admin / tunnel / WhatsApp
docker compose exec backend npm run setup:db
docker compose exec backend npm run setup:admin
docker compose exec backend npm run setup:tunnel
docker compose exec backend npm run setup:wa

# Cek status seluruh koneksi sistem & diagnosa login akun
docker compose exec backend npm run setup:check
docker compose exec backend npm run setup:test-login -- --username developer

# Kelola tempat sampah 14 hari
docker compose exec backend npm run sampah -- --list
```

> **Catatan**: Jika ingin perubahan file `.env` ikut terbaca dari host setelah menjalankan `setup:*` di Docker, pastikan file `.env` host di **root proyek** tetap sinkron atau jalankan `docker compose up -d --force-recreate` bila mengubah token `cloudflared` maupun kredensial MariaDB.

---

## 🌐 4. Pengaturan Setara Melalui Antarmuka Website (Tab **Setting**)

Seluruh konfigurasi CLI di atas juga tersedia melalui tab **Setting** di antarmuka web FieldOps IT tanpa perlu membuka terminal server:

- **Peran `developer`** dapat mengakses seluruh kartu di tab **Setting** (termasuk Setup `.env`, Cek Sistem, Atur Fitur Slider Per Akun, Dual WhatsApp Gateway, API Key Tiket, Backup & Sampah).
- **Peran `admin`** dapat mengakses kartu operasional di tab **Setting**:
  1. **Manajemen Pengguna & `Log Aktivitas User`** (kelola akun `admin` & `technician`, serta lihat log login/logout/sesi/manajemen akun di `GET /api/auth/user-logs`).
  2. **Notifikasi WhatsApp Alert** (4 slot penerima ON/OFF, ambang stok berjenjang, pantauan produk, uji kirim & log pengiriman; *Gateway URL/Token dikunci khusus `developer`*).
  3. **Pengaturan Pola Serial Number (SN)** (`/api/sn-patterns`) & **Laporan Keamanan / Audit**.
- **Peran `technician`** tidak memiliki akses bawaan ke tab **Setting** (kecuali diberi izin fitur tertentu melalui slider **Atur Fitur** oleh `developer`).
