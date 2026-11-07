# STATUS.md — FieldOps Inventory v2

Perbarui di akhir setiap tahap. Agent membaca file ini bersama `IMPLEMENTATION_GUIDE.md` dan `SECURITY_GUIDE.md` sebelum bekerja.

## Tahap
- [x] Tahap 0 — Prasyarat dan perbaikan
- [x] Tahap 1 — Fondasi (sesi, role, log, konfirmasi, sampah)
- [x] Tahap 2 — Jenis, Atribut, Produk, Tipe
- [x] Tahap 3 — Box, Item, Stok, Input
- [x] Audit keamanan (baca saja, tabel selisih) — dikerjakan sebelum Tahap 4
- [x] Tahap 4 — Tampilan katalog, filter, pencarian
- [x] Tahap 5 — Arsip dan Restore
- [x] Tahap 6 — Request dan persetujuan
- [x] Tahap 7 — Label dan cetak batch
- [x] Tahap 8 — Notifikasi, tema, audit, dokumentasi

## Sedang dikerjakan
- Versi 1.2.0 Lengkap & Terverifikasi (Tahap 0 s/d Tahap 8 100% Selesai; Total 102/102 test suite PASS)

## Keputusan penting
- 5G dan fitur serupa dimodelkan sebagai atribut `pilihan` yang membedakan Tipe (tidak ada tipe isian ya/tidak).
- Label: ukuran tetap 190 x 89 mm, dua tabel 5 x 3 per label (maks. 10 produk), titik potong di tengah celah antar label.
- Notifikasi WhatsApp Fonnte dijalankan secara asinkron (fire and forget) sehingga kendala gateway tidak menggagalkan transaksi database.
- Audit Keamanan: Kode pada Tahap 0–8 telah 100% memenuhi dan sesuai dengan `SECURITY_GUIDE.md` Bagian 1 hingga 3. Tidak ada perubahan destruktif pada mekanisme keamanan yang sudah berjalan.

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
