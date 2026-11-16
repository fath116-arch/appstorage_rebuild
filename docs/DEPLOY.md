# PANDUAN DEPLOYMENT & OPERASIONAL SERVER (DEPLOY.MD)

**Aplikasi**: FieldOps IT Inventory (Rilis Versi 1.2.6)  
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

Isi variabel wajib berikut pada file `.env`:
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

# Konfigurasi WhatsApp Gateway (Fonnte)
WHATSAPP_API_TOKEN=token_fonnte_resmi_anda_disini
WHATSAPP_API_URL=https://api.fonnte.com/send
WHATSAPP_TARGET_PHONES=081299998888,081377776666
WHATSAPP_AUTO_ALERT=true

# Token Cloudflare Tunnel (Akses HTTPS Jarak Jauh Atasan)
CLOUDFLARE_TUNNEL_TOKEN=
```

### Langkah 3: Build & Jalankan Kontainer Docker
Jalankan perintah berikut untuk mengunduh image, membangun kontainer, dan mengaktifkan service:
```bash
docker compose up -d --build
```

Pastikan seluruh kontainer berada dalam status sehat (*healthy* / *running*):
```bash
docker compose ps
```

### Langkah 4: Buat Akun Master Admin / Dev Superadmin Pertama
Jalankan skrip inisialisasi akun admin interaktif di dalam kontainer backend:
```bash
docker compose exec backend npm run setup:admin
```
Sistem akan meminta username, nama lengkap, email, peran (`superadmin` / `supervisor` / `admin`), dan kata sandi kuat (minimal 8 karakter).

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
   Download berkas backup JSON dari menu **Admin / Restore Data** pada UI aplikasi, atau periksa folder `backups/`.
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
Secara otomatis, backend membuat snapshot data bisnis setiap 24 jam ke folder `./backups/` di server:
- File `backup_inventory_items_YYYY-MM-DD.json` berisi data master barang, kategori, transaksi, dan checklist — **100% aman dan bebas dari password pengguna**.

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
1. Buka menu **Admin / Restore Data** pada antarmuka web.
2. Unggah berkas `backup_inventory_items_YYYY-MM-DD.json`.
3. Data barang dan transaksi akan dipulihkan secara atomik tanpa merusak tabel akun pengguna.

---

## 🛠️ 5. Penanganan Masalah (Troubleshooting)

### 1. Kontainer Tidak Jalan / Error saat `docker compose up`
- **Penyebab**: Variabel `.env` belum diisi.
- **Solusi**: Pastikan file `.env` sudah dibuat dari `.env.example` dan variabel `DB_PASSWORD`, `DB_ROOT_PASSWORD`, serta `APP_SECRET_KEY` sudah terisi.

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
Pilih `y` saat ditanya apakah ingin mereset kata sandi akun yang sudah ada.

### 4. Pemulihan Data dari Tempat Sampah (14-Day Retention)
Jika terjadi penghapusan permanen tidak sengaja oleh pengguna, administrator server dapat memulihkan data melalui terminal dalam masa tenggang 14 hari:
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
   - Pada **Resources** > **WSL Integration**, pastikan distrik Linux WSL 2 diaktifkan.
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
     sudo usermod aG docker $USER
     newgrp docker
     ```

---

## 💻 8. Panduan Alternatif Pemasangan Standalone (Tanpa Docker / Native Node.js + MariaDB)

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

3. **Impor Skema Migration SQL (`01` s/d `12`)**:
   *(Catatan: `initDatabase()` saat startup backend juga menjalankan migrasi otomatis yang idempoten.)*
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

4. **Konfigurasi File `.env`**:
   Salin `.env.example` menjadi `.env`, lalu isi kredensial MariaDB lokal:
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
   ```

5. **Install Dependensi & Build Assets**:
   ```bash
   npm install
   npm run build
   ```

6. **Buat Akun Admin Pertama**:
   ```bash
   npm run setup:admin
   ```

7. **Jalankan Aplikasi Produksi**:
   ```bash
   npm run start
   ```
   *Aplikasi kini aktif dan dapat diakses dari PC lain di jaringan lokal melalui `http://<IP-SERVER-KANTOR>:3000`.*

---

## 🌐 9. Daftar Endpoint API Kanonik Aktif (v1.2.6)

| Prefix Route | Endpoint Utama | Keterangan |
| :--- | :--- | :--- |
| `/api/auth` | `POST /login`, `/refresh`, `/logout`, `/confirm-token`, `GET /me`, `GET /actors`, `/users`, `/settings`, `/trash` | Autentikasi cookie server-authoritative, RBAC, daftar aktor lapangan, & sampah 14 hari |
| `/api/catalog` | `GET /jenis`, `GET /products`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`, `POST /types`, `PUT /types/:id`, `GET /labels` | Katalog produk & varian tipe tunggal beserta stok tersedia, rusak, & dipesan |
| `/api/boxes` | `GET /`, `GET /:id`, `POST /`, `POST /move` | Manajemen storage box & relokasi antar box |
| `/api/stock` | `GET /search`, `GET /check-id/:kode_id`, `GET /types/:id/items`, `POST /single`, `/bulk`, `/quantity`, `/out`, `/out/bulk`, `GET /archive`, `POST /restore`, `PUT /items/:id/condition` | Pencarian 300ms, input stok, keranjang keluar, arsip, restore, & update kondisi item |
| `/api/activities` | `GET /`, `GET /:id/details`, `POST /:id/correct` | Feed transaksi kanonik & pencatatan koreksi audit append-only (`correction_of_id`) |
| `/api/requests` | `POST /`, `GET /`, `GET /held`, `GET /open-for-actor/:actorId`, `GET /:id/timeline`, `POST /:id/approve`, `/pickup`, `/return`, `/reject`, `/cancel` | Siklus permohonan teknisi (`diajukan → disetujui → diambil → dikembalikan`) & barang di tangan teknisi |
| `/api/reports` | `GET /weekly`, `GET /debug-clock`, `GET /export/csv` | Rekap mingguan WIB (Senin 00:00 – Minggu 23:59:59 WIB), debug jam UTC/WIB, & ekspor CSV CWE-1236 |
| `/api/sn-patterns` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | Pola regex validasi & ekstraksi `SCAN_SN` |
| `/api/whatsapp` | `GET /config`, `POST /config`, `GET /thresholds`, `POST /thresholds`, `POST /evaluate`, `POST /send`, `POST /test`, `GET /logs` | Konfigurasi alert Fonnte, ambang berjenjang 15 menit, & log pengiriman |
| `/api/tickets` | `POST /consume`, `GET /keys`, `POST /keys`, `DELETE /keys/:id` | Integrasi tiket eksternal via Bearer API key |
| `/api/checklists` | `GET /`, `POST /` | Checklist tas lapangan teknisi |
| `/api/backup` | `GET /inventory/download` | Unduh snapshot backup data inventaris bebas akun |

