# DOKUMEN ARSITEKTUR SISTEM (ARCHITECTURE.MD)
**Aplikasi**: FieldOps IT Inventory (Rilis v1.2.8)  
**Database Mesin**: MariaDB 11.4 LTS (Server Lokal On-Premises, UTC)  
**Arsitektur**: Decoupled Monorepo (`frontend/` React 19 SPA + `backend/` Express 5 REST API) dengan Model Data Kanonik Tunggal  
**Status**: Rilis v1.2.8 Terverifikasi Penuh

> **Pembaruan Arsitektur v1.2.8**: Di atas model data kanonik tunggal (`jenis → produk → tipe → item / stok_jumlah → transaksi / transaksi_detail → request`), rilis v1.2.8 menutup pendaftaran publik di halaman login (`POST /api/auth/register` → `403`), melebur peran `admin` dan `warehouse_admin` menjadi **`admin`**, menambahkan sistem **Izin Fitur Per Akun (`feature_permissions`)** via slider ON/OFF khusus `developer` dengan middleware `requireFeature()`, menyediakan **Dual WhatsApp Gateway (`gateway1` & `gateway2`)** khusus `developer`, melengkapi **Hapus Massal Multi-Pilih + Konfirmasi `"delete"`** di 5 target katalog/stok, serta menghadirkan **`ImportService`** (`/api/import/*`) untuk impor massal Excel (`.xlsx`/`.csv`) dan Google Spreadsheet publik.

---

## 🏛️ 1. Diagram Arsitektur Sistem

```mermaid
flowchart TD
    subgraph Klien["Perangkat Pengguna (Desktop & Mobile PWA)"]
        BrowserTech["Teknisi Lapangan (technician)"]
        BrowserAdmin["Admin Operasional (admin)"]
        BrowserDev["Developer Sistem (developer)"]
    end

    subgraph JaringanAkses["Akses Jaringan & Reverse Proxy"]
        LocalLAN["LAN Kantor (HTTP :3000)"]
        RemoteAccess["Akses Luar Kantor (Cloudflare Tunnel HTTPS)"]
    end

    subgraph FrontendSPA["React 19 SPA (frontend/)"]
        Contexts["AuthContext • InventoryContext • ToastContext • ThemeContext"]
        UIViews["Katalog (4 Subtab) • Input/Output Cart • Request & Multi-Tas • Laporan WIB • Tools"]
    end

    subgraph BackendApp["Express 5 API Server (backend/src/server.ts, TZ=UTC)"]
        SecurityMW["Security Headers (SEC-05) • Rate Limit • authenticate • requireRole"]
        
        subgraph ModulBackend["Layanan Inti Backend"]
            AuthSvc["AuthService • SessionService • ConfirmationService • SettingService"]
            CatalogSvc["CatalogService (Jenis, Atribut, Produk, Tipe) & SNPatterns"]
            StockSvc["StockService (Box, Item Ber-ID, Stok Jumlah, Arsip, Restore)"]
            ReqBagSvc["RequestService (Ambil/Kembalikan/Beli/Selesai) & BagService (Multi-Tas)"]
            LedgerSvc["ActivityLogService (Append-Only AKT-) & TrashService (14 Hari)"]
            ExtSvc["WhatsappAlertService • NotificationService • TicketIntegration • BackupService"]
        end
    end

    subgraph StorageLayer["MariaDB 11.4 LTS (On-Premises, UTC)"]
        DbAuth[("Akun & Keamanan:\nusers • sesi • pengaturan\ntoken_konfirmasi • sampah_hapus")]
        DbCanon[("Katalog, Stok & Operasional:\njenis • atribut • atribut_opsi • produk • tipe • tipe_nilai\nbox • item • stok_jumlah • request\ntransaksi • transaksi_detail • checklists")]
        DbExt[("Notifikasi & Integrasi:\napi_keys • wa_config • wa_thresholds\nwa_alert_status • wa_delivery_logs • audit_logs")]
    end

    subgraph LayananLuar["Integrasi Eksternal"]
        FonnteAPI["Fonnte WhatsApp Gateway API"]
        ExternalHelpdesk["Sistem Tiket Eksternal (POST /api/tickets/consume)"]
    end

    BrowserTech --> LocalLAN
    BrowserAdmin --> LocalLAN
    BrowserDev --> RemoteAccess
    LocalLAN --> FrontendSPA
    RemoteAccess --> FrontendSPA
    FrontendSPA -->|REST JSON + Cookie HttpOnly| SecurityMW
    SecurityMW --> ModulBackend
    ModulBackend --> StorageLayer
    ExtSvc -.->|HTTPS Outbound (Cooldown 15m)| FonnteAPI
    ExternalHelpdesk -.->|X-API-Key / Bearer| ExtSvc
```

