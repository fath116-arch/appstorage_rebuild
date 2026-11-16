# FieldOps IT - Sistem Manajemen Inventaris & Operasional Teknisi Lapangan

![Version](https://img.shields.io/badge/version-v1.2.6-emerald.svg)
![React](https://img.shields.io/badge/React-19.3.0-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5.0.0-000000?logo=express)
![MariaDB](https://img.shields.io/badge/MariaDB-11.4_LTS-003545?logo=mariadb)
![Docker](https://img.shields.io/badge/Docker-24.0+-2496ED?logo=docker)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3.3-38BDF8?logo=tailwindcss)

FieldOps IT adalah aplikasi web manajemen inventaris suku cadang, pencatatan mutasi stok barang masuk/keluar, siklus permohonan & pengembalian alat teknisi, verifikasi checklist tas lapangan, dan laporan mingguan pergerakan barang. Dikembangkan secara mandiri (*on-premises single-office*) berbasis **React 19**, **Express 5**, **MariaDB 11.x**, dan **Docker Container** tanpa ketergantungan pada layanan cloud pihak ketiga.

---

## 🌟 Fitur Utama (v1.2.6)

- **Satu Model Data Kanonik Terpadu (`jenis > produk > tipe > item / stok_jumlah`)**:
  - Seluruh menu (Dashboard, Katalog, Input Barang Masuk, Output Barang Keluar, Request Teknisi, Riwayat Transaksi, & Laporan Mingguan) membaca satu sumber data kanonik tanpa pemisahan v1/v2 dan otomatis sinkron tanpa muat ulang manual.
- **Alur Input `SCAN_SN` Ketat & Output Keranjang Keluar**:
  - Ekstraksi token regex SN ketat pada mode `SCAN_SN` tanpa pernah fallback ke MAC/D-SN, dilengkapi kolom interaktif **Uji Regex**.
  - Output Barang Keluar mendukung pencarian 300ms (SN/produk/tipe/box), scanner bersama, proteksi item `Rusak` dan item `dipesan`, **Keranjang Keluar** multi-item, serta pembatasan stok `TANPA_ID`.
- **Akuntabilitas `actor_id` vs `recorded_by_id` & Ledger Audit Append-Only**:
  - Memisahkan pelaku lapangan (`actor_id`) dan pencatat (`recorded_by_id`) dengan alasan wajib (`on_behalf_reason`), validasi `occurred_at` berbasis peran, serta fitur **Catat Koreksi Audit** (`correction_of_id`) tanpa mengubah log transaksi final.
- **Siklus Request Teknisi & *"Barang di Tangan Teknisi"***:
  - Alur lengkap `diajukan → disetujui (reservasi 'dipesan') → diambil ('keluar') → dikembalikan (wajib untuk Alat)` beserta daftar item yang sedang dibawa teknisi dan tautan cepat **Hubungkan ke Request**.
- **Standar Zona Waktu UTC (Penyimpanan) ↔ WIB / `Asia/Jakarta` (Tampilan & Laporan)**:
  - Seluruh timestamp disimpan UTC di MariaDB, ditampilkan `DD/MM/YYYY HH:mm WIB`, direkap tepat Senin 00:00 WIB – Minggu 23:59:59.999 WIB, dan diekspor ke `.xlsx` (ExcelJS) dengan serial tanggal wall-clock WIB serta sanitasi **CWE-1236**.
- **Kotak Sampah 14 Hari, WhatsApp Gateway (Fonnte), & REST API Tiket**:
  - Retensi tempat sampah 14 hari dengan pemulihan CLI `npm run sampah`, autentikasi HTTP-only cookie + PBKDF2 100k iterasi, backup JSON bebas akun (*Zero Account Leakage*), alert WhatsApp otomatis (Fonnte), dan endpoint `/api/tickets/consume`.
- **Siap Deployment Docker & Cloudflare Tunnel**:
  - Dilengkapi `Dockerfile` multi-stage, `docker-compose.yml`, dan panduan Cloudflare Tunnel untuk akses jarak jauh HTTPS aman.

---

## 🏗️ Teknologi Utama

| Komponen | Teknologi | Versi | Catatan / Fungsi |
| :--- | :--- | :--- | :--- |
| **Database Engine** | MariaDB | `11.4 LTS` | Relational DB Server On-Premises (Penyimpanan Terisolasi) |
| **Frontend Framework** | React | `19.3.0` | Modern Component-Based SPA |
| **Backend Framework** | Express | `5.0.0` | Node.js REST API Server Engine |
| **Containerization** | Docker & Compose | `v24.0+` | Multi-Stage Production Build |
| **Build Tool & Bundler** | Vite | `8.3.0` | High-Performance ESM Frontend Bundler |
| **Bahasa Pemrograman** | TypeScript | `7.0.2` | Strict Type-Checking & High Safety |
| **Styling & UI** | Tailwind CSS | `4.3.3` | Zero-Runtime CSS Engine & Dark Mode |

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
2. **Buat Akun Master Admin / Dev Superadmin Pertama**:
   ```bash
   docker compose exec backend npm run setup:admin
   ```

---

## 📚 Dokumentasi Lengkap

Seluruh dokumen teknis dan operasional sistem tersedia di direktori [`docs/`](./docs/):

- 📐 [**Arsitektur Sistem (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md) — Diagram arsitektur terpisah, alur REST API, dan jaringan Docker.
- 🚀 [**Panduan Deployment (`docs/DEPLOY.md`)**](./docs/DEPLOY.md) — Langkah deployment Docker (Linux/Windows), setup Cloudflare Tunnel, backup, dan troubleshooting.
- 🗄️ [**Struktur & Kamus Data (`docs/DATA.md`)**](./docs/DATA.md) — Skema tabel MariaDB, relasi data, dan aturan mutasi stok.
- 🔐 [**Peran & Hak Akses (`docs/PERAN_DAN_AKSES.md`)**](./docs/PERAN_DAN_AKSES.md) — Matriks RBAC server-side untuk Superadmin, Supervisor, Admin, dan Teknisi.
- 📊 [**Matriks Progres Rebuild (`docs/PROGRESS.md`)**](./docs/PROGRESS.md) — Pelacak status penyelesaian fitur Tahap 0 hingga Tahap 5.
- 📜 [**Riwayat Versi (`CHANGELOG.md`)**](./CHANGELOG.md) — Catatan rilis proyek dari awal hingga versi `v1.0.0-rebuild`.
- 🛠️ [**Aturan Developer (`AGENTS.md`)**](./AGENTS.md) — Invarian keamanan mutlak dan panduan pengkodian.

---

## 📄 Lisensi

Hak Cipta © 2026 FieldOps IT Team. Dilindungi oleh Undang-Undang.
