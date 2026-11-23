# Struktur Data & Skema Database MariaDB 11.x - FieldOps IT (v1.2.7)

Dokumen ini menjelaskan model data relasional **tunggal (kanonik)**, seluruh skema tabel MariaDB 11.4 LTS hingga migrasi `13_purchase_wa4_and_report_config.sql`, mekanisme **Reservasi, Pengembalian, Pengajuan Pembelian, Multi-Tas & Status Selesai**, aturan mutasi stok atomik, kebijakan **UTC ↔ WIB**, dan proteksi data pada **FieldOps IT (`v1.2.7`)**.

---

## 🗄️ 1. Skema Database Relasional MariaDB 11.4 LTS

Penyimpanan sistem menggunakan database relasional **MariaDB 11.4 LTS** on-premises (UTC) yang terbagi ke dalam beberapa kelompok skema migrasi (`01` s/d `13`):

### A. Skema Akun Pengguna (`01_auth_schema.sql`)

#### 1. Tabel `users`
Menyimpan akun pengguna internal kantor (`developer`, `admin`, `warehouse_admin`, `technician`, serta nilai kompatibilitas legacy `superadmin` / `supervisor`).

| Nama Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | Primary Key unik pengguna |
| `username` | `VARCHAR(64)` | Username unik untuk login (case-insensitive) |
| `name` | `VARCHAR(128)` | Nama lengkap pengguna |
| `email` | `VARCHAR(128)` | Alamat email unik pengguna |
| `role` | `ENUM(...)` | Peran: `'technician'`, `'warehouse_admin'`, `'admin'`, `'supervisor'`, `'developer'`, `'superadmin'` |
| `department` | `VARCHAR(128)` | Departemen / divisi kantor |
| `phone` | `VARCHAR(32)` | Nomor telepon / WhatsApp staf |
| `password_hash` | `VARCHAR(256)` | Hash PBKDF2 SHA-256 (100.000 iterasi) |
| `salt` | `VARCHAR(64)` | Salt acak 16-byte |
| `status` | `ENUM(...)` | Status akun: `'ACTIVE'`, `'SUSPENDED'`, `'PENDING_APPROVAL'`, `'REJECTED'` |
| `created_at`, `updated_at` | `TIMESTAMP` | Waktu pembuatan & pembaruan akun (UTC) |

---

### B. Skema Checklist Inspeksi, Multi-Tas Lapangan, & API Keys (`02_inventory_schema.sql`)

> **Catatan Unifikasi Model Tunggal (v1.2.6+)**: Tabel awal `categories`, `items`, `transactions` (dari `02_inventory_schema.sql` + migrasi transisi `10`/`11`), `sessions` (`01`), `whatsapp_config`, dan `whatsapp_logs` hanya dipertahankan pada skema migrasi historis demi kompatibilitas upgrade. Seluruh operasional produksi v1.2.7 membaca dan menulis **hanya** ke model kanonik tunggal (`jenis`, `produk`, `tipe`, `box`, `item`, `stok_jumlah`, `transaksi`, `transaksi_detail`, `request`, `sesi`, `wa_*`).

#### 1. Tabel `checklists` (Inspeksi Harian & Template Multi-Tas Kerja Lapangan)
Tabel `checklists` menjalankan dua peran melalui kolom `inspection_type`:
- **`TOOLKIT_CHECK`** *(atau tipe inspeksi non-template lainnya)*: Catatan riwayat inspeksi kelengkapan perlengkapan harian teknisi (`GET/POST /api/checklists`).
- **`BAG_TEMPLATE`**: Definisi paket **Multi-Tas Kerja Kantor** yang dikelola oleh `BagService` (`GET/POST/PUT/DELETE /api/checklists/bags`) dan terhubung langsung ke pilihan **Pilih Paket Tas** pada form request (`POST /api/requests/bag`).

