# Peran, Hak Akses & Keamanan Sesi - FieldOps IT (v1.2.8)

Dokumen ini mendefinisikan **Role-Based Access Control (RBAC)** server-authoritative, sistem **Izin Fitur Per Akun** (`feature_permissions`), alur autentikasi PBKDF2, manajemen sesi cookie server (`sesi`), serta mekanisme konfirmasi bertingkat (*Tier 0–3*) pada **FieldOps IT (`v1.2.8`)**.

---

## 👥 1. Peran Kanonis & Matriks Hak Akses (RBAC Matrix)

Definisi hak akses dipusatkan di `backend/src/utils/permissions.ts` dan disinkronkan di UI oleh `frontend/src/utils/permissions.ts`. Mulai `v1.2.8`, peran `admin` dan `warehouse_admin` dilebur menjadi satu peran **`admin`** sehingga sistem menggunakan **3 peran kanonis** *(nilai legacy `warehouse_admin`, `supervisor`, dan `superadmin` dinormalisasi otomatis untuk kompatibilitas migrasi)*:

- **`developer`** *(termasuk alias legacy `superadmin`)*: Pemegang kendali teknis penuh atas seluruh fitur dan akun (termasuk akun `developer` lain), pengaturan sistem `.env`, setup MariaDB, Cloudflare Tunnel, **Atur Fitur Slider ON/OFF per akun**, **Dual WhatsApp Gateway (`gateway1` & `gateway2`)**, API Key tiket, dan audit keamanan.
- **`admin`** *(melebur `admin`, `warehouse_admin`, dan `supervisor`)*: Administrator operasional utama dengan wewenang bawaan untuk pekerjaan operasional harian: **Gudang** (stok masuk/keluar/transfer/arsip/restore), **Request** (setujui/serahkan/verifikasi kembali/selesai/pembelian), **Katalog & Impor Excel/Spreadsheet** (termasuk hapus massal terproteksi), **Kelola Akun terbatas hanya `admin` & `technician`**, **WA Alert 4 slot penerima & ambang** *(tanpa akses Gateway)*, **Pola Serial Number (SN)**, serta **Laporan & Koreksi Audit**.
- **`technician`**: Teknisi lapangan untuk melihat katalog/stok/log WA (*read-only*), mengajukan permohonan ambil/kembalikan/paket tas/pengajuan pembelian barang (`beli`), menandai selesai barang habis pakai miliknya, mengisi checklist/tas kerja, serta ekspor laporan.

| Fitur / Endpoint / Modul | `technician` | `admin` | `developer` |
| :--- | :---: | :---: | :---: |
| **Lihat Katalog Data Barang, Varian, Isi Box, Arsip, & Laporan Mingguan** | ✅ | ✅ | ✅ |
| **Lihat Status WA Alert, Ambang, & Log Pengiriman** | ✅ *(Read-Only)* | ✅ | ✅ |
| **Alat Harian Menu Tools (Akses HP, Ekspor Excel, Cetak Label A4)** | ✅ | ✅ | ✅ |
| **Kelola & Gunakan Tas Kerja / Checklist Inspeksi** (`/api/checklists/*`) | ✅ | ✅ | ✅ |
| **Buat Request Ambil Satuan / Paket Tas / Kembalikan / Pembelian (`beli`)** (`POST /api/requests*`) | ✅ *(Diri Sendiri)* | ✅ *(+ Atas Nama)* | ✅ *(+ Atas Nama)* |
| **Tandai Selesai Barang Habis Pakai** (`POST /api/requests/:id/complete`) | ✅ *(Milik Sendiri)* | ✅ | ✅ |
| **Tandai Sudah Dibeli pada Request Pembelian (`beli`)** (`POST /api/requests/:id/complete`) | ❌ *(403)* | ✅ | ✅ |
| **Ubah Kop Surat & Penandatangan Lembar Pengesahan** (`PUT /api/reports/approval-config`) | ❌ *(403)* | ✅ | ✅ |
| **Kelola Katalog, Box, & Hapus Massal Terproteksi** (`/api/catalog/*`, `/api/boxes/*`) | ❌ *(403)* | ✅ | ✅ |
| **Impor Katalog, Box, & Stok Awal Excel/Spreadsheet** (`/api/import/*`) | ❌ *(403)* | ✅ | ✅ |
| **Input Masuk, Output Keranjang Keluar, Restore, Pindah Box, & Hapus Item Fisik** | ❌ *(403)* | ✅ | ✅ |
| **Setujui / Serahkan / Verifikasi Kembali / Tolak Request** | ❌ *(403)* | ✅ | ✅ |
| **Catat Koreksi Audit Append-Only** (`POST /api/activities/:id/correct`) | ❌ *(403)* | ✅ | ✅ |
| **Batas Tanggal Mundur (`occurred_at` Backdate)** | **Maks. 7 Hari** | **Tanpa Batas** | **Tanpa Batas** |
| **Tab Setting — WA Alert 4 Slot Penerima ON/OFF & Ambang** (`POST /api/whatsapp/*`) | ❌ *(403)* | ✅ *(Tanpa Gateway)* | ✅ |
| **Tab Setting — Pengaturan Pola Serial Number (SN)** (`/api/sn-patterns`) | ❌ *(403)* | ✅ | ✅ |
| **Tab Setting — Kelola Akun (Buat, Setujui, Reset, Hapus)** (`/api/auth/users`) | ❌ *(403)* | ✅ *(Hanya `admin` & `technician`)* | ✅ *(Termasuk `developer`)* |
| **Tab Setting — Atur Fitur Per Akun (Slider ON/OFF)** (`PUT /api/auth/users/:id/features`) | ❌ *(403)* | ❌ *(403)* | ✅ *(Khusus Developer)* |
| **Tab Setting — Dual WhatsApp Gateway 1 & 2 (URL, Token, Uji Gateway)** (`/api/whatsapp/test-gateway`) | ❌ *(403)* | ❌ *(403)* | ✅ *(Khusus Developer)* |
| **Tab Setting — Setup `.env` (DB, Cloudflare Tunnel), Cek Sistem, API Key Tiket, Backup & Sampah** (`/api/setup/*`) | ❌ *(403)* | ❌ *(403)* | ✅ *(Khusus Developer)* |