---

## 🗄️ 2. Pengelompokan Domain Data & Isolasi File

Sesuai prinsip pemisahan keamanan repositori, data autentikasi/kredensial akun dipisahkan dari data bisnis inventaris maupun ekspor cadangan JSON (*Zero Account Leakage*):

1. **Domain Autentikasi, Sesi & Keamanan (`01_auth_schema.sql`, `04_v2_foundation_schema.sql`, `14`)**:
   - `users`: Profil internal, `feature_permissions` (JSON override slider ON/OFF), dan hash PBKDF2 100k iterasi + 16-byte salt (3 peran kanonis: `developer`, `admin`, `technician`).
   - `sesi`: Sesi cookie server-authoritative dengan `refresh_hash`, `device_id_hash`, `kedaluwarsa_mutlak`, dan pencabutan anti-replay.
   - `pengaturan`: Parameter sistem dinamis (masa sesi 30 hari, `CONFIRMATION_TIERS`, `REAUTH_MENIT`, `RETENSI_SAMPAH_HARI`, `SN_PATTERNS`, serta `REPORT_APPROVAL_CONFIG` untuk Kop Surat & Lembar Pengesahan laporan).
   - `token_konfirmasi`: Token sekali pakai TTL 120 detik untuk verifikasi Tingkat 2 dan 3 (`"delete"` untuk penghapusan).
   - `sampah_hapus`: Snapshot JSON penghapusan permanen kategori/produk/box/akun dengan retensi 14 hari sebelum pemusnahan otomatis.
2. **Domain Katalog, Stok Fisik, Request, Multi-Tas, & Ledger (`05`–`08`, `12`, `13`, `14` SQL migrations + `checklists`)**:
   - Katalog bertingkat & Impor (`ImportService`): `jenis` → `atribut` / `atribut_opsi` → `produk` (`kategori_barang`, `tipe_stok`) → `tipe` / `tipe_nilai` (`sumber_id`, `prefix_id`, `pola_id`, `id_dikunci`).
   - Stok & Box: `box` (box campuran) → `item` (unit ber-ID unik dengan `status` & `kondisi`) dan `stok_jumlah` (stok mode `tanpa_id` dengan `reserved_qty`).
   - Permohonan & Paket Tas: `request` (mendukung pengambilan satuan `ambil`, pengambilan paket tas, pengajuan pengembalian `kembalikan`, pengajuan pembelian barang `beli` termasuk barang baru non-katalog `tipe_id = NULL`, serta penandaan `selesai` pemakaian pelanggan/pembelian) dan `checklists` (`TOOLKIT_CHECK` untuk inspeksi harian & `BAG_TEMPLATE` untuk Multi-Tas Kerja Lapangan).
   - Ledger Append-Only: `transaksi` & `transaksi_detail` dengan ID aktivitas harian `AKT-YYYYMMDD-NNNN`, pemisahan `actor_id` vs `recorded_by_id`, `occurred_at` UTC, dan `correction_of_id`.
3. **Domain Integrasi Eksternal, Dual WA Gateway, & Audit (`02`, `03`, `09`, `13`, `14`)**:
   - `api_keys` untuk integrasi helpdesk (`/api/tickets/consume`).
   - `wa_config` (termasuk `recipient_slots_json` 4 slot bersaklar ON/OFF serta `gateways_json` & `gateway_mode` Dual Gateway khusus `developer`), `wa_thresholds`, `wa_alert_status`, `wa_delivery_logs` untuk notifikasi stok otomatis & pengajuan pembelian barang (selektif `beli`).
   - `audit_logs` untuk catatan jejak perubahan administratif.
   *(Skema awal `categories`, `items`, `transactions`, `sessions`, `whatsapp_config`, `whatsapp_logs` dipertahankan hanya untuk kompatibilitas migrasi historis dan tidak lagi menjadi sumber baca utama di v1.2.8).*

---

## 🔒 3. Desain Autentikasi, Otorisasi, & Zona Waktu

1. **Otentikasi Cookie `HttpOnly`**:
   - `POST /api/auth/login` memverifikasi kata sandi PBKDF2 SHA-256 (100.000 iterasi) dan menerbitkan cookie `fieldops_access`, `fieldops_refresh`, `fieldops_device`, dan `fieldops_session` (`HttpOnly; SameSite=Lax`, ditambah `Secure` di produksi).
   - `authenticate` di Express memvalidasi sesi langsung dari database setiap request—peran tidak pernah dipercaya dari klien maupun `localStorage`.
