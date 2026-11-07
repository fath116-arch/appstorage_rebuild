# IMPLEMENTATION_GUIDE.md — FieldOps Inventory v2

Panduan untuk agent AI. Dokumen ini memuat seluruh perubahan, perbaikan, dan fitur baru. Kerjakan **satu tahap per sesi** sesuai urutan di Bagian 9.

**File referensi yang harus dibaca lebih dulu**
- `SECURITY_GUIDE.md` — sesi, token, konfirmasi bertingkat, hapus permanen dengan masa tunggu 14 hari. Wajib diikuti penuh.
- `skema_katalog.sql` — rancangan tabel katalog (khusus MariaDB). Terjemahkan ke skema ORM, jangan dipakai langsung. Lihat Bagian 8 untuk bagian yang tidak portabel.
- `cetak_label.html` — prototipe cetak label. Perilaku dan ukurannya menjadi acuan Bagian 6.9.

## Status dan penyelarasan (baca sebelum mengerjakan apa pun)

**Status saat ini**
- Tahap 0 sampai 3 sudah dikerjakan. Tahap 4 sampai 8 belum. Verifikasi dengan **membaca kode yang ada**, jangan mengerjakan ulang tahap yang sudah jadi.
- Kontributor lain sudah mengubah bagian **keamanan** di kode. Kode yang ada saat ini adalah **sumber kebenaran** untuk keamanan. `SECURITY_GUIDE.md` adalah target, bukan perintah untuk menimpa.
- Catat perkembangan di `STATUS.md` (tahap selesai, keputusan, selisih yang ditemukan) dan perbarui di akhir tiap tahap.

**Langkah pertama, sebelum Tahap 4: audit keamanan (hanya baca, tanpa mengubah kode)**
1. Baca implementasi sesi, token, role, konfirmasi aksi, hapus permanen, dan log yang sudah ada.
2. Bandingkan dengan `SECURITY_GUIDE.md` Bagian 1 sampai 3, lalu buat tabel: *Aturan | Menurut panduan | Kondisi kode saat ini | Status (sesuai / berbeda / belum ada) | Saran*.
3. Serahkan tabel itu ke pemilik proyek dan **tunggu konfirmasi**. Hanya selisih yang disetujui yang diterapkan, di branch terpisah dengan Pull Request.
4. Bila kode yang ada lebih ketat atau sudah memenuhi tujuan aturan, pertahankan kode yang ada dan perbarui panduan, bukan sebaliknya.

**Aturan untuk Tahap 4 sampai 8**
- Tahap yang membutuhkan sesi, role, atau konfirmasi (restore, request dan persetujuan, label, notifikasi) **memakai mekanisme yang sudah ada**. Jangan membuat versi kedua, jangan mengganti nama atau merombak fungsi keamanan, dan jangan memformat ulang file di luar cakupan tahap.
- Bila sebuah tahap membutuhkan hal yang belum disediakan mekanisme keamanan yang ada (misalnya token konfirmasi tingkat 2), tambahkan secara terpisah dan minimal, lalu laporkan.
- Pemilik proyek dan kontributor lain bekerja di branch masing-masing. Jangan melakukan push langsung ke `main`.

## 0. Aturan kerja agent

1. Baca seluruh dokumen ini dan file referensi sebelum menulis kode. Bila ada yang bertentangan dengan kode yang sudah ada, **tanyakan**, jangan menebak.
2. Satu tahap per sesi. Selesaikan, jalankan test, lalu laporkan: apa yang diubah, file yang disentuh, cara mengujinya.
3. Jangan mengubah hal di luar cakupan tahap. Jangan menghapus fitur lama tanpa disebut di dokumen ini.
4. Setiap perubahan skema lewat **migrasi**. Tidak ada SQL manual yang dijalankan tanpa file migrasi.
5. Semua angka waktu, batas, dan tingkat konfirmasi dibaca dari konfigurasi, tidak ditulis di kode.
6. Tulis test untuk aturan bisnis (ID, stok, request, restore, transaksi). Operasi yang menyentuh lebih dari satu tabel memakai transaksi database.
7. **Jangan menghapus hashing password.** Login yang gagal diperbaiki dengan mencari penyebabnya (Tahap 0), bukan dengan membuang enkripsi.
8. Pakai istilah baku di Bagian 1 pada antarmuka, kode, dan database.