| Nama Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | Primary Key (`chk-...` atau `bag-...`) |
| `technician_id`, `technician_name` | `VARCHAR(36)` / `VARCHAR(128)` | ID & nama pembuat inspeksi atau pembuat tas kerja |
| `inspection_type` | `VARCHAR(64)` | `'TOOLKIT_CHECK'` (inspeksi) atau `'BAG_TEMPLATE'` (definisi tas kerja kantor) |
| `vehicle_or_kit_name` | `VARCHAR(128)` | Nama tas kerja / kit perlengkapan (unik pada `BAG_TEMPLATE`) |
| `notes` | `TEXT` | Keterangan tambahan tas / catatan inspeksi |
| `items_json` | `JSON` | Daftar alat (`tipe_id`, `nama_produk`, `nama_tipe`, `kategori_barang`, `tipe_stok`, `mode_stok`, `jumlah`, `kode_id`, `catatan`) |
| `created_at` | `TIMESTAMP` | Waktu pembuatan (UTC) |

#### 2. Tabel `api_keys`
Menyimpan kunci integrasi sistem tiket eksternal (`POST /api/tickets/consume`, `GET/POST /api/tickets/keys`):
- `id` (`VARCHAR(36)`), `name` (`VARCHAR(128)`), `api_key_hash` (`VARCHAR(128)` SHA-256), `system_name` (`VARCHAR(128)`), `allowed_actions` (`JSON`), `is_active` (`BOOLEAN`), `created_at`, `last_used_at`.

#### 3. Tabel `audit_logs` (`03_audit_trail_schema.sql`)
Menyimpan log audit perubahan administratif (`id`, `user_id`, `action`, `table_name`, `record_id`, `before_state` JSON, `after_state` JSON, `ip_address`, `created_at`).

---

### C. Skema Fondasi Keamanan & Ledger Kanonik (`04_v2_foundation_schema.sql` & `10`–`12`)

#### 1. Tabel `sesi` (Server-Authoritative Sesi & Rotasi Token)
Menyimpan catatan sesi server dengan rotasi refresh token dan validasi perangkat (`device_id_hash`).

| Nama Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | Primary Key unik token sesi |
| `user_id` | `VARCHAR(36)` | Foreign Key ke tabel `users(id)` |
| `refresh_hash` | `VARCHAR(128)` | Hash SHA-256 token penyegar aktif |
| `device_id_hash` | `VARCHAR(128)` | Hash SHA-256 ID perangkat peramban |
| `user_agent`, `ip` | `TEXT` / `VARCHAR(45)` | Informasi peramban & alamat IP terakhir |
| `dibuat_pada`, `aktivitas_terakhir` | `TIMESTAMP` | Waktu pembuatan & aktivitas terakhir (UTC) |
| `kedaluwarsa_mutlak` | `TIMESTAMP` | Batas kedaluwarsa mutlak sesi (**30 hari / 720 jam** sejak migrasi `10`) |
| `dicabut_pada` | `TIMESTAMP NULL` | Waktu sesi dicabut (logout / kuota / deteksi token reuse) |

#### 2. Tabel `pengaturan` (Konfigurasi Dinamis & Pola Serial Number)
Menyimpan parameter konfigurasi sistem serta daftar pola ekstraksi SN (`SN_PATTERNS`):

| Nama Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `kunci` | `VARCHAR(80)` | Primary Key nama konfigurasi |
| `nilai` | `TEXT` | Nilai konfigurasi (string/angka/JSON) |
| `keterangan` | `TEXT` | Penjelasan fungsi parameter |
| `diperbarui_pada` | `TIMESTAMP` | Waktu pembaruan terakhir |

