# STATUS.md — FieldOps Inventory v2

Perbarui di akhir setiap tahap. Agent membaca file ini bersama `IMPLEMENTATION_GUIDE.md` dan `SECURITY_GUIDE.md` sebelum bekerja.

## Tahap & Paket v1.2.5
- [x] Tahap 0 s/d Tahap 8 (Rilis v1.2.0 Complete - 102/102 Tests PASS)
- [x] Paket 1 — Hak Akses RBAC (Setting API, Katalog, WA Alert) — Terverifikasi 23/23 Tests PASS
- [x] Paket 2 — Perbaikan Bug Transaksi Keluar/Masuk & Ekspor Excel — Terverifikasi 19/19 Tests PASS
- [x] Paket 3 — Konsolidasi Menu Tools Navbar — Terverifikasi 24/24 Tests PASS
- [x] Paket 4 — Katalog, Tipe Stok, Kategori Barang, & Kondisi Item — Terverifikasi 13/13 Tests PASS
- [x] Paket 5 — Input Stok via Kamera & Template Cetak Laporan A4 — Terverifikasi 15/15 Tests PASS
- [x] Paket 6 — WA Alert Otomatis (Fonnte) & Ambang Berjenjang 15m — Terverifikasi 13/13 Tests PASS
- [x] Paket 7 — Branding Logo Baru & Kotak Logo Top Navigation — Terverifikasi 6/6 Tests PASS

## Sedang dikerjakan
- Seluruh 7 Paket v1.2.5 Telah Selesai & Terverifikasi Penuh (Total 113/113 test suite Paket 1 s/d Paket 7 PASS 100%). Versi 1.2.5 siap rilis.

## Keputusan penting
- Definisi Hak Akses RBAC dipusatkan di `backend/src/utils/permissions.ts` agar mudah diaudit.
- Setting API (`/api/tickets/keys`, `/api/auth/settings`, `/api/auth/users`, `/api/auth/trash`) secara ketat dibatasi hanya untuk `developer` dan `admin` (ditolak HTTP 403 untuk `warehouse_admin` dan `technician`).
- Katalog & Storage Box read (termasuk kueri rincian isi box) diizinkan untuk seluruh role (termasuk `technician`).
- Katalog write & mutasi stok diizinkan untuk `developer`, `admin`, dan `warehouse_admin` (ditolak HTTP 403 untuk `technician`).
- Pengaturan WA Alert (`POST /api/whatsapp/config`, `send`, `test`) dibatasi untuk `developer`, `admin`, `warehouse_admin` (ditolak HTTP 403 untuk `technician`), sedangkan riwayat log dapat dibaca semua role.
- Kueri `INSERT INTO transactions` pada `transactionService.ts`, `stockService.ts`, dan `ticketIntegration.ts` diseragamkan menggunakan 12 positional parameter bindings (`?`) agar tidak terjadi pergeseran array indeks pada adapter database in-memory maupun MariaDB.
- Ekspor berkas Excel diperbarui menggunakan `ExcelJS` yang menghasilkan berkas binary `.xlsx` asli (MIME type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) dengan proteksi otomatis CWE-1236 Formula Injection.
- Pemindai kamera barcode/QR diintegrasikan ke `StockInOutModal.tsx` dengan memanfaatkan kembali pola `navigator.mediaDevices.getUserMedia` dan video targeting overlay tanpa membuat komponen scanner baru dari nol.
- Scan kode valid dan tidak valid ditangani secara presisi; pencarian memetakan SKU, Barcode, ID fisik, serta tabel v2 item. Transaksi IN/OUT divalidasi ketat terhadap stok fisik dan status barang.
- Template cetak laporan menggunakan modul `PrintReportModal.tsx` dengan Kop resmi instansi PT. Solusi Informatika Lapangan, tabel terstruktur dengan thead berulang (`table-header-group`), lembar tanda tangan pengesahan, dan isolasi `@media print` murni A4 yang menyembunyikan navbar dan tombol aksi.