## 1. Istilah baku

| Istilah | Arti |
|---|---|
| **Jenis** | Golongan besar: Adaptor, Kabel, Modem/ONU. Pada label, "katalog" = Jenis. |
| **Atribut** | Kolom spesifikasi yang didefinisikan per Jenis (Tegangan, Arus, Jaringan). |
| **Produk** | Induk di katalog (Adaptor 12V): nama, Jenis, kategori `fast_moving` atau `recycle`. |
| **Tipe** | Varian produk (12V / 1A, 12V / 3A). Stok dihitung per tipe. |
| **Item** | Satu barang fisik ber-ID unik, milik satu tipe. |
| **Stok jumlah** | Stok tipe yang tidak memakai ID, dicatat per box. |
| **Box** | Lokasi penyimpanan di gudang, boleh berisi campuran produk. |
| **Transaksi** | Satu kegiatan dengan satu **ID aktivitas**, bisa memuat banyak item. |
| **Request** | Permintaan teknisi untuk mengambil atau mengembalikan barang. |
| **Arsip** | Soft delete: barang keluar, masih bisa dicari dan dipulihkan dari aplikasi. |
| **Sampah** | Hapus permanen: hilang dari aplikasi, disimpan 14 hari di server, pulih via terminal. |

## 2. Peran dan hak akses

| Kemampuan | developer | admin | admin gudang | teknisi |
|---|---|---|---|---|
| Lihat katalog, stok, riwayat, log | ya | ya | ya | ya |
| Kelola Jenis, Atribut, Produk, Tipe, Box | ya | ya | ya | tidak |
| Input stok (kamera, manual, massal) | ya | ya | ya | tidak |
| Buat request ambil atau kembali | ya | ya | ya | ya |
| Approve atau tolak request (**satu orang dari tiga role cukup**) | ya | ya | ya | tidak |
| Hapus permanen, ubah role, koreksi ID (tingkat 3) | ya | ya | tidak | tidak |

Teknisi **tidak bisa mengeluarkan barang langsung**; ia hanya membuat request. Role pemantau (misalnya pimpinan) yang sudah ada tetap hanya-baca; jangan diubah. Baris "input stok" dan "tingkat 3" adalah asumsi awal, jadikan konfigurasi hak akses sehingga mudah diubah.

## 3. Model data

Ikuti `skema_katalog.sql` untuk `jenis`, `atribut`, `atribut_opsi`, `produk`, `tipe`, `tipe_nilai`, lalu tambahkan:

| Tabel | Kolom utama |
|---|---|
| `box` | id, kode unik (`BOX-A-03`), keterangan, aktif |
| `item` | id, `kode_id` (ID item yang terbaca: SN, otomatis, atau manual; **unik di seluruh sistem**), tipe_id, box_id, status (`aktif`, `keluar`), dibuat_pada |
| `stok_jumlah` | tipe_id, box_id, jumlah (tidak boleh negatif), unik per (tipe_id, box_id) |
| `transaksi` | `id_aktivitas` (unik), aksi, pelaku_id, penyetuju_id (boleh kosong), request_id (boleh kosong), box_asal, box_tujuan, catatan, waktu |
| `transaksi_detail` | transaksi_id, tipe_id, item_id (boleh kosong), kode_id, nama_snapshot, jumlah, status_sebelum, status_sesudah |
| `request` | id, jenis (`ambil`, `kembali`), pemohon_id, status (`menunggu`, `disetujui`, `ditolak`, `dibatalkan`), diputuskan_oleh, alasan_tolak, waktu |
| `request_detail` | request_id, tipe_id, item_id (boleh kosong), jumlah |
| `sesi`, `sampah_hapus` | lihat `SECURITY_GUIDE.md` |
| `pengaturan` | kunci, nilai (tingkat konfirmasi per aksi, retensi, batas waktu) |

Tipe isian atribut hanya `angka`, `pilihan`, dan `teks` (sesuai `skema_katalog.sql`, tanpa perubahan). Fitur seperti 5G dimodelkan sebagai atribut `pilihan` (misalnya "Jaringan": 4G, 5G) yang membedakan **Tipe**, bukan atribut ya/tidak.