**Kunci Pengaturan Aktif (`pengaturan`)**:
- `ACCESS_TOKEN_TTL_DETIK = '2592000'` *(30 hari — diperbarui di migrasi `10_v2_unify_stock_and_sessions.sql`)*
- `IDLE_TIMEOUT_MENIT = '43200'` *(30 hari)*
- `ABSOLUTE_TIMEOUT_JAM = '720'` *(30 hari)*
- `MAX_SESI_PER_AKUN = '50'` *(multi-perangkat diizinkan tanpa saling memutus)*
- `REAUTH_MENIT = '15'`, `RETENSI_SAMPAH_HARI = '14'`, `CONFIRMATION_TOKEN_TTL_DETIK = '120'`
- `CONFIRMATION_TIERS`: Pemetaan JSON Tier 0–3 (`delete_kind`, `delete_attribute`, `delete_product`, `delete_box`, `request_approve`, `change_id_rule`, dsb.)
- `SN_PATTERNS`: Array JSON `SNPatternRecord[]` untuk manajemen aturan regex & normalisasi `SCAN_SN` via `/api/sn-patterns`.
- `REPORT_APPROVAL_CONFIG`: JSON konfigurasi Kop Surat (`companyName`, `divisionName`, `companyAddress`) dan 3 penandatangan **Lembar Pengesahan** (`signers` dengan `roleLabel`, `name`, `title`, dan opsi `useCurrentUser`) yang dikelola via `/api/reports/approval-config`.

#### 3. Tabel `transaksi` & `transaksi_detail` (Append-Only Ledger Kanonik Format `AKT-YYYYMMDD-NNNN`)
Mencatat seluruh mutasi dan aktivitas audit secara append-only (`04` & `12_unify_single_model_and_wib.sql`) dengan penyimpanan waktu UTC penuh.

| Nama Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | Primary Key transaksi |
| `id_aktivitas` | `VARCHAR(32)` | ID Aktivitas unik harian berbasis kalender WIB (`AKT-YYYYMMDD-NNNN`) |
| `aksi` | `VARCHAR(64)` | Jenis aksi (`tambah_item`, `barang_keluar`, `ambil_request`, `ajukan_pengembalian`, `kembali_alat`, `kembalikan_request`, `selesai_request`, `buat_tas_kerja`, `ubah_tas_kerja`, `hapus_tas_kerja`, `koreksi_transaksi`, dsb.) |
| `pelaku_id` | `VARCHAR(36)` | Referensi pelaku utama |
| `actor_id` / `actor_nama` | `VARCHAR(36)` / `VARCHAR(160)` | Pelaku lapangan sebenarnya yang menerima/menjalankan mutasi |
| `recorded_by_id` / `recorded_by_nama` | `VARCHAR(36)` / `VARCHAR(160)` | Petugas yang mencatat transaksi di sistem |
| `is_on_behalf` / `on_behalf_reason` | `TINYINT(1)` / `TEXT NULL` | Penanda pencatatan atas nama pengguna lain dan alasannya (min. 3 karakter) |
| `occurred_at` / `recorded_at` | `DATETIME(3) NULL` | Waktu kejadian aktual (UTC) vs waktu pencatatan sistem (UTC) |
| `correction_of_id` | `VARCHAR(64) NULL` | Referensi ke transaksi asal jika entri merupakan koreksi audit append-only |
| `penyetuju_id` / `request_id` | `VARCHAR(36) NULL` | ID penyetuju dan referensi permohonan teknisi |
| `reference_type` / `reference_number` | `VARCHAR(64)` / `VARCHAR(120)` | Kategori & nomor referensi mutasi / tiket / tas |
| `recipient_destination` | `VARCHAR(255) NULL` | Tujuan / teknisi / nama atau ID pelanggan / box |
| `qty_total` / `tipe_mutasi` | `INT` / `VARCHAR(16)` | Total kuantitas & jenis mutasi (`MASUK`, `KELUAR`, `TRANSFER`, `SYSTEM`) |
| `box_asal` / `box_tujuan` | `VARCHAR(32) NULL` | Kode box penyimpanan asal & tujuan |
| `catatan` | `TEXT NULL` | Keterangan pekerjaan / tiket / pemasangan pelanggan |
| `waktu` | `TIMESTAMP` | Timestamp kompatibilitas (selaras `occurred_at` UTC) |