### 🎛️ Kustomisasi Fitur Per Akun (`feature_permissions`, Khusus `developer`)
Selain wewenang bawaan per peran di atas, peran **`developer`** dapat menyalakan atau mematikan masing-masing dari **21 fitur (`FEATURE_CATALOG`)** untuk akun non-developer mana pun melalui menu **Setting → Manajemen Pengguna → Atur Fitur** dengan saklar slider ON/OFF (`PUT /api/auth/users/:id/features`).
- Jika saklar disetel khusus (`true`/`false`), nilai tersebut menjadi izin efektif akun pada UI maupun middleware backend `requireFeature('<feature_key>')`.
- Tombol **Reset ke Bawaan Peran** menghapus seluruh override (`null`) agar akun kembali mengikuti hak akses bawaan perannya.
- Hak istimewa tingkat sistem (`Atur Fitur`, `Dual WA Gateway`, pengelolaan akun `developer`) **tidak** dapat didelegasikan ke peran non-developer.

> **Catatan Aturan Khusus**:
> - Penghapusan tunggal maupun massal **Kategori (`jenis`)**, **Atribut**, **Produk**, dan **Storage Box** selalu melalui pengecekan prasyarat di backend: sistem **menolak hapus (HTTP 400)** jika masih terdapat stok aktif/dipesan, request terbuka, produk aktif, atau varian tipe aktif yang memakainya. Penghapusan **Item Fisik Ber-ID** juga menolak item yang sedang direservasi (`dipesan`).
> - Penandaan **Selesai (Terpakai Pelanggan)** pada `POST /api/requests/:id/complete` **hanya berlaku untuk kategori `Barang Habis Pakai`**; barang kategori `Alat` ditolak agar tetap wajib melalui proses pengembalian ke gudang (`dikembalikan`).

---

## 🔐 2. Alur Autentikasi, Hashing PBKDF2, & Sesi Cookie Server-Authoritative

### A. Kriptografi Kata Sandi & Kebijakan Pembuatan Akun (Registrasi Publik Ditutup)
1. Seluruh kata sandi di-hash dengan **PBKDF2** (`crypto.pbkdf2Sync`) menggunakan **100.000 iterasi SHA-256** dan **16-byte random salt** (`authService.ts` & `frontend/src/utils/security.ts`).
2. **Pendaftaran publik ditutup total sejak `v1.2.8`**: Halaman login hanya menampilkan formulir **Masuk** dan **Lupa Kata Sandi**. Endpoint `POST /api/auth/register` menolak seluruh permintaan dengan **`HTTP 403 Forbidden`**.
3. Akun baru hanya dapat dibuat dari:
   - **Dalam Aplikasi Web**: melalui panel **Manajemen Pengguna** oleh `developer` (semua peran) atau `admin` (terbatas peran `admin` & `technician`).
   - **Terminal Server**: melalui CLI `npm run setup:admin` oleh administrator server.
4. Endpoint `/api/auth/login` dan `/api/auth/reset-password` dilindungi *rate limiter* untuk mencegah serangan *brute-force*.

### B. Manajemen Sesi Server (`sesi`) & Cookie `HttpOnly`
Sistem **tidak lagi menyimpan sesi atau peran di `localStorage`**. Validasi otentikasi sepenuhnya dilakukan di server melalui tabel `sesi` (`SessionService`):
- **Cookie Sesi**: Backend menerbitkan cookie `HttpOnly`, `SameSite=Lax` (dan `Secure` otomatis pada HTTPS aktual):
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
| **Tier 3 (Hapus)** | Wajib mengetik kata **`delete`** *(efisien untuk hapus tunggal maupun multi-pilih)* + **re-autentikasi kata sandi** jika login melewati `REAUTH_MENIT` (15 menit) | Hapus permanen (`permanent_delete`), hapus kategori (`delete_kind`), atribut (`delete_attribute`), produk (`delete_product`), tipe (`delete_type`), storage box (`delete_box`), dan item fisik ber-ID (`delete_item`). |
| **Tier 3 (Non-Hapus)** | Wajib mengetik **nilai target/konfirmasi** + **re-autentikasi kata sandi** jika login melewati `REAUTH_MENIT` (15 menit) | Koreksi aturan ID tipe yang sudah dikunci (`change_id_rule`), koreksi ID item (`correct_item_id`), perubahan peran (`change_role`). |