**Aturan umum data**
- Log (`transaksi`, `transaksi_detail`) **hanya bisa ditambah**: tidak ada update atau delete lewat aplikasi.
- `nama_snapshot` menyimpan nama saat transaksi, supaya riwayat tetap terbaca walau data berubah.
- ID aktivitas dibuat otomatis oleh server di dalam transaksi database. Format yang disarankan: `AKT-20261106-0001` (penghitung harian). Satu transaksi satu ID, bukan satu ID per item.

## 4. Aturan ID item

Aturan diatur **per tipe** (kolom `sumber_id`, `prefix_id`, `pola_id`, `id_dikunci` di tabel `tipe`):

| Sumber ID | Perilaku |
|---|---|
| `scan_sn` | Kamera membaca barcode atau QR berisi SN pabrik |
| `otomatis` | Sistem membuat ID berformat `PREFIX-000123`, lalu label QR dicetak |
| `manual` | Pengguna mengetik ID |
| `tanpa_id` | Mode jumlah, hanya angka stok |

1. Validasi format dengan `pola_id` (regex) sebelum menyimpan. Tolak bila tidak cocok.
2. `kode_id` harus unik di seluruh sistem. Bila sudah ada, tampilkan peringatan beserta statusnya ("sudah ada, aktif di BOX-A-03").
3. Setelah stok pertama masuk, `sumber_id`, `prefix_id`, dan `pola_id` **dikunci** (`id_dikunci = 1`). Perubahan hanya lewat fitur **koreksi ID**: tingkat konfirmasi 3, alasan wajib, tercatat di log.
4. Tipe baru boleh menyalin aturan ID dari tipe lain, dan dari nilai bawaan Jenis.

## 5. Atribut dan nama tipe

1. Atribut didefinisikan di **Jenis**. Tipe isian: `angka` (dengan satuan), `pilihan` (dengan opsi), `teks`. Contoh: modem 4G dan modem 5G menjadi dua Tipe di bawah satu Produk, dibedakan oleh atribut pilihan "Jaringan".
2. Di halaman buat produk, kolom tipe muncul sesuai atribut Jenis, bukan satu kolom teks kosong. Bila Jenis belum punya atribut, tampilkan tombol **"Tambah atribut"** langsung di halaman itu.
3. **Nama tipe dibentuk otomatis** dari nilai atribut yang `masuk_nama`, berurutan sesuai `urutan` (contoh: "12V / 3A / jack 5.5mm").
4. Atribut bertipe `pilihan` boleh menambah opsi baru saat mengisi tipe, supaya ejaan seragam.
5. Atribut yang sudah punya nilai tidak boleh dihapus atau diubah tipe isiannya (blokir atau minta konfirmasi tingkat 3).
6. Nilai atribut baru **otomatis muncul sebagai opsi filter**. Atribut angka mendukung rentang ("arus ≥ 2 A") dan atribut pilihan memakai daftar centang.
7. Validasi di aplikasi: atribut milik Jenis dari produk tersebut, atribut wajib terisi, dan `UNIQUE (produk_id, nama_tipe)`.

## 6. Fitur

### 6.1 Katalog dan tampilan
- Daftar produk: satu kartu per produk berisi nama, jenis, total jumlah semua tipe, dan lencana kategori.
- Klik produk: halaman detail per tipe berisi jumlah, sebaran box, dan riwayat terakhir bertambah atau berkurang (dibaca dari log, tanpa tabel terpisah).
- Klik angka stok sebuah tipe: daftar ID item beserta box dan statusnya.
- Tampilan seperti katalog toko online, agar isi gudang mudah dipantau.

### 6.2 Filter dan pencarian
- Filter: nama produk, Jenis, kategori, dan atribut tipe. Pencarian juga ada di Arsip.

### 6.3 Box
- Setiap box punya kode, keterangan, dan label QR. **Satu box boleh berisi produk campuran.**
- Scan QR box menampilkan isinya, dikelompokkan per produk lalu per tipe. Di detail produk terlihat sebaran box.
- Pindah box adalah transaksi yang tercatat.

