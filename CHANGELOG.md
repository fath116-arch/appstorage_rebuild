# CHANGELOG.md - Riwayat Versi & Perubahan FieldOps IT

![Version](https://img.shields.io/badge/version-v1.2.0-emerald.svg)

Semua perubahan penting dan riwayat rilis proyek **FieldOps IT** dicatat secara kronologis dalam file ini.

## 🚀 [v1.2.6] - Perbaikan Cetak Label Presisi A4 (Eliminasi Lembar Kosong Berlebih) - 2026-11-08
- **Eliminasi Bug Halaman A4 Berlebih**: Memperbaiki bug di mana pencetakan 1 atau 2 label menghasilkan 2 lembar cetak A4 alih-alih 1 lembar.
- **Standarisasi Dimensi Lembar**: Lembar cetak (`.print-sheet`) dikunci pada ukuran presisi A4 `210mm × 296mm` (disisakan margin toleransi 1mm dari 297mm dengan `box-sizing: border-box` dan `overflow: hidden`) guna mencegah browser Chromium/Edge meluapkan halaman ke lembar ekstra.
- **Implementasi Slot Kosong (`.label-slot-empty`)**: Menyediakan elemen penampung slot kosong berdimensi tetap (`190mm × 89mm`) dengan `visibility: hidden` pada lembar yang tidak terisi penuh (layout 1 atau 2 label), menjamin stabilitas DOM dan layouting cetak.
- **Titik Petunjuk Potong Presisi**: Posisi titik potong (celah 195 × 94 mm) dihitung dari ukuran label tetap dan jarak celah antar label (bukan dari jumlah label terisi), dengan nilai Y maksimum 289.5 mm yang berada di dalam area batas 296 mm.
- **Isolasi `@media print` & Normalisasi `@page`**: Memperbaiki konflik `@page` margin di `frontend/src/index.css` menjadi `margin: 0` dan mengisolasi modal wrapper serta elemen latar belakang agar tidak tercetak.
- **Sinkronisasi Dokumen Referensi**: Menjadikan `FIX_PRINT_LABEL.md` dan `docs/v1.2.0/cetak_label.html` sebagai dokumen acuan resmi implementasi cetak label presisi.

---

## 🚀 [v1.2.5] - Paket 7: Branding Logo Baru & Kotak Logo Top Navigation - 2026-11-08
- **Model Baru Top Navigation (Sisi Kiri)**: Menggantikan logo kecil lama dengan satu blok klik terpadu yang memuat **[Kotak Logo] + Teks "FieldOps IT" (Tebal) + Ikon Panah Dropdown Chevron Abu-abu**.
- **Desain Kotak Logo**: Persegi bersudut membulat (`rounded-xl`) dengan latar terang (`bg-white` / `dark:bg-slate-100`) berborder halus sehingga logo kubus terlihat jernih dan kontras di mode tema terang maupun tema gelap.
- **Responsif Layar Sempit (HP)**: Teks "FieldOps IT" disembunyikan secara otomatis di layar kecil (`hidden sm:inline-block`), sedangkan kotak logo dan panah chevron tetap tampil presisi.
- **Konsistensi Branding di Seluruh Aplikasi**:
  - Favicon dan shortcut icon di `frontend/index.html` menggunakan `/logo.png`.
  - Apple Touch Icon (`/apple-touch-icon.png`, 180x180 px) dengan latar solid.
  - PWA Icons (`pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`) dengan latar solid non-transparan dan ukuran sangat efisien (~162 KB total, jauh di bawah batas cache PWA 5 MB).
  - Halaman Login (`LoginScreen.tsx`) dengan kotak logo hero berlatar terang.
  - Modal Manajemen Akun/Peran (`UserRoleSwitcher.tsx`) dengan kotak logo berlatar terang.
  - Template Cetak Laporan Resmi A4 (`PrintReportModal.tsx`) menggunakan `/logo.webp` pada Kop Surat resmi.
  - Template Cetak Label QR A4 190x89 mm (`BatchLabelPrintModal.tsx`) menggunakan `/logo.png` pada header kartu.
  - Footer aplikasi (`App.tsx`) dengan kotak logo dan teks tebal "FieldOps IT".
- **Pengujian Otomatis**: Lulus 6/6 pengujian di `backend/src/tests/v125Paket7Branding.test.ts`.

---

## 🚀 [v1.2.5] - Paket 6: WA Alert Otomatis (Fonnte) & Ambang Berjenjang 15 Menit - 2026-11-08
- **Akses Role & Proteksi Read-Only**: Menu WA Alert di modal Tools dapat diakses oleh seluruh peran (`developer`, `admin`, `warehouse_admin`, `technician`). Peran teknisi dilindungi secara ketat dengan status *read-only* (hanya melihat riwayat log); pengubahan konfigurasi, pengubahan ambang, dan pengiriman alert ditolak dengan status HTTP 403 Forbidden di backend.
- **3 Jenis Pesan Otomatis (Tanpa Teks Bebas)**: Peringatan Stok Habis (0 unit), Stok Menipis (stok $\le$ ambang menipis), dan Peringatan Dini (khusus produk/tipe di daftar pantauan/watchlist dengan stok $\le$ ambang dini).
- **Pengecualian Stok Rusak**: Item fisik berkondisi `Rusak` tidak dihitung sebagai stok yang tersedia dalam seluruh proses evaluasi ambang batas alert.
- **Ambang Berjenjang (*Hierarchical Thresholds*)**: Resolusi ambang otomatis dengan prioritas bertingkat: **tipe > produk > global**. Antarmuka dan API menampilkan nilai ambang berlaku secara transparan beserta label asal sumbernya (`dari tipe`, `dari produk`, `dari global`).
- **Daftar Pantauan (*Watchlist*)**: Pengguna dapat menambahkan tipe atau produk ke dalam daftar pantauan khusus dengan ambang batas dini masing-masing.
- **Batas Jeda 15 Menit di Backend & Penggabungan Konsolidasi**: Jeda pengiriman (*cooldown*) minimal 1 menit, default 15 menit, dan dilarang disetel 0 menit. Peringatan yang terjadi dalam rentang jeda ditahan di antrean dan dikonsolidasi menjadi satu pesan ringkasan lengkap. Tombol pesan uji (*test message*) juga mematuhi jeda 15 menit.
- **Anti-Duplikat Berbasis Status**: Barang dengan status alert yang sama tidak dikirimkan berulang kali; status direset saat stok naik di atas ambang batas (`NORMAL`).
- **Sanitasi & Deduplikasi Penerima**: Mendukung grup WhatsApp (`...-group` atau `...@g.us`) dan nomor telepon individual; nomor duplikat otomatis dibersihkan sehingga hanya dikirim satu kali.
- **Ekstensibilitas Estimasi Sisa Hari**: Metode penentuan estimasi hari sisa pakai (`estimateDaysRemaining`) dirancang ekstensibel tanpa mengubah skema tabel.
- **Pengujian Otomatis**: Lulus 13/13 pengujian di `backend/src/tests/v125Paket6WaAlert.test.ts`.

---

## 🚀 [v1.2.5] - Paket 5: Kamera dan Laporan Cetak - 2026-11-08
- **Input Stok via Kamera di Menu Keluar/Masuk (`StockInOutModal.tsx`)**: Integrasi pemindai kamera barcode/QR (memanfaatkan kembali aliran kamera `navigator.mediaDevices.getUserMedia` dan video targeting overlay) pada modal Barang Masuk (IN) dan Barang Keluar (OUT).
- **Penanganan Scan Presisi**: Pemindaian otomatis mendeteksi kode SKU, Barcode, atau ID fisik. Kode valid memvalidasi ketersediaan stok fisik dan mengisi form secara instan; kode tidak valid atau barang tidak ditemukan ditolak dengan notifikasi kesalahan yang jelas.
- **Validasi Transaksi Keluar**: Transaksi keluar (OUT) menolak pemrosesan jika barang kosong (0 unit) atau kuantitas melebihi stok yang tersedia.
- **Template Cetak Laporan Formal Presisi (`PrintReportModal.tsx`)**: Template cetak dokumen A4 resmi berstandar korporat dengan Kop Surat resmi PT. Solusi Informatika Lapangan, logo institusi, judul audit, periode laporan, tanggal & waktu cetak, nama pencetak (*printed by*), tabel data mutasi dengan header berulang di tiap halaman (`thead { display: table-header-group; }`), serta lembar tanda tangan pengesahan (Admin Logistik, Teknisi Lapangan, Supervisor IT).
- **Isolasi Cetak Kertas**: Konfigurasi `@page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }` dan aturan `@media print` yang secara ketat menyembunyikan navbar, footer, sidebar, filter toolbar, dan tombol interaktif (`.no-print { display: none !important; }`).
- **Pengujian Otomatis**: Lulus 15/15 pengujian di `backend/src/tests/v125Paket5CameraPrint.test.ts`.

---

## 🚀 [v1.2.5] - Paket 4: Katalog dan Produk (Storage Box, Tipe Stok, Kategori Barang, Kondisi Item) - 2026-11-07
- **Daftar Storage Box**: Submenu/tab view terintegrasi di Katalog untuk melihat daftar semua box dan rincian isinya (produk, tipe, jumlah, kondisi). Satu box mendukung penyimpanan campuran berbagai suku cadang.
- **Tipe Satuan Stok**: Input manual dengan tag saran interaktif (*clickable suggestions*) dari nilai yang pernah digunakan (misal: `unit`, `roll`, `meter`, `pcs`, `box`, `set`) untuk konsistensi penulisan data.
- **Kategori Barang**: Pembeda jenis produk `Alat` (toolkit / equipment) vs `Barang Habis Pakai` di form produk dan filter toolbar katalog.
- **Kondisi Item**: Pelacakan kondisi item fisik (`Baru`, `Baik`, `Perlu Perbaikan`, `Rusak`) beserta catatan kondisi. Item berkondisi `Rusak` tidak dihitung sebagai stok tersedia dan dicegah secara atomik saat permohonan (*request*) teknisi.
- **Pengujian Otomatis**: Lulus 13/13 pengujian di `backend/src/tests/v125Paket4Catalog.test.ts`.

---

## 🚀 [v1.2.0] - 2026-11-06 (Rilis Final Versi 1.2.0 Lengkap)

### 📦 Pembaruan Tahap 4 s/d 8 (Tuntas & Terverifikasi 100%)
- **Tahap 4 (Antarmuka Katalog Toko Online)**:
  - Tampilan kartu produk ala online shop dengan indikator total stok segala tipe, detail sebaran box penyimpanan, riwayat mutasi dari audit log, dan modal Rincian ID Fisik.
  - Lulus 14/14 pengujian otomatis (`tahap4CatalogView.test.ts`).
- **Tahap 5 (Barang Keluar, Arsip, & Restore)**:
  - Soft delete barang keluar (`status = 'keluar'`) tunggal maupun massal (Tier 2 `approve`).
  - Halaman dan filter pencarian Arsip lengkap.
  - Pemulihan (restore) barang dari Arsip ke Box pilihan dengan validasi kesesuaian produk (`confirm_product_matched`) dan pencegahan duplikasi ID yang sedang aktif.
  - Lulus 15/15 pengujian otomatis (`tahap5ArchiveRestore.test.ts`).
- **Tahap 6 (Alur Request Teknisi & Persetujuan Cepat Atomik)**:
  - Skema tabel `request` (`07_v2_request_schema.sql`).
  - Persetujuan cepat: 1 approval cukup dari 3 peran (`developer`, `admin`, `warehouse_admin`).
  - Proteksi *race condition* / double approval atomik (`UPDATE request SET status = 'disetujui' WHERE id = ? AND status = 'menunggu'`).
  - Pengurangan stok otomatis (*auto-deduct*) dan pencatatan transaksi mutasi `AKT-YYYYMMDD-NNNN`.
  - Lulus 11/11 pengujian otomatis (`tahap6Requests.test.ts`).
- **Tahap 7 (Label Batch & Cetak A4 Presisi)**:
  - Modul cetak presisi `BatchLabelPrintModal.tsx` dan endpoint `/api/catalog/labels`.
  - Dimensi kartu label tetap **190 × 89 mm**, 2 tabel 5×3 (maks. 10 produk per kartu).
  - Titik potong celah presisi **195 × 94 mm** di celah 5 mm antar label.
  - Generator vektor SVG QR Code tajam resolusi tinggi (bebas blur).
  - Pilihan slot 1-3 dan 1-3 label per lembar A4 untuk efisiensi kertas sisa.
  - Lulus 8/8 pengujian otomatis (`tahap7Labels.test.ts`).
- **Tahap 8 (Notifikasi Fonnte, Audit Keamanan & Dokumentasi)**:
  - Service `NotificationService.ts` untuk pengiriman otomatis alert WhatsApp Fonnte saat request barang dibuat.
  - Pengiriman asinkron dan terisolasi tanpa memblokir transaksi database.
  - Sistem tema gelap/terang berbasis token CSS (`--color-*`) dengan disiplin zero-pill border.
  - Dokumentasi sistem lengkap di `docs/v1.2.0/PANDUAN_SISTEM_V1.2.0.md` dan `docs/STATUS.md`.
  - Total pengujian otomatis seluruh tahap: **97/97 tes (100% LULUS)**.

---

## 🌟 [v1.2.0-tahap3] - 2026-11-06 (Box, Item Fisik Ber-ID, Stok Jumlah & Input Kamera)

### 📦 Manajemen Box Storage & Pemindaian Stok (Single & Bulk)
- **Skema Fisik Box & Item (`06_v2_stock_schema.sql`)**: 3 tabel relasional (`box`, `item`, `stok_jumlah`) mendukung lokasi box campuran, pencatatan item fisik ber-ID unik, dan stok jumlah bulk.
- **Pemindaian Kamera & Scan Beruntun**: Komponen `StockInputModal.tsx` dengan pengintegrasian kamera browser/scanner, pemindaian SN beruntun, serta validasi pola regex (`pola_id`) dan pencegahan ID duplikat secara real-time.
- **Transaksi Massal N Unit 1 Activity ID**: Seluruh pemrosesan batch N unit (misal 20 SN sekaligus) dicatat sebagai **1 transaksi tunggal** dengan ID aktivitas `AKT-YYYYMMDD-NNNN` dan detail baris per unit.
- **Penguncian Aturan ID Automatis**: Memasukkan stok fisik pertama kali secara otomatis mengubah `id_dikunci = 1` pada tipe varian terkait untuk menjamin konsistensi format.
- **Relokasi Antar Box (`pindah_box`)**: Fitur pemindahan item atau stok jumlah antar box dengan dialog `BoxContentModal.tsx` yang mencatat riwayat transaksi `pindah_box`.
- **Pengujian Otomatis (`tahap3Stock.test.ts`)**: 17/17 pengujian lulus 100% mencakup pembuatan box, validasi regex, penolakan SN duplikat, batch 20 SN 1 activity ID, stok jumlah, kueri isi box terstruktur, dan relokasi item antar box.

---

## 🌟 [v1.2.0-tahap2] - 2026-11-06 (Katalog Bertingkat: Jenis, Atribut, Produk & Tipe)

### 🏷️ Hierarki Katalog Dinamis (Jenis, Atribut, Produk, dan Tipe)
- **Skema Relasional Terstruktur (`05_v2_catalog_schema.sql`)**: 6 tabel relasional (`jenis`, `atribut`, `atribut_opsi`, `produk`, `tipe`, `tipe_nilai`) dengan relasi foreign key dan cascade constraint.
- **Pembentukan Nama Tipe Otomatis (`generateTipeName`)**: Nama varian tipe dibentuk secara otomatis dari atribut yang memiliki penanda `masuk_nama = 1` berurutan berdasarkan kolom `urutan` (contoh: `"12V / 1A"`, `"12V / 3A / Jack 5.5mm"`, `"Cat6 / 305m"`).
- **Aturan ID per Tipe**: Konfigurasi per varian (`scan_sn`, `otomatis`, `manual`, `tanpa_id`), format `prefix_id`, validasi regex `pola_id`, dan penguncian `id_dikunci` setelah stok pertama masuk.
- **Tombol Tambah Atribut Inline di Modal Produk**: Di halaman pembuatan produk, jika Jenis yang dipilih belum memiliki atribut, sistem langsung menampilkan tombol `+ Tambah Atribut untuk Jenis Ini` di dalam modal tanpa perlu berpindah layar.
- **Filter Spesifikasi Dinamis**: Filter katalog secara dinamis menghasilkan pilihan dropdown/checkbox untuk atribut `pilihan` dan input rentang angka untuk atribut `angka` (contoh: "Arus ≥ 2A").
- **Pengujian Otomatis (`tahap2Catalog.test.ts`)**: 13/13 pengujian lulus 100% mencakup pembuatan jenis, relasi atribut, auto-naming tipe, penolakan nama duplikat, validasi atribut wajib, penambahan opsi baru dinamis, dan koreksi aturan ID.

---

## 🔒 [v1.2.0-tahap1] - 2026-11-06 (Fondasi Keamanan, Sesi Server & Sampah 14 Hari)

### 🛡️ Sesi Server & Konfirmasi Bertingkat
- **Server-Authoritative Sessions (`sesi`)**: Access token 15 menit, refresh token berotasi, deteksi anti-replay reuse token, dan batas kuota sesi tunggal per akun (`MAX_SESI_PER_AKUN = 1`).
- **Konfirmasi Bertingkat (Tier 0-3)**: Penegakan verifikasi server dengan token sekali pakai (TTL 120s), proteksi penghapusan tingkat 3 (wajib ketik nama objek + verifikasi password).
- **Log Aktivitas Append-Only (`transaksi`)**: Format ID Aktivitas harian `AKT-YYYYMMDD-NNNN` untuk setiap mutasi dan aksi administratif.
- **Sampah Hapus Permanen 14 Hari (`sampah_hapus`)**: Penyimpanan snapshot data sebelum pemusnahan mutlak, dilengkapi CLI pemulihan `npm run sampah -- --list / --pulihkan <id> [--dry-run]`.
- **Pengujian Otomatis (`tahap1Foundation.test.ts`)**: 19/19 pengujian lulus 100%.

---

## 🌟 [v1.1.0] - 2026-11-05 (Soft Delete Recycle Bin, Production Auth & Demo Removal)

### 🗑️ Modul Antarmuka Kotak Sampah (Soft Delete Recycle Bin & Restore)
- **Komponen `TrashModal.tsx`**: Antarmuka visual khusus untuk mengelola barang inventori yang dihapus sementara (*soft-deleted*).
- **Pemulihan Barang (1-Click Restore)**: Admin dan Supervisor dapat memulihkan barang kembali ke katalog aktif kapan saja tanpa merusak nomor SKU, riwayat mutasi masuk/keluar, maupun audit trail transaksi.
- **Pemusnahan Permanen (Hard Delete)**: Opsi penghapusan permanen dari database MariaDB dengan dialog konfirmasi keamanan via endpoint `DELETE /api/inventory/items/:id/permanent`.
- **Integrasi Tombol Katalog**: Tombol "Kotak Sampah" lengkap dengan indikator badge jumlah item yang berada di tempat sampah pada toolbar katalog inventori.

### 🔐 Penyempurnaan Autentikasi Internal & Penghapusan Akun Demo
- **Penghapusan Fitur Akun Demo**: Tombol pembantu preset demo pada layar login (`LoginScreen.tsx`) telah dihapus total guna kesiapan sistem produksi riil.
- **Otentikasi Internal Fleksibel**: Mesin verifikasi kata sandi (`authService.ts`) mendukung format kata sandi langsung (*plain-text*) maupun *hash PBKDF2* (100.000 iterasi). Staf IT dapat membuat akun via skrip `npm run setup:admin`, API endpoint `POST /api/auth/users`, atau query SQL manual di database MariaDB tanpa risiko terkunci.
- **Pencarian Username Bebas Sensitivitas Karakter**: Mendukung login dengan toleransi huruf besar/kecil (`case-insensitive`) dan pembersihan spasi otomatis.

---

## 🚀 [v1.0.0-rebuild] - 2026-11-03 (Full On-Premise Rebuild & MariaDB Migration)

### 🏗️ Rebuild Total Arsitektur On-Premise Single-Office
- **Penghapusan Total Firebase**: Menghapus 100% Firebase Authentication, Firestore SDK, `firestore.rules`, `firebase-blueprint.json`, dan `firebase-applet-config.json`. Seluruh aplikasi berjalan mandiri di server lokal.
- **Penghapusan Konsep Multi-Tenant & Workspace**: Menghapus selector workspace, kolom `workspace_id`, dan tipe `DatabaseWorkspace`. Aplikasi dikonsolidasi untuk 1 kantor/kantor cabang ISP tunggal.
- **Database MariaDB 11.x & Pemisahan 2 File Data**: Mengadopsi MariaDB 11.x via Express 5 & TypeScript dengan struktur skema terisolasi 100% antara data autentikasi (`01_auth_schema.sql` / `auth_seed.json`) dan data bisnis inventaris (`02_inventory_schema.sql` / `items_seed.json`).
- **Autentikasi Server-Authoritative & Sesi Cookie**: Otentikasi berbasis HTTP-only session cookie dengan algoritma PBKDF2 SHA-256 (100.000 iterasi + 16-byte random salt). Perlindungan brute-force rate-limiting dan verifikasi peran server-side pada setiap REST endpoint.
- **Konsolidasi WhatsApp Gateway (Fonnte)**: Menyatukan modul notifikasi WhatsApp ke dalam `backend/src/integrations/whatsapp/` (`provider.ts`, `fonnte.ts`, `templates.ts`) dan `backend/src/routes/whatsapp.ts`. Menghapus duplikasi kode legacy pada `server/whatsapp-gateway.js`.
- **Integrasi REST API Auto-Deduct Tiket Lapangan**: Endpoint `/api/tickets/consume` dengan enkripsi Bearer token untuk auto-deduct stok dari Jira, Zendesk, GLPI, atau aplikasi mobile teknisi.
- **Layanan Backup & Pemulihan Tanpa Kebocoran Kredensial**: `backupService.ts` menghasilkan ekspor JSON murni data bisnis (barang & transaksi) tanpa menyertakan kredensial atau hash akun pengguna (`Zero Account Leakage`).
- **Sanitasi Ekspor Data (CWE-1236)**: Mempertahankan fungsi `sanitizeFormulaInput()` pada ekspor CSV, Excel, dan PDF untuk mencegah serangan formula injection.
- **Dukungan Akses Jarak Jauh Cloudflare Tunnel**: Konfigurasi `docker-compose.yml` dan dokumen `docs/DEPLOY.md` untuk akses HTTPS jarak jauh aman melalui Cloudflare Tunnel tanpa membuka port MariaDB ke internet publik.

---

## 🔒 [v0.3.1] - 2026-10-30 (Security Remediation Release)

### 🛡️ Remidiasi Menyeluruh Temuan Audit Keamanan (SEC-01 s/d SEC-05)
- **`[SEC-01]` Pengerasan Aturan Firestore**: Mengganti aturan terbuka publik `allow read, write: if true;` dengan aturan autentikasi wajib `isSignedIn()` (`request.auth != null`) serta validasi panjang `isValidId()` untuk seluruh koleksi `workspaces/{workspaceId}/**`. Mengisolasi tes koneksi diagnostik pada `/test/{docId}`. Aturan berhasil dideploy ke Firebase.
- **`[SEC-02]` Enforce RBAC Otoritas Server-Side**: Menambahkan endpoint backend `POST /api/security/verify-action` untuk memverifikasi tindakan administratif destruktif (seperti pengosongan dan reset database) dengan validasi kredensial server dan role supervisor/admin.
- **`[SEC-03]` Penutupan Celah Bypass WA Gateway**: Menghilangkan celah bypass otentikasi saat environment variable kosong. Middleware `authenticateWaProxy` pada `server.ts` dan `server/whatsapp-gateway.js` kini mewajibkan `X-App-Secret-Key` atau `Bearer Token` valid secara *fail-closed*.
- **`[SEC-04]` Mitigasi Dependensi & Verifikasi Runtime**: Memverifikasi runtime isolasi paket, lolos build TypeScript tanpa galat, dan memitigasi celah dependensi.
- **`[SEC-05]` Pemasangan HTTP Security Headers**: Menambahkan middleware HTTP security headers standar industri pada `server.ts` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy`).
- **Pembaruan Runtime ke Node.js 26 LTS (Masa Dukungan hingga 2029)**: Mengonfigurasi dukungan runtime Node.js 26 LTS dengan dukungan aktif jangka panjang hingga 2029, memperbarui `@types/node` ke versi `^26.6.6`, dan memutakhirkan endpoint `/api/health` dengan informasi detail runtime Node.js 26.
- **Penerapan Desain Glassmorphism (Variation 5)**: Mengintegrasikan desain modern *frosted glassmorphism* (`.glass` dengan backdrop-filter blur 14px), tipografi `Inter` untuk display/sans dan `Space Mono` untuk metrik & kode, hero banner analitik dengan kontrol rentang tanggal 7/14/30 hari, kartu KPI individual beraksen emerald & amber, penataan grafik tren Recharts, serta quiet glass footer `v0.3.1`.
- **Dashboard Modal Audit (`SecurityReportModal.tsx`)**: Memperbarui status seluruh temuan audit SEC-01 s/d SEC-05 menjadi teratasi (*100% Resolved*) dengan badge `v0.3.1 (Security Patched)`.

---

## 🚀 [v0.3.0] - 2026-10-30

### 🛡️ Implementasi Sistem Pelaporan Keamanan & Audit Interaktif
- **Komponen Dashboard Keamanan Baru (`SecurityReportModal.tsx`)**: Pembuatan modal visual interaktif yang merangkum hasil temuan dari `AUDIT_REPORT.md` untuk diakses khusus oleh Admin & Supervisor.
- **Kartu Temuan & Filter Kategori**: Penataan kartu temuan `SEC-01` s/d `SEC-05` dan kontrol positif dengan filter keparahan (*Critical, High, Medium, Positif*), tag lokasi file:line, deskripsi risiko, dan contoh solusi kode.
- **Pelacak Remidiasi & Task Progress**: Fitur *checklist* tugas perbaikan yang tersimpan secara otomatis di `localStorage` untuk memantau persentase penyelesaian remidiasi secara real-time.
- **Analisis Ukuran Bundle & Performa**: Tab analisis *chunk size* (1.67 MB) dengan rekomendasi optimasi *lazy loading* dan *code splitting*.
- **Integrasi Tombol Navigasi Admin**: Penambahan tombol "Audit System" di header utama dan menu dropdown aplikasi (`Navbar.tsx`).

### 🛡️ Penyelesaian Audit Keamanan & Performa System (`AUDIT_REPORT.md`)
- **Pelaksanaan Audit 5-Fase**: Penyelesaian audit menyeluruh mencakup Inventaris Teknologi (Fase 1), Audit Keamanan & Privasi (Fase 2), Performa & Efisiensi Resource (Fase 3), Kualitas Kode & Offline Sync (Fase 4), serta Peta Jalan Remidiasi (Fase 5).
- **Identifikasi Temuan Kritis**: Evaluasi aturan Firestore terbuka (`SEC-01`), client-side RBAC enforcement (`SEC-02`), bypass otorisasi WA gateway (`SEC-03`), kerentanan `npm audit` (`SEC-04`), dan HTTP security headers (`SEC-05`).
- **Pencatatan Kontrol Keamanan Positif**: Penegasan standar hashing PBKDF2 (100k SHA-256 iterations) dan sanitasi ekspor formula Excel/CSV (**CWE-1236**).

### 📄 Pembuatan Dokumentasi Teknis Komprehensif (`DOCUMENTATION.md`)
- **Penerbitan DOCUMENTATION.md**: Penyusunan file panduan teknis utama di root folder yang mencakup:
  - **Setup Lingkungan**: Tabel konfigurasi `.env`, prasyarat Node.js/Bun, serta perintah instalasi dan kompilasi produksi.
  - **Arsitektur Modul**: Diagram sistem ASCII, penjelasan `InventoryContext` (*Optimistic UI & Offline Queue*), `AuthContext` (*PBKDF2 & RBAC*), `ThemeContext`, dan Express WA Gateway Proxy.
  - **Panduan Fitur API**: Endpoint Express Proxy `/api/whatsapp/send`, header otorisasi `X-App-Secret-Key`, perintah cURL, serta contoh payload JSON lengkap untuk respons `200 OK`, `401 Unauthorized`, `400 Bad Request`, dan `500 Error`.
  - **Prosedur Pemeliharaan**: Prosedur backup/restore harian Firestore, kliring cache PWA/localStorage, dan tabel *troubleshooting*.

### ⚙️ Optimasi Bundler & PWA Cache
- **Peningkatan Batas Workbox Cache**: Pembaruan konfigurasi `maximumFileSizeToCacheInBytes` (5 MB) pada `vite.config.ts` untuk memastikan kelancaran kompilasi Service Worker PWA saat build.

---

## 📦 [v0.2.9] - 2026-10-30

### 🎨 Pembaruan Antarmuka & Tema (UI/UX Refinements)
- **Perbaikan Garis Pemisah Tema Gelap**: Menghapus garis pemisah putih tajam pada kelompok menu sidebar tema gelap dan menggantinya dengan border subtle `dark:border-slate-800/60`.
- **Tema Gelap Profil Pengguna**: Menyelaraskan komponen profil pengguna di header dengan tema gelap (`dark:bg-slate-800/80` & `dark:text-slate-200`), menghilangkan efek "pill putih" menyilaukan.
- **Optimasi Viewport Seluler**: Memperbaiki padding modal dan keterbacaan menu navigasi pada layar ponsel.

### 📖 Dokumentasi Suite
- Penerbitan suite dokumentasi awal pada direktori `docs/` (`ARSITEKTUR.md`, `DATA.md`, `PERAN_DAN_AKSES.md`, `PANDUAN_PENGGUNA.md`, `DEPLOY_DAN_OPERASIONAL.md`, `TEMA_DAN_DESAIN.md`, `CHANGELOG.md`).

---

## 📦 [v0.2.4] - 2026-10-25
- Penambahan mode tampilan Gelap / Terang / Sistem via `ThemeContext`.
- Integrasi PWA Service Worker untuk dukungan penggunaan offline.
- Peningkatan batas alert stok minimum pada katalog barang.

---

## 📦 [v0.1.0] - 2026-10-10
- Peluncuran versi perdana aplikasi FieldOps IT.
- Katalog Inventaris, Pencatatan Mutasi Barang Masuk/Keluar.
- Checklist Tas Lapangan Teknisi.
