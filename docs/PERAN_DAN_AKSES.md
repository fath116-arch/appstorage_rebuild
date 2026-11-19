# Peran, Hak Akses & Keamanan Sesi - FieldOps IT (v1.2.6)

Dokumen ini mendefinisikan **Role-Based Access Control (RBAC)** server-authoritative, alur autentikasi PBKDF2, manajemen sesi cookie server (`sesi`), serta mekanisme konfirmasi bertingkat (*Tier 0–3*) pada **FieldOps IT (`v1.2.6`)**.

---

## 👥 1. Peran Kanonis & Matriks Hak Akses (RBAC Matrix)

Definisi hak akses dipusatkan di `backend/src/utils/permissions.ts` dan disinkronkan di UI oleh `frontend/src/utils/permissions.ts`. Sistem menggunakan **4 peran kanonis**:

- **`developer`** *(termasuk alias legacy `superadmin`)*: Pemegang kendali teknis penuh, manajemen akun termasuk akun `developer` lain, pengaturan sistem, API key, dan audit database.
- **`admin`**: Administrator operasional dengan akses manajemen penuh kecuali membuat/mereset/menghapus akun berlevel `developer`.
- **`warehouse_admin`**: Pengelola gudang untuk operasional stok, katalog, box, persetujuan/verifikasi request, koreksi audit, dan pengaturan ambang WA (tanpa mengubah kredensial Fonnte maupun setting sistem/API).
- **`technician`**: Teknisi lapangan untuk melihat katalog/stok/log WA (*read-only*), mengajukan permohonan ambil/kembalikan/paket tas, menandai selesai barang habis pakai miliknya, serta mengisi checklist/tas kerja.

| Fitur / Endpoint / Modul | `technician` | `warehouse_admin` | `admin` | `developer` |
| :--- | :---: | :---: | :---: | :---: |
| **Lihat Katalog, Varian, Isi Box, Arsip, & Laporan Mingguan** | ✅ | ✅ | ✅ | ✅ |
| **Lihat Status WA Alert, Ambang, & Log Pengiriman** | ✅ *(Read-Only)* | ✅ | ✅ | ✅ |
| **Cetak Label QR A4, Ekspor Excel (`.xlsx`), & Akses HP** | ✅ | ✅ | ✅ | ✅ |
| **Kelola & Gunakan Tas Kerja / Checklist Inspeksi** (`/api/checklists/*`) | ✅ | ✅ | ✅ | ✅ |
| **Buat Request Ambil Satuan / Paket Tas / Pengembalian** (`POST /api/requests*`) | ✅ *(Diri Sendiri)* | ✅ *(+ Atas Nama)* | ✅ *(+ Atas Nama)* | ✅ *(+ Atas Nama)* |
| **Tandai Selesai Barang Habis Pakai** (`POST /api/requests/:id/complete`) | ✅ *(Milik Sendiri)* | ✅ | ✅ | ✅ |
| **Kelola Katalog & Box (Tambah, Ubah, Hapus Terproteksi)** | ❌ *(403)* | ✅ | ✅ | ✅ |
| **Input Masuk, Output Keranjang Keluar, Restore, & Pindah Box** | ❌ *(403)* | ✅ | ✅ | ✅ |
| **Setujui / Serahkan / Verifikasi Kembali / Tolak Request** | ❌ *(403)* | ✅ | ✅ | ✅ |
| **Catat Koreksi Audit Append-Only** (`POST /api/activities/:id/correct`) | ❌ *(403)* | ✅ | ✅ | ✅ |
| **Batas Tanggal Mundur (`occurred_at` Backdate)** | N/A | **Maks. 7 Hari** | **Tanpa Batas** | **Tanpa Batas** |
| **Ubah Ambang / Kirim WA Alert** (`POST /api/whatsapp/*`) | ❌ *(403)* | ✅ *(Tanpa Token)* | ✅ | ✅ |
| **Ubah Token/URL Fonnte, Aturan ID Tipe, & Pola SN** (`/sn-patterns`) | ❌ *(403)* | ❌ *(403)* | ✅ | ✅ |
| **Tools Database, Audit, Backup Download, Sampah, & API Key Tiket** | ❌ *(403)* | ❌ *(403)* | ✅ | ✅ |
| **Pengaturan Sistem & Kelola Pengguna** (`/api/auth/users`, `/settings`) | ❌ *(403)* | ❌ *(403)* | ✅ *(Non-Dev)* | ✅ *(Termasuk Dev)* |

