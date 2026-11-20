# FieldOps IT - Sistem Manajemen Inventaris & Operasional Teknisi Lapangan

![Version](https://img.shields.io/badge/version-v1.2.6-emerald.svg)
![React](https://img.shields.io/badge/React-19.3.0-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5.0.0-000000?logo=express)
![MariaDB](https://img.shields.io/badge/MariaDB-11.4_LTS-003545?logo=mariadb)
![Docker](https://img.shields.io/badge/Docker-24.0+-2496ED?logo=docker)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38BDF8?logo=tailwindcss)

FieldOps IT adalah aplikasi web manajemen inventaris suku cadang, pencatatan mutasi stok barang masuk/keluar, siklus permohonan & pengembalian alat teknisi, paket Multi-Tas kerja lapangan, dan laporan mingguan pergerakan barang. Dikembangkan secara mandiri (*on-premises single-office*) berbasis **React 19**, **Express 5**, **MariaDB 11.x**, dan **Docker Container** tanpa ketergantungan pada layanan cloud pihak ketiga.

---

## 🌟 Fitur Utama (v1.2.6)

- **Satu Model Data Kanonik Terpadu (`jenis → produk → tipe → item / stok_jumlah`)**:
  - Seluruh menu (Dashboard, Katalog, Input Barang Masuk, Output Barang Keluar, Request Teknisi, Riwayat Transaksi, & Laporan Mingguan) membaca satu sumber data kanonik tanpa pemisahan v1/v2 dan otomatis sinkron tanpa muat ulang manual.
- **Katalog Terkelola & Hapus Terproteksi (`Kategori`, `Atribut`, `Produk`, `Storage Box`)**:
  - Mendukung ubah Kategori dan Atribut di subtab Kelola (termasuk pengelolaan opsi dropdown aman) serta penghapusan terproteksi dengan konfirmasi Tingkat 3 ke Kotak Sampah 14 hari—otomatis menolak hapus jika masih terdapat produk aktif, varian aktif, stok aktif/dipesan, atau request terbuka.
- **Alur Input `SCAN_SN` Ketat & Output Keranjang Keluar**:
  - Ekstraksi token regex SN ketat pada mode `SCAN_SN` tanpa pernah fallback ke MAC/D-SN, dilengkapi kolom interaktif **Uji Regex** dan manajemen pola di `/api/sn-patterns`.
  - Output Barang Keluar mendukung pencarian 300ms (SN/produk/tipe/box), scanner bersama, proteksi item `Rusak` dan item `dipesan`, **Keranjang Keluar** multi-item, serta pembatasan stok `TANPA_ID`.
- **Akuntabilitas `actor_id` vs `recorded_by_id` & Ledger Audit Append-Only**:
  - Memisahkan pelaku lapangan (`actor_id`) dan pencatat (`recorded_by_id`) dengan alasan wajib (`on_behalf_reason`), validasi `occurred_at` berbasis peran (maks. 7 hari ke belakang untuk `warehouse_admin`, bebas untuk `admin`/`developer`), serta fitur **Catat Koreksi Audit** (`correction_of_id`) tanpa mengubah log transaksi final.
- **Siklus Request Teknisi, Multi-Tas Kerja Lapangan, & Status `Selesai`**:
  - Alur lengkap `diajukan → disetujui (reservasi 'dipesan') → diambil ('keluar') → dikembalikan (wajib untuk Alat) | selesai (Terpakai Pelanggan untuk Barang Habis Pakai)` beserta daftar *"Barang di Tangan Teknisi"* dan tautan cepat **Hubungkan ke Request**.
  - Mendukung pengajuan **Kembalikan** dari barang yang dibawa dengan 3 opsi kondisi terpetakan (**Belum Terpakai** → `Baru`, **Normal** → `Baik`, **Rusak** → `Rusak`) serta verifikasi penerimaan gudang.
  - Mendukung pembuatan beberapa **Tas Kerja Kantor** (`BAG_TEMPLATE` di menu Inspeksi Tas Kerja) yang terhubung ke Katalog, serta pilihan **Ambil Satuan** atau **Pilih Paket Tas** pada form request teknisi.
- **Standar Zona Waktu UTC (Penyimpanan) ↔ WIB / `Asia/Jakarta` (Tampilan & Laporan)**:
  - Seluruh timestamp disimpan UTC di MariaDB, ditampilkan `DD/MM/YYYY HH:mm WIB`, direkap tepat Senin 00:00 WIB – Minggu 23:59:59.999 WIB, dan diekspor ke `.xlsx` (ExcelJS) dengan serial tanggal wall-clock WIB serta sanitasi **CWE-1236**.
- **Kotak Sampah 14 Hari, WhatsApp Gateway (Fonnte), Cetak Label A4, & REST API Tiket**:
  - Retensi tempat sampah 14 hari dengan pemulihan CLI `npm run sampah`, autentikasi HTTP-only cookie + PBKDF2 100k iterasi, backup JSON bebas akun (*Zero Account Leakage*), alert WhatsApp otomatis berjenjang 15 menit (Fonnte), cetak label QR A4 presisi (`190 × 89 mm`), dan endpoint `/api/tickets/consume`.
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
- 📐 [**Arsitektur Sistem (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md) — Diagram arsitektur v1.2.6, layanan kanonik, zona waktu UTC/WIB, dan akses Cloudflare Tunnel.
- 🚀 [**Panduan Deployment & API (`docs/DEPLOY.md`)**](./docs/DEPLOY.md) — Langkah deployment Docker/Native (Linux/Windows), backup, troubleshooting, dan referensi endpoint API aktif.
- 🗄️ [**Struktur & Kamus Data (`docs/DATA.md`)**](./docs/DATA.md) — Skema tabel MariaDB hingga migrasi `12_unify_single_model_and_wib.sql`, relasi data, dan aturan mutasi stok.
- 🔐 [**Peran & Hak Akses (`docs/PERAN_DAN_AKSES.md`)**](./docs/PERAN_DAN_AKSES.md) — Matriks RBAC 4 peran kanonis (`developer`, `admin`, `warehouse_admin`, `technician`), sesi cookie 30 hari, akses tab Setting, dan konfirmasi bertingkat.
- 🎨 [**Sistem Tema & Desain (`docs/TEMA_DAN_DESAIN.md`)**](./docs/TEMA_DAN_DESAIN.md) — Token warna light/dark, disiplin *zero-pill*, responsivitas mobile, dan isolasi cetak A4.
- ✅ [**Status Sistem (`docs/STATUS.md`)**](./docs/STATUS.md) — Status rilis terkini, audit keamanan, dan hasil pengujian otomatis.
- 📊 [**Matriks Progres (`docs/PROGRESS.md`)**](./docs/PROGRESS.md) — Pelacak status penyelesaian modul dari Tahap 0 hingga rilis `v1.2.6`.
- 📜 [**Riwayat Versi (`CHANGELOG.md`)**](./CHANGELOG.md) — Catatan rilis lengkap proyek dari `v0.1.0` hingga `v1.2.6` (tersinkron dengan [`docs/CHANGELOG.md`](./docs/CHANGELOG.md)).
- 🛠️ [**Aturan Developer (`AGENTS.md`)**](./AGENTS.md) — Invarian keamanan mutlak dan panduan pengkodian.

---

## 📄 Lisensi

Hak Cipta © 2026 FieldOps IT Team. Dilindungi oleh Undang-Undang.