### 6.4 Input stok
- Urutan: pilih produk, tipe, box, lalu scan atau ketik sesuai aturan ID tipe itu. Untuk mode jumlah, isi angka per box.
- **Kamera**: kamera browser hanya jalan di konteks aman. Akses dari ponsel lewat jaringan kantor **membutuhkan HTTPS** (sertifikat lokal atau reverse proxy). Pakai `BarcodeDetector` bila tersedia, dan pustaka pemindai (misalnya `@zxing/browser`) sebagai cadangan.
- **Input massal**: scan beruntun, atau isi jumlah N untuk membuat N ID otomatis sekaligus (hanya untuk sumber ID `otomatis`). Satu operasi massal = satu transaksi. Konfirmasi tingkat 2.
- Produk mode jumlah tetap tercatat di log per transaksi, tanpa ID item tetapi dengan ID aktivitas.

### 6.5 Barang keluar dan Arsip
- Barang keluar mengubah status item menjadi `keluar` (soft delete), bukan menghapus baris. Untuk mode jumlah, kurangi `stok_jumlah`.
- Arsip bisa dicari (ID, nama, tipe, tanggal, pelaku).

### 6.6 Restore
- Barang kembali: masukkan atau scan ID, sistem mencari di Arsip, menampilkan data lama, pengguna **mengonfirmasi bahwa produknya sama**, lalu item kembali `aktif` di box yang dipilih. Untuk mode jumlah, tambahkan ke `stok_jumlah`.
- Bila ID masih berstatus `aktif`, tampilkan pesan dan jangan duplikasi. Bila ID tidak ada di Arsip, tawarkan input sebagai stok baru (jika hak aksesnya ada).

### 6.7 Request teknisi dan persetujuan
- Teknisi membuat request `ambil` atau `kembali` dengan memilih produk **sampai tingkat tipe** (dan item bila ber-ID). Pemohon boleh membatalkan selama masih `menunggu`.
- **Satu persetujuan cukup** dari developer, admin, atau admin gudang. Cek status dengan `UPDATE request SET status='disetujui' WHERE id=? AND status='menunggu'` dan periksa jumlah baris yang berubah. Bila 0 baris, tampilkan "sudah diproses oleh X" dan jangan ubah stok.
- Penolakan wajib beralasan. Persetujuan membuat satu transaksi yang mencatat pemohon **dan** penyetuju, lalu mengubah status item atau stok.
- Asumsi awal: status barang berubah langsung saat disetujui, tanpa langkah serah-terima terpisah. Buat sebagai opsi konfigurasi bila nanti diperlukan.
- Request `kembali` yang disetujui memakai alur restore (6.6).

### 6.8 Log aktivitas
- Setiap aksi (tambah, ubah, keluar, kembali, pindah box, request, approve, tolak, koreksi, hapus, pulihkan, login, pencabutan sesi) membuat transaksi dan baris log.
- Tampilan log: ID aktivitas, ID barang, nama barang, status, pelaku, penyetuju, dan waktu. Filter berdasarkan tanggal, pelaku, aksi, dan barang.

### 6.9 Label dan cetak batch
Acuan: `cetak_label.html`. Terapkan di aplikasi dengan data dari database.

