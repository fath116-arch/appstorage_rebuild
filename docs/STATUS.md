# STATUS.md — FieldOps IT Inventory (v1.2.6)

Perbarui di akhir setiap fitur atau rilis. Agent membaca file ini bersama `AGENTS.md` sebelum bekerja.

## Tahap & Rilis
- [x] Tahap 0 s/d Tahap 8 (Rilis v1.2.0 Complete)
- [x] Paket 1 s/d Paket 7 (Rilis v1.2.5 / v1.2.5.3 Complete)
- [x] **v1.2.6 — Unifikasi Model Data Tunggal, Output Keranjang, Request & Multi-Tas, Kontrol Katalog, & UTC/WIB** — Terverifikasi:
  - `canonicalSystem.test.ts`: 19/19 PASS
  - `catalogDeleteEditAndReturnRequest.test.ts`: 25/25 PASS (Hapus terproteksi & Ubah Kategori/Atribut/Produk/Box + Request `kembalikan`)
  - `bagAndCompleteRequest.test.ts`: 20/20 PASS (Multi-Tas Kerja Kantor + Request Paket Tas + Status `selesai` Terpakai Pelanggan)
  - `tahap6Requests.test.ts`: 17/17 PASS
  - `scanSnExtraction.test.ts`: 6/6 PASS
  - `tahap2Catalog.test.ts`: 13/13 PASS | `tahap3Stock.test.ts`: 17/17 PASS | `tahap4CatalogView.test.ts`: 14/14 PASS | `tahap5ArchiveRestore.test.ts`: 15/15 PASS
  - `v125Paket3Tools.test.ts`: 24/24 PASS | `testReportsAndChecklists.ts`: PASS
  - `npm run lint` (`tsc --noEmit`) & `npm run build`: 0 Galat

## Sedang dikerjakan
- Rilis **v1.2.6** selesai dan terverifikasi penuh. Seluruh jalur data legacy v1 telah dihapus sehingga seluruh aplikasi beroperasi di atas satu model kanonik tunggal beserta dokumentasi yang telah disinkronkan.

## Keputusan penting
- **Satu Model Data Kanonik Tunggal**: Pemisahan v1/v2 dihilangkan sepenuhnya; Katalog, Input, Output, Request, Riwayat Transaksi, Dashboard, dan Laporan membaca sumber tunggal (`jenis → produk → tipe → item / stok_jumlah → transaksi / transaksi_detail → request`), dengan `InventoryContext.refreshData()` otomatis pasca-mutasi.
- **Kontrol Ubah & Hapus Terproteksi Katalog**: Kategori (`jenis`), Atribut, Produk, dan Storage Box mendukung modifikasi aman dan penghapusan berjenjang ke Kotak Sampah 14 hari dengan penolakan otomatis bila masih memiliki produk aktif, varian aktif, stok aktif/dipesan, atau request terbuka.
- **Definisi Hak Akses RBAC** dipusatkan di `backend/src/utils/permissions.ts` dan `frontend/src/utils/permissions.ts` untuk 4 peran kanonis (`developer`, `admin`, `warehouse_admin`, `technician`).
- **Akuntabilitas `actor_id` vs `recorded_by_id` & Ledger Koreksi**: Transaksi atas nama pengguna lain wajib mencatat `on_behalf_reason` (khusus pengelola/admin/developer), `occurred_at` dibatasi 7 hari ke belakang untuk `warehouse_admin` (bebas untuk `admin`/`developer`, dilarang masa depan), dan koreksi audit dicatat append-only (`POST /api/activities/:id/correct`, `correction_of_id`).
- **Siklus Request Teknisi, Multi-Tas, & Status `Selesai`**: Alur penuh `diajukan → disetujui (reservasi 'dipesan' / reserved_qty) → diambil ('keluar', taken_at) → dikembalikan (pengajuan 'kembalikan' 3 kondisi terpetakan + verifikasi gudang, wajib untuk Alat) | selesai ('Terpakai Pelanggan' khusus Barang Habis Pakai dengan Nama/ID Pelanggan & Catatan Pemasangan)` atau `ditolak` / `dibatalkan`. Mendukung pembuatan banyak template Tas Kerja Kantor (`BAG_TEMPLATE`) dan pengajuan **Pilih Paket Tas** (`POST /api/requests/bag`).
- **Zona Waktu UTC ↔ WIB**: Backend mengunci `process.env.TZ = 'UTC'` dan menyimpan UTC di MariaDB; seluruh tampilan dan rentang mingguan (Senin 00:00 WIB – Minggu 23:59:59.999 WIB) serta ekspor ExcelJS memakai `Asia/Jakarta` (WIB) + sanitasi CWE-1236.
- **Ekstraksi `SCAN_SN` Ketat**: Token hasil scan foto/kamera diuji per token terhadap regex ketat tipe (`^...$`) tanpa fallback ke MAC/D-SN/teks mentah.