#### 4. Tabel `sampah_hapus` (Retensi 14 Hari)
Menyimpan snapshot data terhapus permanen (`jenis_objek`: `'item'`, `'produk'`, `'jenis'`, `'tipe'`, `'box'`, `'akun'`) beserta `snapshot` JSON, `dihapus_oleh`, `aktivitas_id`, `purge_setelah` (+14 hari), dan `status` (`'menunggu'`, `'dipulihkan'`, `'dibersihkan'`).

#### 5. Tabel `token_konfirmasi` (Konfirmasi Sensitif Bertingkat)
Menyimpan token verifikasi sekali pakai (*single-use*, TTL 120 detik) berisi `token_hash`, `user_id`, `action_type`, `target_id`, `tier` (`2` atau `3`), `expires_at`, dan `used_at`.

---

### D. Skema Katalog Bertingkat (`05_v2_catalog_schema.sql`, `08_v125_paket4_schema.sql`, `12`)

Hierarki kanonik: **`jenis` (Kategori)** → **`atribut` / `atribut_opsi`** → **`produk`** → **`tipe` / `tipe_nilai`** → **`item` / `stok_jumlah`**.

1. **`jenis`** *(Kategori Katalog)*: `id`, `nama`, `sumber_id_bawaan` (`scan_sn`, `otomatis`, `manual`, `tanpa_id`), `prefix_id_bawaan`, `aktif`, `dibuat_pada`. Dapat diubah via `PUT /api/catalog/jenis/:id` dan dihapus terproteksi ke Kotak Sampah via `DELETE /api/catalog/jenis/:id` (ditolak jika masih ada produk aktif).
2. **`atribut` & `atribut_opsi`**: `id`, `jenis_id`, `kode`, `nama`, `tipe_isian` (`angka`, `pilihan`, `teks`), `satuan`, `wajib`, `urutan`, `masuk_nama`, dan `atribut_opsi` (`id`, `atribut_id`, `nilai`, `urutan`). Dapat diubah/dihapus terproteksi (ditolak bila dipakai varian tipe aktif).
3. **`produk`**:

| Nama Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | `INT UNSIGNED AUTO_INCREMENT` | Primary Key unik produk |
| `jenis_id` | `INT UNSIGNED` | Foreign Key ke `jenis(id)` |
| `nama` | `VARCHAR(120)` | Nama produk (unik per kategori) |
| `kategori` | `VARCHAR(32)` | Kategori perputaran: `'fast_moving'` atau `'recycle'` |
| `kategori_barang` | `VARCHAR(40)` | Klasifikasi fungsi (`08` & `12`): `'Alat'` (wajib kembali) atau `'Barang Habis Pakai'` (bisa selesai terpakai pelanggan) |
| `tipe_stok` | `VARCHAR(40)` | Satuan stok (`'unit'`, `'roll'`, `'meter'`, `'pcs'`, `'box'`, `'set'`, dsb.) |
| `catatan`, `aktif`, `dibuat_oleh`, `dibuat_pada` | Metadata produk & status soft-delete (`aktif = 0`) |

4. **`tipe` & `tipe_nilai`**:
   - `tipe`: `id`, `produk_id`, `nama_tipe` (auto-generated dari atribut `masuk_nama = 1`), `catatan`, `sumber_id`, `mode_stok` (`per_id` / `jumlah`), `prefix_id`, `pola_id`, `id_dikunci`, `aktif`.
   - `tipe_nilai`: Nilai EAV (`tipe_id`, `atribut_id`, `nilai_angka`, `opsi_id`, `nilai_teks`).

---

### E. Skema Box, Item Fisik & Stok Jumlah (`06_v2_stock_schema.sql`, `08`, `12`)

1. **`box`**: `id`, `kode` (misal `BOX-A-01`), `keterangan`, `aktif`, `dibuat_pada`. Penghapusan (`DELETE /api/boxes/:id`) ditolak jika masih berisi stok aktif/dipesan atau request terbuka.
2. **`item`** (Unit Fisik Ber-ID Unik): `id`, `kode_id` (unik global), `tipe_id`, `box_id`, `status` (`'aktif'`, `'dipesan'`, `'keluar'`), `kondisi` (`'Baru'`, `'Baik'`, `'Perlu Perbaikan'`, `'Rusak'`), `catatan_kondisi`, `reserved_for_request_id`, `reserved_for_user_id`, `dibuat_pada` (UTC). Item berkondisi `Rusak` tidak masuk stok tersedia.
3. **`stok_jumlah`** (Mode `tanpa_id`): Composite PK (`tipe_id`, `box_id`), `jumlah`, `reserved_qty`.