## Hasil audit keamanan (disetujui)
| Aturan | Menurut panduan | Kondisi kode | Status | Saran / keputusan |
|---|---|---|---|---|
| **Masa Berlaku Sesi & Timeout** | `ACCESS_TOKEN_TTL_DETIK=900`, `IDLE_TIMEOUT_MENIT=30`, `ABSOLUTE_TIMEOUT_JAM=12`, `MAX_SESI_PER_AKUN=1`, `REAUTH_MENIT=15` | `SettingService` menyimpan konfigurasi default yang sama dan dibaca dinamis | **Sesuai** | Pertahankan. Dibaca dari DB/settings, tidak hardcoded |
| **Penyimpanan Sesi Server** | Disimpan di server (tabel `sesi`), bukan JWT murni | Terimplementasi di tabel `sesi` via `SessionService` | **Sesuai** | Pertahankan |
| **Penyimpanan Token Cookie** | Token via cookie `HttpOnly`, `Secure`, `SameSite` (tanpa localStorage) | `authMiddleware.ts` membaca cookie `fieldops_access`, `fieldops_session`, `fieldops_device` | **Sesuai** | Pertahankan |
| **Rotasi Refresh Token & Anti-Replay** | Rotasi tiap pakai, reuse token lama mencabut seluruh sesi akun | `SessionService.rotateRefreshToken` merotasi `refresh_hash`, detect reuse & cabut sesi + log `deteksi_token_reuse` | **Sesuai** | Pertahankan |
| **Device ID & Session Fixation** | ID Sesi acak baru & Device ID cookie | `SessionService.createSession` membuat `sessionId` & `deviceId` acak, verifikasi `device_id_hash` | **Sesuai** | Pertahankan |
| **Password Hashing & Hashing Token** | PBKDF2 (100k SHA-256), token hash SHA-256 | `security.ts` & `authService.ts` memakai PBKDF2 100.000 iterasi dengan 16-byte random salt | **Sesuai** | Pertahankan |
| **Konfirmasi Aksi Bertingkat** | Tier 0 (batal), Tier 1 (dialog), Tier 2 (`approve`), Tier 3 (nama objek + reauth password) | `ConfirmationService` memuat `CONFIRMATION_TIERS`, validasi `approve` & nama objek + reauth password (>15m) | **Sesuai** | Pertahankan |
| **Penegakan Server (Single-Use Token)** | Token konfirmasi TTL 120s sekali pakai di server | `ConfirmationService` menerbitkan token TTL 120s, `requireConfirmation` konsumsi atomik (`used_at = NOW()`) | **Sesuai** | Pertahankan |
| **Persetujuan Request Teknisi** | 1 orang dari 3 role cukup, `UPDATE ... WHERE status='menunggu'` | Atomic update `UPDATE request SET status='disetujui' WHERE id=? AND status='menunggu'` | **Sesuai** | Pertahankan |
| **Hapus Permanen (Retention 14 Hari)** | Soft delete (arsip) vs Hapus permanen (`sampah_hapus` JSON 14 hari) | `TrashService.moveToTrash` menyimpan snapshot JSON ke `sampah_hapus` dengan retensi 14 hari | **Sesuai** | Pertahankan |
| **Pembersihan Otomatis (Cron Purge)** | Job harian mengosongkan snapshot & ubah status ke `dibersihkan` | `TrashService.purgeExpiredTrash` kosongkan `snapshot`, status `dibersihkan` & log `dibersihkan_otomatis` | **Sesuai** | Pertahankan |
| **Pemulihan Terminal CLI** | CLI `npm run sampah` (`--list`, `--dry-run`, `--pulihkan`), validasi konflik | `TrashService.restoreTrash` & CLI `trashCli.ts` validasi konflik ID/SKU/user & log `pelaku_id: 'terminal'` | **Sesuai** | Pertahankan |
| **Log Aktivitas Append-Only** | Append-only, ID harian (`AKT-YYYYMMDD-NNNN`), tidak pernah dihapus | `ActivityLogService` mencatat log tanpa endpoint HAPUS | **Sesuai** | Pertahankan |

## Masalah terbuka
- Tidak ada. Seluruh 102 automated test (Tahap 1 s/d 8) lulus (100% PASS).

## Catatan kontributor
- Seluruh rangkaian pengembangan Versi 1.2.0 (Tahap 0 s/d Tahap 8) telah tuntas diselesaikan.
- Dokumentasi teknis terpadu tersimpan di `docs/v1.2.0/PANDUAN_SISTEM_V1.2.0.md` dan `CHANGELOG.md`.
- Sistem siap digunakan dan di-deploy ke lingkungan produksi.
