# PANDUAN DEPLOYMENT & OPERASIONAL SERVER (DEPLOY.MD)

**Aplikasi**: FieldOps IT Inventory (Rilis Versi 1.2.7)  
**Infrastruktur**: Docker Container (Ubuntu Server / Windows Docker Desktop) / Native Node.js  
**Database**: MariaDB 11.4 LTS (Container Terisolasi / Standalone)  
**Akses Jarak Jauh**: Cloudflare Tunnel (HTTPS Tanpa Buka Port Router)

---

## 📋 1. Prasyarat Perangkat Keras & Perangkat Lunak

Sebelum memulai pemasangan, pastikan server atau PC kantor memenuhi kebutuhan berikut:

- **Perangkat Keras Minimum**: 2 CPU Core, 4 GB RAM, 50 GB Storage.
- **Sistem Operasi**: 
  - Ubuntu Server 22.04 / 24.04 LTS *(Direkomendasikan)*, atau
  - Windows 10/11 Pro / Windows Server 2019/2022.
- **Perangkat Lunak Wajib**:
  - **Linux Ubuntu**: Docker Engine (v24.0+) & Docker Compose V2 (`docker compose`).
  - **Windows**: Docker Desktop for Windows (aktifkan fitur *WSL 2 Backend*).
  - **Git**: Untuk mengkloning kode sumber.

---

## 🚀 2. Panduan Instalasi Pertama Kali (Fresh Installation)

Ikuti 5 langkah berikut untuk memasang aplikasi di server kantor dari nol:

### Langkah 1: Kloning Repositori
Buka Terminal (Ubuntu) atau PowerShell / Command Prompt (Windows), lalu jalankan:
```bash
git clone https://github.com/fath116-arch/App-storage.git fieldops
cd fieldops
```

### Langkah 2: Buat & Konfigurasi File `.env`
Salin file templat `.env.example` menjadi `.env`:
- **Ubuntu/Linux**:
  ```bash
  cp .env.example .env
  nano .env
  ```
- **Windows (PowerShell)**:
  ```powershell
  copy .env.example .env
  notepad .env
  ```

Isi variabel lingkungan berikut pada file `.env` sesuai `.env.example`:
```ini
PORT=3000
NODE_ENV=production

# Kunci Rahasia Internal (Buat string acak dan panjang)
APP_SECRET_KEY=kunci_rahasia_internal_super_panjang_dan_acak_2026

# Password Database MariaDB (Wajib Diisi & Rahasia)
DB_HOST=mariadb
DB_PORT=3306
DB_NAME=fieldops_inventory
DB_USER=fieldops_user
DB_PASSWORD=buat_password_database_user_rahasia_disini
DB_ROOT_PASSWORD=buat_password_root_mariadb_rahasia_disini

# Konfigurasi Frontend (Opsional, kosongkan untuk same-origin)
VITE_API_BASE_URL=
VITE_APP_TITLE=FieldOps IT Inventory

# Konfigurasi WhatsApp Gateway (Fonnte)
WHATSAPP_API_TOKEN=token_fonnte_resmi_anda_disini
WHATSAPP_API_URL=https://api.fonnte.com/send
WHATSAPP_TARGET_PHONES=081299998888,081377776666
WHATSAPP_AUTO_ALERT=true

# Token Cloudflare Tunnel (Akses HTTPS Jarak Jauh Atasan)
CLOUDFLARE_TUNNEL_TOKEN=
```

### Langkah 3: Build & Jalankan Kontainer Docker
Jalankan perintah berikut untuk membangun image, mengaktifkan kontainer, dan memicu migrasi database otomatis (`01` s/d `12`):
```bash
docker compose up -d --build
```

Pastikan seluruh kontainer berada dalam status sehat (*healthy* / *running*):
```bash
docker compose ps
```

### Langkah 4: Setup Koneksi, Akun Admin Pertama, & Cek Sistem via CLI
Gunakan suite skrip setup interaktif di kontainer backend (atau kelola langsung dari menu web **Setting** setelah login):
```bash
# Lihat seluruh command setup yang tersedia
docker compose exec backend npm run setup:help

# Konfigurasi koneksi DB / Cloudflare Tunnel / WhatsApp Fonnte (opsional jika sudah isi .env)
docker compose exec backend npm run setup:db
docker compose exec backend npm run setup:tunnel
docker compose exec backend npm run setup:wa

# Buat akun Master Admin / Developer pertama (wajib)
docker compose exec backend npm run setup:admin

# Verifikasi apakah database, admin, WA, & Cloudflare Tunnel sudah terhubung
docker compose exec backend npm run setup:check
```
*(Penjelasan detail tiap skrip dan flag tersedia pada [`docs/SKRIP_CLI.md`](./SKRIP_CLI.md).)*