---

### F. Skema Siklus Request Teknisi (`07_v2_request_schema.sql`, `12` & `13_purchase_wa4_and_report_config.sql`)

Tabel `request` mengelola seluruh siklus:
- **Alur Ambil (`request_type = 'ambil'`)**: `diajukan` *(atau `menunggu`)* → `disetujui` *(reservasi)* → `diambil` → `dikembalikan` *(wajib untuk `Alat`)* | `selesai` *(khusus `Barang Habis Pakai` terpakai pelanggan)* | `ditolak` | `dibatalkan`.
- **Alur Pengajuan Pengembalian (`request_type = 'kembalikan'`)**: Pengajuan mengacu ke request pengambilan asal via kolom `transaction_out_id` (`req-...`) dengan `return_condition` terpetakan (`Baru` / `Baik` / `Rusak`) dan `return_box_id` tujuan; saat gudang menjalankan `POST /api/requests/:id/return`, baik request pengajuan maupun request asal ditutup ke status `'dikembalikan'`.
- **Alur Pengajuan Pembelian Barang (`request_type = 'beli'`)**: Pengajuan pembelian dari katalog (`tipe_id`) maupun barang baru non-katalog (`tipe_id = NULL`, mengisi `purchase_item_name` & opsional `purchase_estimated_price`). Alur status `diajukan` → `disetujui` *(persetujuan admin/gudang tanpa memotong/mereservasi stok fisik)* → `selesai` (`return_condition = 'Dibeli'`, via `POST /api/requests/:id/complete`). Hanya jenis `beli` yang memicu notifikasi WhatsApp.
- **Alur `Selesai (Terpakai Pelanggan)` (`POST /api/requests/:id/complete`)**: Mengubah status menjadi `'selesai'`, mengisi `returned_at` (UTC), `returned_by_id`, `return_condition = 'Terpakai'`, dan `return_notes = 'Pelanggan: <Nama/ID> | Pemasangan: <Catatan>'`.

| Nama Kolom | Tipe Data | Deskripsi |
| :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | Primary Key permohonan |
| `pemohon_id` / `actor_id` / `recorded_by_id` | `VARCHAR(36)` | Teknisi pemohon, pelaku lapangan, & petugas pencatat |
| `penyetuju_id` | `VARCHAR(36) NULL` | Pengelola yang menyetujui / menolak / memverifikasi |
| `request_type` | `VARCHAR(16)` | Jenis request: `'ambil'`, `'kembalikan'`, atau `'beli'` *(migrasi `13`)* |
| `tipe_id` / `box_id` / `kode_id` / `jumlah` | `INT NULL` / `VARCHAR` | Target varian tipe (`NULL` jika pembelian barang baru), box, SN opsional, & kuantitas |
| `purchase_item_name` / `purchase_estimated_price` | `VARCHAR(200) NULL` / `DECIMAL(14,2) NULL` | Nama barang baru non-katalog & estimasi harga satuan/pengajuan opsional *(migrasi `13`)* |
| `alasan` / `catatan_penolakan` | `TEXT` | Alasan permohonan (memuat tag `[Tas: <Nama>]` untuk paket tas) & catatan penolakan |
| `status` | `VARCHAR(32)` | `'diajukan'`, `'menunggu'`, `'disetujui'`, `'diambil'`, `'dikembalikan'`, `'selesai'`, `'ditolak'`, `'dibatalkan'` |
| `taken_at` / `returned_at` | `DATETIME(3) NULL` | Waktu serah terima (`diambil`) & waktu kembali / selesai pemakaian (UTC) |
| `returned_by_id` | `VARCHAR(36) NULL` | ID petugas/teknisi yang memverifikasi pengembalian atau menyelesaikan pemakaian |
| `return_condition` / `return_notes` / `return_box_id` | `VARCHAR(32)` / `TEXT` / `VARCHAR(36)` | Kondisi kembali (`Baru`/`Baik`/`Perlu Perbaikan`/`Rusak`), `'Terpakai'`, atau `'Dibeli'`, catatan, & box tujuan |
| `allocated_item_ids` / `transaction_out_id` / `transaction_in_id` | `TEXT` / `VARCHAR(64)` | JSON ID item dialokasi, referensi transaksi keluar (atau `origin_request_id` pada pengajuan `kembalikan`), & referensi transaksi kembali |