- **Isi label** (satu label = satu Jenis, yaitu "katalog"): header berisi logo FieldOps, nama katalog, dan ikon kotak hijau; badan berisi **dua tabel berdampingan**, masing-masing 5 baris × 3 kolom (NO, NAMA PRODUK, TIPE), jadi satu label memuat sampai **10 produk**; di kanan ada QR dengan tulisan "Scan untuk lihat detail".
- Katalog lebih dari 10 produk otomatis lanjut ke label berikutnya dengan penanda "(1/2)", "(2/2)", penomoran berlanjut, QR yang sama.
- **QR** berisi tautan ke katalog (`{BASE_URL}/katalog/{kode}`), dibuat sebagai SVG di sisi klien agar tajam. `BASE_URL` dari konfigurasi.
- **Ukuran tetap 190 × 89 mm** untuk semua mode. A4 punya 3 slot tetap (posisi atas 10, 104, 198 mm). Pilihan **1, 2, atau 3 label per lembar** = jumlah slot terisi. Ada pilihan **mulai dari slot** (berlaku di lembar pertama) untuk memakai kertas sisa.
- **Titik potong**: titik ±1 mm di sudut sel 195 × 94 mm (label + bingkai 2,5 mm). Garis potong horizontal jatuh **di tengah celah 5 mm antar label**. Titik hanya dicetak untuk slot yang terisi. Ada saklar untuk menampilkan atau menyembunyikannya.
- Cetak: `@page { size: A4; margin: 0 }`, `print-color-adjust: exact`, skala 100%. Tabel boleh menurunkan teks ke baris kedua; jangan memotongnya.
- Alur: pilih beberapa Jenis, pilih jumlah per lembar dan slot awal, pratinjau lengkap dengan titik potong, lalu cetak.
- Label per item ber-ID (QR berisi tautan katalog + ID item) dan label box (QR kode box, daftar isi) memakai template kecil terpisah, dikerjakan setelah label katalog.
- Logo FieldOps dipakai dari file aslinya (SVG), bukan dari gambar contoh.

### 6.10 Notifikasi WhatsApp (Fonnte)
- Kirim ke developer, admin, dan admin gudang saat ada request baru. Setelah salah satu memproses, request hilang dari daftar `menunggu` milik yang lain. Token API dari konfigurasi, tidak ditulis di kode, dan kegagalan kirim tidak boleh menggagalkan transaksi.

## 7. Keamanan

Ikuti `SECURITY_GUIDE.md`, dengan catatan: bila kode yang sudah ada berbeda dari ringkasan di bawah, ikuti bagian *Status dan penyelarasan* di awal dokumen. Ringkasan penerapan di fitur:
- Token sesi 900 detik dengan refresh token berotasi, idle 30 menit, batas mutlak 12 jam, satu sesi per akun (`MAX_SESI_PER_AKUN`), cookie `HttpOnly` + `Secure` + `SameSite`.
- Konfirmasi bertingkat, ditegakkan di server dengan token konfirmasi sekali pakai:
  - **Tingkat 0**: ubah catatan, pindah box satu item.
  - **Tingkat 1**: barang keluar satu item, restore.
  - **Tingkat 2** (ketik `approve`): approve atau tolak request, barang keluar massal, input stok massal.
  - **Tingkat 3** (ketik nama objek + password ulang bila login terakhir lebih dari 15 menit): hapus permanen, hapus produk, tipe, jenis, atau box, koreksi ID, ubah role, ubah aturan ID.
- Hapus permanen memindahkan snapshot ke `sampah_hapus` selama 14 hari. Pemulihan hanya lewat `npm run sampah -- --pulihkan <id>` di terminal server.

## 8. Portabilitas database

- Saat ini MariaDB, tetapi aplikasi tidak boleh terkunci padanya. Akses database hanya lewat **repository**; logika bisnis ada di **service**.
- Pakai ORM atau query builder (Prisma, Drizzle, atau Knex) dengan migrasi.
- Terjemahkan `skema_katalog.sql` ke skema ORM dan **hindari**: `ENUM` (ganti `VARCHAR` dengan daftar nilai yang dijaga aplikasi), `CHECK` yang menjumlahkan boolean (ganti dengan validasi aplikasi atau `CHECK` portabel), `ENGINE=InnoDB`, `AUTO_INCREMENT` eksplisit, `ALTER ... AFTER`, trigger, dan stored procedure. Waktu disimpan UTC.
- Sediakan ekspor data ke CSV atau JSON sebagai jalur keluar.

## 9. Tahapan kerja

> **Status:** Tahap 0 sampai 3 selesai (verifikasi saja). Tahap 4 sampai 8 belum dikerjakan. Audit keamanan di bagian *Status dan penyelarasan* dilakukan **sebelum** Tahap 4.

