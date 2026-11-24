# FieldOps IT - Sistem Manajemen Inventaris & Operasional Teknisi Lapangan

![Version](https://img.shields.io/badge/version-v1.2.8-emerald.svg)
![React](https://img.shields.io/badge/React-19.3.0-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5.0.0-000000?logo=express)
![MariaDB](https://img.shields.io/badge/MariaDB-11.4_LTS-003545?logo=mariadb)
![Docker](https://img.shields.io/badge/Docker-24.0+-2496ED?logo=docker)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38BDF8?logo=tailwindcss)

FieldOps IT adalah aplikasi web manajemen inventaris data barang, pencatatan mutasi stok masuk/keluar, siklus permohonan & pengembalian alat teknisi, paket Multi-Tas kerja lapangan, dan laporan mingguan pergerakan barang. Dikembangkan secara mandiri (*on-premises single-office*) berbasis **React 19**, **Express 5**, **MariaDB 11.x**, dan **Docker Container** tanpa ketergantungan pada layanan cloud pihak ketiga.

---

## 🌟 Fitur Utama (v1.2.8)

- **Satu Model Data Kanonik Terpadu (`jenis → produk → tipe → item / stok_jumlah`) & Auto-Refresh Senyap 5 Menit**:
  - Seluruh menu (Dashboard, Katalog Data Barang, Input Barang Masuk, Output Barang Keluar, Request Teknisi, Riwayat Transaksi, & Laporan Mingguan) membaca satu sumber data kanonik, otomatis sinkron pasca-mutasi, serta menyegarkan data secara senyap setiap **5 menit** di latar belakang (`InventoryContext`).
- **Katalog Terkelola, Hapus Massal + Konfirmasi `"delete"`, & Impor Excel / Google Spreadsheet**:
  - Mendukung ubah Kategori dan Atribut di subtab Kelola serta penghapusan tunggal maupun **hapus massal multi-pilih** pada **Produk, Kategori, Atribut, Storage Box, dan Item Fisik Ber-ID** dengan konfirmasi ringkas ketik **`delete`** ke Kotak Sampah 14 hari (dilengkapi proteksi stok/request terbuka).
  - **Impor Data Katalog, Box, & Stok Awal**: Unduh Template `.xlsx` resmi, unggah file `.xlsx`/`.csv` atau tempel link **Google Spreadsheet publik**, tinjau pratinjau validasi, dan impor atomik ke katalog.
- **Layar Login Khusus Masuk (Registrasi Publik Ditutup), 3 Peran Kanonis (`developer`, `admin`, `technician`), & Izin Fitur Slider ON/OFF**:
  - Halaman login hanya melayani **Login** dan **Lupa Kata Sandi** (`POST /api/auth/register` ditutup `403`); pembuatan akun dilakukan oleh `Admin`/`Developer` dari dalam aplikasi atau CLI server `npm run setup:admin`.
  - Peran `admin` & `warehouse_admin` dilebur menjadi satu peran **`admin`** (dengan pengelolaan akun terbatas `admin` & `technician`).
  - Khusus **`developer`** dapat mengatur akses 21 fitur per akun non-developer menggunakan saklar slider ON/OFF murni (`PUT /api/auth/users/:id/features`).
- **Alur Input `SCAN_SN` Ketat, Output Keranjang Keluar, & Akuntabilitas `actor_id` vs `recorded_by_id`**:
  - Ekstraksi token regex SN ketat pada mode `SCAN_SN` dengan Uji Regex, pencarian 300ms, **Keranjang Keluar** multi-item, pemisahan pelaku (`actor_id`) vs pencatat (`recorded_by_id`), serta koreksi audit append-only (`correction_of_id`).
- **Siklus Request Teknisi (`Ambil`, `Kembalikan`, `Ajukan Pembelian`), Multi-Tas Kerja Lapangan, & Status `Selesai`**:
  - Alur lengkap `diajukan → disetujui → diambil → dikembalikan | selesai` termasuk pengajuan **Pembelian Barang** (`beli`, katalog maupun barang baru non-katalog) dan paket **Multi-Tas** (`BAG_TEMPLATE`).
- **Standar Zona Waktu UTC ↔ WIB (`Asia/Jakarta`) & Lembar Pengesahan Dinamis**:
  - Penyimpanan UTC di MariaDB, tampilan WIB, laporan Senin–Minggu WIB, ekspor `.xlsx` ExcelJS tersanitasi **CWE-1236**, serta kustomisasi permanen Kop Surat & 3 penandatangan (`REPORT_APPROVAL_CONFIG`).
- **Dual WhatsApp Gateway ON/OFF (Khusus Developer), 4 Slot Penerima ON/OFF, Cetak Label A4, & REST API Tiket**:
  - Konfigurasi **Dual WhatsApp Gateway (`gateway1` & `gateway2`)** dengan slider ON/OFF dikhususkan untuk **`developer`**, sementara `admin` mengelola 4 slot penerima bersaklar ON/OFF & ambang stok (notifikasi selektif pada `beli` & stok kritis).
  - Dilengkapi retensi Kotak Sampah 14 hari (`npm run sampah`), tes login (`npm run setup:test-login`), cookie HTTP-only + PBKDF2 100k, cetak label QR A4 presisi (`190 × 89 mm`), dan `/api/tickets/consume`.
- **Siap Deployment Docker & Cloudflare Tunnel**:
  - Dilengkapi `Dockerfile` multi-stage, `docker-compose.yml`, dan panduan Cloudflare Tunnel untuk akses jarak jauh HTTPS aman.

---

## 🏗️ Teknologi Utama

| Komponen | Teknologi | Versi | Catatan / Fungsi |
| :--- | :--- | :--- | :--- |
| **Database Engine** | MariaDB | `11.4 LTS` | Relational DB Server On-Premises (Penyimpanan Terisolasi, UTC) |
| **Frontend Framework** | React | `19.3.0` | Modern Component-Based SPA |
| **Backend Framework** | Express | `5.0.0` | Node.js REST API Server Engine |
| **Containerization** | Docker & Compose | `v24.0+` | Multi-Stage Production Build |
| **Build Tool & Bundler** | Vite | `8.3.0` | High-Performance ESM Frontend Bundler |
| **Bahasa Pemrograman** | TypeScript | `7.0.2` | Strict Type-Checking & High Safety |
| **Styling & UI** | Tailwind CSS | `4.3.3` | Design Token CSS & Dark Mode |

---

## 🚀 Panduan Memulai (Quick Start)

### Mode Pengembangan (Development Mode)

1. **Salin Environment Variables**:
   ```bash
   cp .env.example .env
   ```
2. **Jalankan Aplikasi Mode Dev**:
   ```bash
   npm install
   npm run dev
   ```
   Aplikasi dapat diakses di `http://localhost:3000`.

### Mode Produksi dengan Docker (Recommended)

1. **Jalankan Container Docker**:
   ```bash
   docker compose up -d --build
   ```
2. **Buat Akun Master Admin / Developer & Cek Koneksi Sistem**:
   ```bash
   docker compose exec backend npm run setup:admin
   docker compose exec backend npm run setup:check
   ```
   *(Ketik `npm run setup:help` untuk melihat seluruh command setup interaktif: `setup:db`, `setup:admin`, `setup:tunnel`, `setup:wa`, `setup:check`, dan seluruhnya juga dapat diatur via tab **Setting** di web oleh `admin`/`developer`.)*

---

## 📚 Dokumentasi Lengkap

Seluruh dokumen teknis dan operasional sistem tersedia di root proyek dan direktori [`docs/`](./docs/):

- 📖 [**Dokumentasi Teknis Lengkap (`DOCUMENTATION.md`)**](./DOCUMENTATION.md) — Panduan setup `.env`, arsitektur modul frontend/backend, panduan API, dan pemeliharaan sistem.
- 🧰 [**Panduan Skrip CLI & Setup Sistem (`docs/SKRIP_CLI.md`)**](./docs/SKRIP_CLI.md) — Daftar lengkap & penjelasan fungsi seluruh skrip NPM (`setup:db`, `setup:admin`, `setup:tunnel`, `setup:wa`, `setup:check`, `setup:help`, `sampah`, `test:backup`, `dev`, `build`, `lint`).
- 📐 [**Arsitektur Sistem (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md) — Diagram arsitektur v1.2.8, layanan kanonik, zona waktu UTC/WIB, dan akses Cloudflare Tunnel.
- 🚀 [**Panduan Deployment & API (`docs/DEPLOY.md`)**](./docs/DEPLOY.md) — Langkah deployment Docker/Native (Linux/Windows), backup, troubleshooting, dan referensi endpoint API aktif.
- 🗄️ [**Struktur & Kamus Data (`docs/DATA.md`)**](./docs/DATA.md) — Skema tabel MariaDB hingga migrasi `14_v128_rbac_wa2_and_features.sql`, relasi data, dan aturan mutasi stok.
- 🔐 [**Peran & Hak Akses (`docs/PERAN_DAN_AKSES.md`)**](./docs/PERAN_DAN_AKSES.md) — Matriks RBAC 3 peran kanonis (`developer`, `admin`, `technician`), izin fitur slider ON/OFF per akun, sesi cookie 30 hari, & konfirmasi `"delete"`.
- 🎨 [**Sistem Tema & Desain (`docs/TEMA_DAN_DESAIN.md`)**](./docs/TEMA_DAN_DESAIN.md) — Token warna light/dark, disiplin *zero-pill*, responsivitas mobile, dan isolasi cetak A4.
- ✅ [**Status Sistem (`docs/STATUS.md`)**](./docs/STATUS.md) — Status rilis terkini, audit keamanan, dan hasil pengujian otomatis.
- 📊 [**Matriks Progres (`docs/PROGRESS.md`)**](./docs/PROGRESS.md) — Pelacak status penyelesaian modul dari Tahap 0 hingga rilis `v1.2.8`.
- 📜 [**Riwayat Versi (`CHANGELOG.md`)**](./CHANGELOG.md) — Catatan rilis lengkap proyek dari `v0.1.0` hingga `v1.2.8` (tersinkron dengan [`docs/CHANGELOG.md`](./docs/CHANGELOG.md)).
- 🛠️ [**Aturan Developer (`AGENTS.md`)**](./AGENTS.md) — Invarian keamanan mutlak dan panduan pengkodian.

---

## 📄 Lisensi

Hak Cipta © 2026 FieldOps IT Team. Dilindungi oleh Undang-Undang.