---

### G. Skema WA Alert Otomatis & Ambang Berjenjang (`09_v125_paket6_wa_alert.sql` & `13`)

1. **`wa_config`**: Pengaturan utama Fonnte (`id = 'main'`, `is_enabled`, `cooldown_minutes` default `15`, `last_sent_at`, `active_hours_start/end`, toggle alert `out_of_stock` / `low_stock` / `early_warning`, `global_low_stock_threshold`, `global_early_warning_threshold`, `recipients_json`, `recipient_slots_json`, `api_url`, `api_token`). Kolom `recipient_slots_json` *(migrasi `13`)* menyimpan maksimal **4 slot penerima** (`slot`, `label`, `number`, `enabled`) dengan saklar ON/OFF individual; hanya slot aktif yang masuk ke `recipients_json`.
2. **`wa_thresholds`**: Konfigurasi ambang berjenjang (`level`: `'produk'` | `'tipe'`, `produk_id`, `tipe_id`, `low_stock_threshold`, `early_warning_threshold`, `is_watchlist`). Resolusi prioritas: **Tipe > Produk > Global**.
3. **`wa_alert_status`**: Status anti-duplikat per target (`target_type`: `'item'` | `'tipe'` | `'produk'`, `target_id`, `current_status`, `last_alert_status`, `last_alert_sent_at`, `pending_in_queue`).
4. **`wa_delivery_logs`**: Riwayat pengiriman alert (`id`, `sent_at`, `trigger_type`, `recipients`, `message_snippet`, `summary_counts`, `fonnte_status`, `fonnte_response`, `operator_id`).

---

## 📐 2. Aturan Mutasi Stok Atomik & Kebijakan Zona Waktu (UTC ↔ WIB)

1. **Mutasi Barang Masuk (`IN`)**:
   $$\text{Stok Tersedia Baru} = \text{Stok Lama} + \text{Jumlah Masuk}$$
2. **Mutasi Barang Keluar (`OUT`)**:
   $$\text{Stok Tersedia} = \text{Total Fisik Non-Rusak} - \text{Reservasi (`dipesan` / `reserved_qty`)}$$
   - **Invarian Validasi**: Item berstatus `keluar`, berkondisi `Rusak`, atau sedang `dipesan` (tanpa kecocokan `request_id`) ditolak secara atomik; untuk `TANPA_ID`, $\text{Jumlah Keluar} \le \text{Stok Tersedia}$.
3. **Penyimpanan UTC & Tampilan WIB (`Asia/Jakarta`)**:
   - Server menjalankan `process.env.TZ = 'UTC'`. Seluruh datetime disimpan UTC di MariaDB, diformat `DD/MM/YYYY HH:mm WIB` di antarmuka, dan direkap mingguan dari Senin `00:00:00.000 WIB` hingga Minggu `23:59:59.999 WIB`.

---

## 🛡️ 3. Kebijakan Keamanan Ekspor Data (CWE-1236)

Setiap nilai string yang diekspor ke format CSV, Excel, atau PDF wajib melalui fungsi pembersih:
```typescript
export function sanitizeFormulaInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}
```
Karakter pemicu formula eksekusi spreadsheet (`=`, `+`, `-`, `@`, `\t`, `\r`) diprefiks tanda petik tunggal (`'`).