**Tahap 0 — Prasyarat dan perbaikan** (periksa, kerjakan bila belum)
- Diagnosa login akun demo yang gagal ("Username atau kata sandi tidak cocok"). Cari penyebab sebenarnya (data akun di mode memori, seed akun, perbandingan hash). **Pertahankan hashing password**; bila perlu perbaiki seed atau cara verifikasinya.
- Backend memakai MariaDB sungguhan (bukan mode memori), konfigurasi lewat `.env`.
- Frontend dan backend terpisah di dua direktori. Firebase sudah dihapus. Pemilih database/workspace dihapus (satu kantor, satu database).
- Pasang ORM dan alat migrasi. Siapkan HTTPS untuk akses dari ponsel (dibutuhkan kamera).
- Pelajari struktur data lama (termasuk data di localStorage), usulkan pemetaan ke Jenis, Produk, Tipe, dan Item, minta konfirmasi, lalu buat skrip impor dengan mode `--dry-run` dan laporan hasil. Jangan mengimpor sebelum disetujui.
- *Selesai bila*: login berjalan, data tersimpan permanen di MariaDB, dan migrasi bisa dijalankan dari nol.

**Tahap 1 — Fondasi**
- Sesi dan token, role dan hak akses, kerangka konfirmasi bertingkat, tabel `transaksi`, `transaksi_detail` dengan ID aktivitas otomatis, `pengaturan`, `sampah_hapus`, dan perintah terminal `sampah` beserta job pembersihan harian.
- *Selesai bila*: semua kriteria di `SECURITY_GUIDE.md` Bagian 5 lulus.

**Tahap 2 — Jenis, Atribut, Produk, Tipe**
- CRUD (hanya developer, admin, admin gudang), tipe isian atribut (angka, pilihan, teks), tombol tambah atribut di halaman buat produk, nama tipe otomatis, aturan ID per tipe beserta validasi dan penguncian.
- *Selesai bila*: membuat Adaptor 12V dengan tipe 1A dan 3A menghasilkan nama tipe otomatis dan filter atribut muncul tanpa pengaturan tambahan.

**Tahap 3 — Box, Item, Stok, Input**
- Tabel `box`, `item`, `stok_jumlah`. Input kamera, manual, otomatis, dan massal. Log tiap transaksi.
- *Selesai bila*: scan beruntun 20 SN menjadi satu transaksi, SN ganda ditolak, dan isi box terlihat lewat QR box.

**Tahap 4 — Tampilan katalog, filter, pencarian**
- Daftar produk, detail per tipe, daftar ID, riwayat dari log, filter lintas atribut.

**Tahap 5 — Arsip dan Restore**
- Barang keluar, Arsip yang bisa dicari, restore dengan konfirmasi produk sama.

**Tahap 6 — Request dan persetujuan**
- Alur teknisi, persetujuan satu dari tiga role, pencegahan proses ganda, penolakan beralasan.
- *Selesai bila*: dua penyetuju menekan approve bersamaan pada request yang sama dan hanya satu yang berhasil.

**Tahap 7 — Label dan cetak batch**
- Sesuai Bagian 6.9. Uji cetak nyata: jarak antar titik harus 195 × 94 mm pada skala 100%.

**Tahap 8 — Notifikasi, tema, audit, dokumentasi**
- Notifikasi WhatsApp (Fonnte), tema gelap dan terang berbasis design tokens, audit keamanan dan performa, dokumentasi program.

## 10. Hal yang belum diputuskan (gunakan default, jadikan konfigurasi, lalu laporkan)

| Hal | Default sementara |
|---|---|
| Serah-terima setelah approve request ambil | Status berubah langsung saat disetujui |
| Siapa boleh input stok | developer, admin, admin gudang |
| Siapa boleh aksi tingkat 3 | developer, admin |
| Jumlah sesi per akun | 1 (ponsel + komputer bisa dilonggarkan ke 2) |
| Format ID aktivitas | `AKT-YYYYMMDD-NNNN` |
| Peringatan stok menipis | Belum dikerjakan |

## 11. Definisi selesai (setiap tahap)

- [ ] Migrasi berjalan dari nol dan bisa dibatalkan.
- [ ] Test aturan bisnis lulus; operasi multi-tabel memakai transaksi.
- [ ] Tidak ada nilai waktu atau batas yang ditulis langsung di kode.
- [ ] Setiap aksi tercatat di log dengan ID aktivitas.
- [ ] Tidak ada akses database di luar repository.
- [ ] Laporan akhir tahap: perubahan, file, cara menguji, asumsi yang diambil.