> **Catatan Aturan Khusus**:
> - Penghapusan **Kategori (`jenis`)**, **Atribut**, **Produk**, dan **Storage Box** selalu melalui pengecekan prasyarat di backend: sistem **menolak hapus (HTTP 400)** jika masih terdapat stok aktif/dipesan, request terbuka, produk aktif, atau varian tipe aktif yang memakainya.
> - Penandaan **Selesai (Terpakai Pelanggan)** pada `POST /api/requests/:id/complete` **hanya berlaku untuk kategori `Barang Habis Pakai`**; barang kategori `Alat` ditolak agar tetap wajib melalui proses pengembalian ke gudang (`dikembalikan`).

---

## 🔐 2. Alur Autentikasi, Hashing PBKDF2, & Sesi Cookie Server-Authoritative

### A. Kriptografi Kata Sandi & Pendaftaran Akun
1. Seluruh kata sandi di-hash dengan **PBKDF2** (`crypto.pbkdf2Sync`) menggunakan **100.000 iterasi SHA-256** dan **16-byte random salt** (`authService.ts` & `frontend/src/utils/security.ts`).
2. Pendaftaran mandiri (`POST /api/auth/register`) hanya mengizinkan peran `technician` atau `warehouse_admin` dengan status awal **`PENDING_APPROVAL`** sampai disetujui oleh `admin`/`developer`. Akun `admin` dan `developer` hanya dapat dibuat di sisi server (`npm run setup:admin`) atau dari panel internal oleh peran berwenang.
3. Endpoint `/api/auth/login` dan `/api/auth/reset-password` dilindungi *rate limiter* untuk mencegah serangan *brute-force*.

### B. Manajemen Sesi Server (`sesi`) & Cookie `HttpOnly`
Sistem **tidak lagi menyimpan sesi atau peran di `localStorage`**. Validasi otentikasi sepenuhnya dilakukan di server melalui tabel `sesi` (`SessionService`):
- **Cookie Sesi**: Backend menerbitkan cookie `HttpOnly`, `SameSite=Lax` (dan `Secure` saat `NODE_ENV=production`):
  - `fieldops_access` (dan alias `fieldops_session`)
  - `fieldops_refresh`
  - `fieldops_device` (pengikat perangkat berbasis SHA-256 `device_id_hash`)
- **Parameter Sesi Aktif (`pengaturan`, sejak migrasi `10_v2_unify_stock_and_sessions.sql`)**:
  - `ACCESS_TOKEN_TTL_DETIK = 2592000` (30 hari)
  - `IDLE_TIMEOUT_MENIT = 43200` (30 hari)
  - `ABSOLUTE_TIMEOUT_JAM = 720` (30 hari)
  - `MAX_SESI_PER_AKUN = 50` (mendukung login multi-perangkat tanpa saling memutus sesi)
  - `REAUTH_MENIT = 15` (batas waktu verifikasi ulang kata sandi untuk konfirmasi Tingkat 3)
- **Rotasi Refresh Token & Anti-Replay**: Setiap pemanggilan `POST /api/auth/refresh` merotasi `refresh_hash`. Jika terdeteksi pemakaian ulang (*token reuse*) atau ketidaksesuaian perangkat, server otomatis mencabut sesi dan mencatat aktivitas `deteksi_token_reuse`.

---

## 🛡️ 3. Penegakan Konfirmasi Sensitif Bertingkat (Tier 0–3)

Untuk melindungi aksi berisiko tinggi dari eksekusi tidak sengaja atau pemanggilan API langsung tanpa validasi UI, `ConfirmationService` menerapkan verifikasi bertingkat berbasis token sekali pakai di tabel `token_konfirmasi` (`TTL = 120 detik`, dikonsumsi atomik melalui header `X-Confirmation-Token` atau `confirmation_token` di body):

| Tingkat | Mekanisme Validasi | Contoh Aksi (`CONFIRMATION_TIERS`) |
| :---: | :--- | :--- |
| **Tier 0** | Tanpa dialog tambahan | Pemindahan box tunggal (`stock_move_single`), pembaruan catatan (`notes_update`). |
| **Tier 1** | Konfirmasi dialog UI standar | Output barang tunggal (`stock_out_single`), restore tunggal dari arsip (`restore_single`). |
| **Tier 2** | Wajib mengetik kata **`approve`** | Persetujuan/penolakan request (`request_approve`, `request_reject`), input/output stok massal (`bulk_stock_in`, `bulk_stock_out`). |
| **Tier 3** | Wajib mengetik **nama objek persis** + **re-autentikasi kata sandi** jika login sudah melewati `REAUTH_MENIT` (15 menit) | Hapus permanen (`permanent_delete`), hapus kategori (`delete_kind`), atribut (`delete_attribute`), produk (`delete_product`), tipe (`delete_type`), storage box (`delete_box`), koreksi aturan ID tipe yang sudah dikunci (`change_id_rule`), koreksi ID item (`correct_item_id`), perubahan peran (`change_role`). |