### Langkah 5: Membuka Aplikasi dari PC Lain di Jaringan Kantor
1. Cek alamat IP lokal server kantor:
   - **Ubuntu**: `hostname -I` atau `ip a`
   - **Windows**: `ipconfig`
   *(Contoh IP Server: `192.168.1.50`)*
2. Dari PC/smartphone teknisi lain yang terhubung ke Wi-Fi / LAN kantor yang sama, buka browser dan akses:
   ```
   http://192.168.1.50:3000
   ```

---

## 🔄 3. Prosedur Pembaruan Aplikasi (Update Code)

Bila terdapat pembaruan kode aplikasi dari repositori Git, lakukan langkah pembaruan aman berikut:

1. **Lakukan Cadangan Data Terlebih Dahulu**:
   Download berkas backup JSON dari menu **Setting → Database, Backup & Sampah** pada UI aplikasi, atau periksa folder `backups/`.
2. **Tarik Kode Terbaru dari Git**:
   ```bash
   git pull origin main
   ```
3. **Build Ulang Kontainer Docker**:
   ```bash
   docker compose up -d --build
   ```
4. **Periksa Status Server**:
   ```bash
   docker compose ps
   docker compose logs -f backend
   ```

---

## 💾 4. Kebijakan Cadangan (Backup) & Pemulihan (Restore)

### A. Cadangan Otomatis Harian (Lokal)
Secara otomatis, backend membuat snapshot data bisnis berkala ke folder `./backups/` di server:
- File `backup_inventory_items_YYYY-MM-DD.json` berisi data master barang, katalog, transaksi, dan checklist — **100% aman dan bebas dari password pengguna**.

### B. Menyalin Backup ke Luar Server (Offsite Backup)
Untuk mengamankan data dari risiko kerusakan fisik server:
- **Salinan Manual**: Salin isi folder `./backups/` ke flashdisk / external drive.
- **Salinan Otomatis (Ubuntu Cronjob ke NAS/S3/Drive)**:
  ```bash
  crontab -e
  ```
  Tambahkan baris cron untuk menyalin cadangan setiap pukul 02:00 pagi:
  ```cron
  0 2 * * * rsync -avz --delete /opt/fieldops/backups/ /mnt/nas/fieldops_backups/
  ```

### C. Pemulihan Data (Restore)
Jika terjadi galat atau server baru dipasang, pulihkan data melalui:
1. Buka tab **Setting → Database, Backup & Sampah** (khusus `admin`/`developer`) pada antarmuka web.
2. Unggah berkas backup JSON yang tersedia.
3. Data inventaris dipulihkan secara atomik tanpa merusak tabel akun pengguna.

---

## 🛠️ 5. Penanganan Masalah (Troubleshooting)

### 1. Kontainer Tidak Jalan / Error saat `docker compose up`
- **Penyebab**: Variabel `.env` belum diisi.
- **Solusi**: Pastikan file `.env` sudah dibuat dari `.env.example` dan variabel `DB_PASSWORD`, `DB_ROOT_PASSWORD`, serta `APP_SECRET_KEY` sudah terisi, lalu jalankan `npm run setup:check`.

### 2. Cara Melihat Log Server Realtime
Gunakan perintah berikut untuk mendiagnosis error:
```bash
# Lihat log seluruh kontainer
docker compose logs -f

# Lihat log khusus backend saja
docker compose logs -f backend

# Lihat log khusus MariaDB saja
docker compose logs -f mariadb
```

### 3. Lupa Password Admin
Jalankan kembali skrip setup admin di dalam kontainer untuk mereset kata sandi akun admin:
```bash
docker compose exec backend npm run setup:admin
```
Pilih `y` saat ditanya apakah ingin memperbarui kata sandi akun yang sudah ada.

### 4. Pemulihan Data dari Tempat Sampah (14-Day Retention)
Jika terjadi penghapusan permanen tidak sengaja oleh pengguna (kategori, produk, storage box, atau akun), administrator server dapat memulihkan data melalui terminal dalam masa tenggang 14 hari:
```bash
# Melihat daftar entri yang dapat dipulihkan
npm run sampah -- --list

# Uji coba pemulihan tanpa mengubah data (Dry-Run)
npm run sampah -- --pulihkan <ID_SAMPAH> --dry-run

# Mengeksekusi pemulihan data ke sistem aktif
npm run sampah -- --pulihkan <ID_SAMPAH>
```