2. **Penegakan Konfirmasi Bertingkat & Proteksi Hapus**:
   - Operasi destruktif pada Katalog (`delete_kind`, `delete_attribute`, `delete_product`, `delete_box`) menolak penghapusan di backend apabila masih ada produk aktif, varian aktif, stok aktif/dipesan, atau request terbuka, lalu mewajibkan token konfirmasi Tingkat 3.
3. **Kebijakan Zona Waktu (UTC Penyimpanan ↔ WIB Tampilan & Laporan)**:
   - Backend selalu mengunci `process.env.TZ = 'UTC'` dan menyimpan kolom datetime dalam UTC.
   - Seluruh tampilan aplikasi, penomoran harian `AKT-YYYYMMDD-NNNN`, batasan minggu laporan (**Senin 00:00:00.000 WIB – Minggu 23:59:59.999 WIB**), dan serial wall-clock ekspor ExcelJS dikonversi secara deterministik melalui utilitas `timezone.ts` ke `Asia/Jakarta` (WIB).

---

## 🏷️ 4. Siklus Status Barang, Request, & Mutasi

### A. Status Unit Item Fisik (`item.status` & `item.kondisi`)
- **Status Unit (`item.status`)**:
  1. `aktif`: Barang tersedia di dalam `box` gudang.
  2. `dipesan`: Barang sedang direservasi oleh permohonan teknisi berstatus `disetujui` (`reserved_for_request_id`), sehingga tidak bisa diambil ganda di menu Output maupun Request lain.
  3. `keluar`: Barang telah diserahkan ke teknisi/pelanggan/keluar gudang.
- **Kondisi Fisik (`item.kondisi`)**: `Baru`, `Baik`, `Perlu Perbaikan`, atau `Rusak`. Item berkondisi `Rusak` tetap tercatat di box namun **dikecualikan** dari hitungan stok tersedia maupun alokasi request/tiket.

### B. Siklus Request Teknisi (`request.status`)
1. `diajukan` *(atau alias legacy `menunggu`)*: Permohonan baru diajukan (baik **Ambil Satuan**, **Pilih Paket Tas**, maupun pengajuan **Kembalikan**).
2. `disetujui`: Disetujui oleh pengelola gudang/admin/developer; stok otomatis direservasi (`item.status = 'dipesan'` atau `stok_jumlah.reserved_qty`).
3. `diambil`: Barang telah diserahkan fisik (`POST /api/requests/:id/pickup`), mencatat transaksi `KELUAR` dan masuk ke daftar *"Barang di Tangan Teknisi"* (`GET /api/requests/held`).
4. `dikembalikan`: Barang telah dikembalikan dan diverifikasi pengelola gudang ke box tujuan dengan kondisi terpetakan (`Belum Terpakai` → `Baru`, `Normal` → `Baik`, `Rusak` → `Rusak`). **Wajib untuk kategori `Alat`**.
5. `selesai`: Khusus **`Barang Habis Pakai`** (misal modem/material) yang telah benar-benar terpasang pada pelanggan (`POST /api/requests/:id/complete` oleh teknisi pemilik atau pengelola gudang dengan pengisian wajib Nama/ID Pelanggan & Catatan Pemasangan; `return_condition = 'Terpakai'`).
6. `ditolak` / `dibatalkan`: Permohonan dihentikan dan seluruh reservasi stok (`dipesan` / `reserved_qty`) langsung dilepas kembali.

---

## 🌐 5. Pilihan Akses Jarak Jauh (Remote Access)

| Parameter | Opsi A: Cloudflare Tunnel (Direkomendasikan) | Opsi B: VPN Kantor (WireGuard / Tailscale) |
| :--- | :--- | :--- |
| **Kebutuhan IP Publik** | **Tidak Perlu IP Publik** (berjalan mulus di balik CGNAT ISP) | Memerlukan IP publik statis atau server relay VPN |
| **Konfigurasi Port** | **Nol Port Forwarding** di router kantor | Port VPN dibuka di firewall router kantor |
| **Keamanan Database** | MariaDB tetap terisolasi di jaringan internal container | Klien VPN berpotensi menjangkau subnet lokal bila tidak di-isolasi |
| **Sertifikat SSL/HTTPS** | Otomatis HTTPS dari Cloudflare (mendukung kamera scanner & PWA) | Memerlukan sertifikat SSL lokal / self-signed CA |
| **Kemudahan Pengguna** | Cukup buka URL domain HTTPS dari browser/HP mana saja | Wajib menginstal dan mengaktifkan aplikasi VPN sebelum login |