## Hasil audit keamanan (disetujui)
| Aturan | Menurut panduan | Kondisi kode | Status | Saran / keputusan |
|---|---|---|---|---|
| **Masa Berlaku Sesi & Timeout (Migrasi 10)** | `ACCESS_TOKEN_TTL_DETIK=2592000` (30H), `IDLE_TIMEOUT_MENIT=43200` (30H), `ABSOLUTE_TIMEOUT_JAM=720` (30H), `MAX_SESI_PER_AKUN=50`, `REAUTH_MENIT=15` | `10_v2_unify_stock_and_sessions.sql` mengisi tabel `pengaturan` dan `SettingService` membacanya dinamis | **Sesuai** | Pertahankan. Dibaca dinamis dari tabel `pengaturan` |
| **Penyimpanan Sesi Server** | Disimpan di server (tabel `sesi`), bukan JWT murni / `localStorage` | Terimplementasi di tabel `sesi` via `SessionService` | **Sesuai** | Pertahankan |
| **Penyimpanan Token Cookie** | Token via cookie `HttpOnly`, `Secure` (prod), `SameSite=Lax` | `authMiddleware.ts` membaca cookie `fieldops_access`, `fieldops_session`, `fieldops_device` | **Sesuai** | Pertahankan |
| **Rotasi Refresh Token & Anti-Replay** | Rotasi tiap pakai, reuse token lama mencabut seluruh sesi akun | `SessionService.rotateRefreshToken` merotasi `refresh_hash`, detect reuse & cabut sesi + log `deteksi_token_reuse` | **Sesuai** | Pertahankan |
| **Device ID & Session Fixation** | ID Sesi acak baru & Device ID cookie | `SessionService.createSession` membuat `sessionId` & `deviceId` acak, verifikasi `device_id_hash` | **Sesuai** | Pertahankan |
| **Password Hashing & Hashing Token** | PBKDF2 (100k SHA-256), token hash SHA-256 | `security.ts` & `authService.ts` memakai PBKDF2 100.000 iterasi dengan 16-byte random salt | **Sesuai** | Pertahankan |
| **Konfirmasi Aksi Bertingkat** | Tier 0 (tanpa dialog), Tier 1 (dialog), Tier 2 (`approve`), Tier 3 (nama objek + reauth password) | `ConfirmationService` memuat `CONFIRMATION_TIERS`, validasi `approve` & nama objek + reauth password (>15m) | **Sesuai** | Pertahankan |
| **Penegakan Server (Single-Use Token)** | Token konfirmasi TTL 120s sekali pakai di server | `ConfirmationService` menerbitkan token TTL 120s, `requireConfirmation` konsumsi atomik (`used_at = NOW()`) | **Sesuai** | Pertahankan |
| **Persetujuan Request Teknisi** | 1 orang dari 3 role pengelola cukup, `UPDATE ... WHERE status IN ('menunggu','diajukan')` | Atomic update + reservasi stok `'dipesan'` / `reserved_qty` | **Sesuai** | Pertahankan |
| **Hapus Permanen (Retention 14 Hari)** | Soft delete terproteksi stok aktif → `sampah_hapus` JSON 14 hari | `CatalogService`, `StockService`, & `TrashService.moveToTrash` memindahkan ke `sampah_hapus` | **Sesuai** | Pertahankan |
| **Pembersihan Otomatis (Cron Purge)** | Job mengosongkan snapshot lewat 14 hari & ubah status ke `dibersihkan` | `TrashService.purgeExpiredTrash` kosongkan `snapshot`, status `dibersihkan` & log `dibersihkan_otomatis` | **Sesuai** | Pertahankan |
| **Pemulihan Terminal CLI** | CLI `npm run sampah` (`--list`, `--dry-run`, `--pulihkan`), validasi konflik | `TrashService.restoreTrash` & CLI `sampahCli.ts` validasi konflik & log `pelaku_id: 'terminal'` | **Sesuai** | Pertahankan |
| **Log Aktivitas Append-Only** | Append-only, ID harian (`AKT-YYYYMMDD-NNNN`), koreksi via `correction_of_id` | `ActivityLogService` mencatat log & koreksi append-only tanpa endpoint hapus | **Sesuai** | Pertahankan |

## Masalah terbuka
- Tidak ada. Seluruh rangkaian pengujian otomatis (`v1.2.0` s/d `v1.2.6`), `npm run lint`, dan `npm run build` lulus 100%.

## Catatan kontributor
- Seluruh rangkaian fitur dan dokumentasi hingga Versi **v1.2.6** telah disinkronkan di root (`README.md`, `DOCUMENTATION.md`, `CHANGELOG.md`) dan `docs/` (`ARCHITECTURE.md`, `DATA.md`, `DEPLOY.md`, `PERAN_DAN_AKSES.md`, `PROGRESS.md`, `STATUS.md`, `CHANGELOG.md`, `TEMA_DAN_DESAIN.md`).
- Dokumen historis di `docs/v1.2.0/`, `docs/LEGACY_AUDIT.md`, dan `AUDIT_REPORT.md` dipertahankan sebagai arsip perjalanan rilis terdahulu.