### 5. Bentrok Port 3000 atau 3306
Jika port 3000 sudah digunakan oleh aplikasi lain di server kantor:
1. Buka file `docker-compose.yml`.
2. Ubah pemetaan port backend, misalnya dari `"3000:3000"` menjadi `"8080:3000"`.
3. Buka aplikasi di browser via `http://<IP-SERVER>:8080`.

---

## 🌐 6. Panduan Khusus Per Platform Server

### A. Windows Server / PC Windows Kantor
1. **Pengaturan Docker Desktop**:
   - Buka **Docker Desktop Settings** > **General** > Centang *"Start Docker Desktop when you log in"*.
   - Pada **Resources** > **WSL Integration**, pastikan distro Linux WSL 2 diaktifkan.
2. **IP Statis (Fixed IP) Windows**:
   - Pastikan PC Windows menggunakan IP lokal tetap di router kantor (misal via DHCP Reservation di Mikrotik/Router kantor) agar IP server tidak berubah-ubah saat PC di-restart.

### B. Ubuntu Server Kantor
1. **Pengaturan Autostart Systemd**:
   - Docker service di Ubuntu otomatis aktif saat booting server. Untuk memastikan statusnya:
     ```bash
     sudo systemctl enable docker
     ```
2. **Hak Akses User**:
   - Agar tidak perlu mengetik `sudo` saat menjalankan Docker, masukkan user ke grup docker:
     ```bash
     sudo usermod -aG docker $USER
     newgrp docker
     ```

---

## 💻 7. Panduan Alternatif Pemasangan Standalone (Tanpa Docker / Native Node.js + MariaDB)

Jika PC atau server kantor **tidak dapat menjalankan Docker** (karena keterbatasan spesifikasi, edisi Windows tanpa fitur Virtualisasi/WSL 2, atau kebijakan sistem), gunakan metode pemasangan native berikut:

