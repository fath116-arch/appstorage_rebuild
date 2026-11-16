# STATUS.md — FieldOps IT Inventory (v1.2.6)

Perbarui di akhir setiap tahap. Agent membaca file ini bersama `AGENTS.md` sebelum bekerja.

## Tahap & Rilis
- [x] Tahap 0 s/d Tahap 8 (Rilis v1.2.0 Complete)
- [x] Paket 1 s/d Paket 7 (Rilis v1.2.5 / v1.2.5.3 Complete)
- [x] **v1.2.6 — Unifikasi Model Data Tunggal, Output Keranjang, Request Teknisi, Akuntabilitas Audit, & UTC/WIB** — Terverifikasi:
  - `canonicalSystem.test.ts`: 19/19 PASS
  - `tahap6Requests.test.ts`: 17/17 PASS
  - `scanSnExtraction.test.ts`: 6/6 PASS
  - `tahap2Catalog.test.ts`: 13/13 PASS | `tahap3Stock.test.ts`: 17/17 PASS | `tahap4CatalogView.test.ts`: 14/14 PASS | `tahap5ArchiveRestore.test.ts`: 15/15 PASS
  - `v125Paket3Tools.test.ts`: 24/24 PASS | `testReportsAndChecklists.ts`: PASS
  - `tsc --noEmit` & `npm run build`: 0 Galat

## Sedang dikerjakan
- Rilis **v1.2.6** selesai dan terverifikasi penuh. Seluruh jalur data legacy v1 telah dihapus sehingga seluruh aplikasi beroperasi di atas satu model kanonik tunggal.

## Keputusan penting
- **Satu Model Data Kanonik Tunggal**: Pemisahan v1/v2 dihilangkan sepenuhnya; Katalog, Input, Output, Request, Riwayat Transaksi, Dashboard, dan Laporan membaca sumber tunggal (`jenis → produk → tipe → item / stok_jumlah → transaksi / transaksi_detail → request`), dengan `InventoryContext.refreshData()` otomatis pasca-mutasi.
- **Definisi Hak Akses RBAC** dipusatkan di `backend/src/utils/permissions.ts` dan `frontend/src/utils/permissions.ts`.
- **Akuntabilitas `actor_id` vs `recorded_by_id` & Ledger Koreksi**: Transaksi atas nama pengguna lain wajib mencatat `on_behalf_reason` (khusus pengelola/admin/developer), `occurred_at` dibatasi 7 hari ke belakang untuk `warehouse_admin` (bebas untuk `admin`/`developer`, dilarang masa depan), dan koreksi audit dicatat append-only (`POST /api/activities/:id/correct`, `correction_of_id`).
- **Siklus Request Teknisi**: `diajukan → disetujui (reservasi 'dipesan' / reserved_qty) → diambil ('keluar', taken_at) → dikembalikan ('aktif' + kondisi, wajib untuk Alat)` atau `ditolak` / `dibatalkan` (melepas reservasi).
- **Zona Waktu UTC ↔ WIB**: Backend mengunci `process.env.TZ = 'UTC'` dan menyimpan UTC di MariaDB; seluruh tampilan dan rentang mingguan (Senin 00:00 WIB – Minggu 23:59:59.999 WIB) serta ekspor ExcelJS memakai `Asia/Jakarta` (WIB) + sanitasi CWE-1236.
- **Ekstraksi `SCAN_SN` Ketat**: Token hasil scan foto/kamera diuji per token terhadap regex ketat tipe (`^...$`) tanpa fallback ke MAC/D-SN/teks mentah.

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