### Prasyarat Pemasangan Native:
1. **Node.js LTS (v22.x+)**: Unduh & pasang dari [nodejs.org](https://nodejs.org/).
2. **MariaDB Server (v11.x+)**: Unduh & pasang dari [mariadb.org](https://mariadb.org/download/).
3. **Git for Windows / Linux**: Untuk mengkloning kode sumber.

### Langkah-Langkah Pemasangan Standalone:

1. **Kloning Repositori**:
   ```bash
   git clone https://github.com/fath116-arch/App-storage.git fieldops
   cd fieldops
   ```

2. **Buat Database MariaDB**:
   Buka MariaDB Command Line Client atau GUI seperti HeidiSQL / DBeaver, lalu jalankan:
   ```sql
   CREATE DATABASE fieldops_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **Impor Skema Migration SQL (`01` s/d `13`)**:
   *(Catatan: `initDatabase()` saat startup backend dan `npm run setup:db -- --migrate` juga menjalankan migrasi otomatis yang idempoten.)*
   - **Linux / Ubuntu**:
     ```bash
     for f in backend/src/db/migrations/*.sql; do
       mysql -u root -p fieldops_inventory < "$f"
     done
     ```
   - **Windows (PowerShell)**:
     ```powershell
     Get-ChildItem backend\src\db\migrations\*.sql | Sort-Object Name | ForEach-Object {
       Get-Content $_.FullName | mysql -u root -p fieldops_inventory
     }
     ```

4. **Konfigurasi File `.env` (Manual atau Interaktif `npm run setup:*`)**:
   Salin `.env.example` menjadi `.env`, atau langsung jalankan skrip setup interaktif:
   ```bash
   npm run setup:db -- --migrate
   npm run setup:tunnel
   npm run setup:wa
   ```
   Contoh isi `.env` standalone:
   ```ini
   PORT=3000
   NODE_ENV=production
   APP_SECRET_KEY=kunci_rahasia_internal_super_panjang_dan_acak_2026

   # Konfigurasi MariaDB Lokal (Standalone)
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=fieldops_inventory
   DB_USER=root
   DB_PASSWORD=password_mariadb_lokal_anda
   CLOUDFLARE_PUBLIC_URL=
   ```

5. **Install Dependensi & Build Assets**:
   ```bash
   npm install
   npm run build
   ```

6. **Buat Akun Admin Pertama & Cek Koneksi Sistem**:
   ```bash
   npm run setup:admin
   npm run setup:check
   ```

7. **Jalankan Aplikasi Produksi**:
   ```bash
   npm start
   ```
   *Aplikasi kini aktif dan dapat diakses dari PC lain di jaringan lokal melalui `http://<IP-SERVER-KANTOR>:3000`.*

---

## 🌐 8. Daftar Endpoint API Kanonik Aktif (v1.2.7)

| Prefix Route | Endpoint Terverifikasi | Keterangan |
| :--- | :--- | :--- |
| `/api/health` | `GET /` | Status kesehatan server, versi `1.2.7`, & status UTC MariaDB |
| `/api/setup` | `GET /status`, `POST /check`, `POST /database`, `POST /tunnel`, `POST /whatsapp`, `POST /test-login` | Diagnostik koneksi sistem (`.env`, DB, Admin, WA, Cloudflare Tunnel), tes login 6 tahap, simpan konfigurasi ke `.env`, reload pool DB, & katalog CLI (`developer`/`admin`) |
| `/api/auth` | `POST /login`, `/register`, `/refresh`, `/logout`, `/reset-password`, `/confirm-token`; `GET /me`, `/actors`; `GET/POST/DELETE /users`, `POST /users/:id/(approve\|reject\|status\|reset-password\|revoke-sessions)`; `GET /settings`, `PUT /settings/:key`; `GET /activity-logs`, `/activity-logs/:id/details`; `GET /trash`, `POST /trash/purge` | Autentikasi cookie HTTP-only 30 hari, RBAC, konfirmasi Tier 2/3, daftar aktor lapangan, & tempat sampah 14 hari |
| `/api/catalog` | `GET /jenis`, `/jenis/:id`, `POST/PUT/DELETE /jenis/:id`; `GET /jenis/:id/attributes`, `POST/PUT/DELETE /attributes/:id`, `POST /attributes/:id/options`; `GET /tipe-stok-suggestions`; `GET/POST/PUT/DELETE /products/:id`; `GET /products/:id/types`, `POST /types`, `PUT /types/:id/id-rule`; `GET /labels` | Manajemen penuh Kategori, Atribut, Opsi, Produk, Varian Tipe, aturan ID (`id_dikunci`), hapus terproteksi stok aktif, & data cetak label A4 |
| `/api/boxes` | `GET /`, `GET /:id`, `POST /`, `POST /move`, `DELETE /:id` | Manajemen storage box campuran, relokasi antar box, & hapus box kosong terproteksi |
| `/api/stock` | `GET /search`, `GET /check-id/:kode_id`, `GET /types/:id/items`, `POST /single`, `/bulk`, `/quantity`, `/out`, `/out/bulk`, `GET /archive`, `POST /restore`, `PUT /items/:id/condition` | Pencarian 300ms, input stok, keranjang keluar, arsip, restore, & pembaruan kondisi item fisik |
| `/api/activities` | `GET /`, `GET /:id/details`, `POST /:id/correct` | Feed transaksi kanonik & pencatatan koreksi audit append-only (`correction_of_id`) |
| `/api/requests` | `POST /` (`ambil` / `kembalikan` / `beli`), `POST /bag`, `GET /`, `/held`, `/open-for-actor/:actorId`, `/:id`, `/:id/timeline`, `POST /:id/(approve\|pickup\|return\|complete\|reject\|cancel)` | Siklus lengkap permohonan satuan, pengajuan pembelian barang (katalog/baru + WA selektif), paket tas, pengajuan pengembalian 3 kondisi, barang di tangan teknisi, & penandaan selesai |
| `/api/checklists` | `GET/POST/PUT/DELETE /bags`, `GET /`, `POST /` | Manajemen Multi-Tas Kerja Lapangan (`BAG_TEMPLATE`) & catatan inspeksi harian (`TOOLKIT_CHECK`) |
| `/api/reports` | `GET /weekly`, `GET /debug-clock`, `GET /export/csv`, `GET/PUT /approval-config` | Rekap mingguan WIB (Senin 00:00 – Minggu 23:59:59 WIB), verifikasi jam UTC/WIB, ekspor CSV CWE-1236, & konfigurasi Kop/Lembar Pengesahan dinamis |
| `/api/sn-patterns` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | Manajemen pola regex `SCAN_SN` & aturan normalisasi barcode (`pengaturan.SN_PATTERNS`; edit oleh `developer`/`admin`/`warehouse_admin`) |
| `/api/whatsapp` | `GET /config`, `POST /config`, `GET /thresholds`, `POST /thresholds`, `POST /evaluate`, `POST /send`, `POST /test`, `GET /logs` | Konfigurasi alert Fonnte (maks 4 slot penerima dengan saklar ON/OFF individual), ambang berjenjang (*tipe > produk > global*), cooldown 15 menit, & log pengiriman |
| `/api/tickets` | `POST /consume`, `GET /keys`, `POST /keys` | Webhook auto-deduct tiket eksternal via `X-API-Key`/Bearer & manajemen API key |
| `/api/backup` | `GET /inventory/download` | Unduh snapshot JSON inventaris bebas kredensial akun (`developer`/`admin`) |
