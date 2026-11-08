# IMPLEMENTATION_GUIDE: Perbaikan dan Fitur Baru FieldOps (8 Nov 2026)

Dokumen ini untuk agent AI (Google AI Studio, Build mode). Berisi 7 paket kerja, matriks hak akses, perubahan data, urutan pengerjaan, dan checklist uji.

## 0. Aturan umum untuk agent

1. Kerjakan **satu paket per sesi**, berurutan sesuai bagian 5. Jangan mengubah hal di luar cakupan paket.
2. Sebelum mengubah skema database, **jelaskan dulu perubahannya** (tabel, kolom, migrasi, nilai default untuk data lama), lalu terapkan.
3. Semua pembatasan hak akses **wajib di backend (middleware per endpoint)**. Menyembunyikan menu di frontend hanya tambahan.
4. Tambahkan test untuk logika yang diubah. Data riil sudah ada, jadi migrasi harus aman dan tidak menghapus data lama.
5. Jangan menghapus fitur yang sudah ada (katalog, label QR, log aktivitas, soft delete, request teknisi, stok via kamera) kecuali diminta di dokumen ini.
6. Setelah selesai, tuliskan ringkasan: file yang diubah, perubahan skema, dan cara mengujinya.
7. Pertahankan hasil audit keamanan yang sudah ada (PBKDF2 100.000 iterasi SHA-256 dan sejenisnya) kecuali diminta lain.
8. Jika bekerja berdua: satu paket satu branch, gabungkan berurutan.
9. **Progres dan status:** proyek ini sudah punya file progres dan status di folder dokumentasi. Temukan file itu, **ikuti format yang sudah dipakai**, dan jangan membuat file pelacak baru. Setelah menyelesaikan satu paket, perbarui file tersebut: status paket, branch, tanggal, dan catatan singkat (file yang diubah, perubahan skema, hal yang belum selesai). Jangan menandai paket selesai sebelum semua test paket itu (bagian 6) lolos; lampirkan hasil test di catatan.

## 1. Ringkasan keputusan

- Role: **developer, admin, admin gudang, teknisi**.
- Teknisi di Katalog: boleh melihat dan membuka isi storage box, tetapi **read-only**.
- Menu **Tools** tampil untuk semua role; item di dalamnya mengikuti role.
- "Pilihan alat" di form produk = field **Kategori Barang** (Alat / Barang Habis Pakai), hanya pembeda jenis.
- WA Alert terbuka untuk semua role (lihat riwayat); isi pesan otomatis (menipis, habis, peringatan dini), dibatasi 15 menit, trigger bisa diatur.
- Ekspor Excel, Cetak Label, dan Akses HP boleh untuk semua role. Database dan Audit tidak untuk teknisi dan admin gudang.
- Logo diganti ke ikon kubus baru, model logo top navigation dikembalikan ke kotak logo + teks + dropdown.

## 2. Matriks hak akses final

### Katalog

| Aksi | Developer | Admin | Admin Gudang | Teknisi |
|---|---|---|---|---|
| Lihat katalog dan buka isi storage box | Ya | Ya | Ya | Ya |
| Buat produk | Ya | Ya | Ya | Tidak |
| Buat dan kelola storage box | Ya | Ya | Ya | Tidak |
| Kelola jenis atribut | Ya | Ya | Ya | Tidak |
| Ubah apa pun di Katalog | Ya | Ya | Ya | Tidak (read-only) |

### Setting API
Hanya **developer dan admin**. Admin gudang dan teknisi ditolak (403).

### Menu Tools

| Item | Developer | Admin | Admin Gudang | Teknisi |
|---|---|---|---|---|
| Database | Ya | Ya | Tidak | Tidak |
| Audit | Ya | Ya | Tidak | Tidak |
| WA Alert (lihat riwayat) | Ya | Ya | Ya | Ya |
| WA Alert (ubah pengaturan) | Ya | Ya | Ya | Tidak |
| Akses HP | Ya | Ya | Ya | Ya |
| Ekspor Excel | Ya | Ya | Ya | Ya |
| Cetak Label | Ya | Ya | Ya | Ya |

Catatan: hasil Ekspor Excel hanya boleh berisi data yang memang boleh dilihat role pemintanya (tanpa data akun, pengaturan API, atau data menu terbatas). Cek di backend saat file dibuat.

## 3. Paket kerja

### Paket 1: Hak akses
**Cakupan:** Setting API, Katalog untuk admin gudang dan teknisi.

Tugas:
- Audit permission yang ada (frontend dan backend), tampilkan tabel role x aksi sebelum dan sesudah.
- Terapkan matriks bagian 2 lewat middleware backend. Pusatkan definisi permission di satu tempat agar mudah diaudit.
- Perbaiki admin gudang yang hanya bisa membuka menu Katalog tetapi tidak bisa menjalankan fitur (buat produk, storage box, kelola jenis atribut) maupun melihat isinya.
- Teknisi: semua endpoint tulis Katalog ditolak (403), endpoint baca dan buka isi box diizinkan.

Selesai kalau: tiap role diuji terhadap tiap aksi di matriks, endpoint tulis ditolak untuk teknisi, Setting API ditolak untuk admin gudang dan teknisi.

### Paket 2: Perbaikan bug
**Cakupan:** keluar/masuk stok dan ekspor Excel.

Tugas:
1. **Keluar/masuk:** semua transaksi tercatat sebagai keluar walau yang dijalankan masuk. Telusuri alur form, payload, backend, lalu log aktivitas. Jelaskan akar masalahnya, perbaiki, dan tambahkan test untuk transaksi masuk dan keluar.
2. **Ekspor Excel:** file hasil ekspor tidak bisa dibuka. Hasilkan `.xlsx` valid dengan library yang tepat, kirim sebagai blob dengan `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, dan verifikasi file terbuka di Excel.

Selesai kalau: transaksi masuk menambah stok dan tercatat sebagai masuk di log; file Excel terbuka normal dan datanya benar.

### Paket 3: Menu Tools
**Bergantung pada:** Paket 1 dan 2.

Tugas:
- Buat menu **Tools** di navbar untuk semua role.
- Pindahkan tombol **Database, Akses HP, WA Alert, Audit, Ekspor Excel** dari header ke Tools, lalu hapus tombol lamanya dari header.
- Tambahkan quick access **Cetak Label** di Tools.
- Item tampil sesuai role (matriks bagian 2). Pengecekan role juga di backend untuk tiap item.

Selesai kalau: header bersih dari tombol lama, tiap role hanya melihat item yang berhak, dan semua item berfungsi dari Tools.

### Paket 4: Katalog dan produk
**Cakupan:** daftar storage box, tipe stok, kategori barang, kondisi.

Tugas:
- **Daftar Storage Box:** submenu di Katalog. Tiap box bisa dibuka untuk melihat isinya (produk, tipe, jumlah). Satu box boleh berisi campuran produk.
- **Tipe Stok:** field di form produk baru (roll, unit, atau lainnya). Input manual dengan saran dari nilai yang pernah dipakai, agar tidak muncul variasi penulisan seperti "Roll", "roll", "ROLL".
- **Kategori Barang:** dropdown **Alat / Barang Habis Pakai** di form produk. Tambahkan filter di katalog. Hanya pembeda jenis; tidak mengubah alur stok.
- **Kondisi:** disimpan per item. Pilihan: Baru, Baik, Perlu Perbaikan, Rusak, plus catatan kondisi (teks bebas). Perubahan kondisi tercatat di log aktivitas (siapa, kapan, dari apa ke apa). Item **Rusak tidak dihitung sebagai stok tersedia** dan tidak muncul sebagai pilihan saat request teknisi. Tampilkan badge kondisi di katalog dan isi box, serta filter kondisi. Saat teknisi mengembalikan barang (alur ambil/kembali), tambahkan langkah singkat untuk mengisi kondisi.
- Satu migrasi database dengan nilai default untuk produk dan item lama.

Selesai kalau: produk lama tetap utuh, field baru muncul di form, katalog, dan isi box, dan stok tersedia tidak menghitung item Rusak.

### Paket 5: Kamera dan laporan cetak
**Bergantung pada:** Paket 2.

Tugas:
- **Input stok via kamera** (scan QR/barcode) di menu keluar/masuk. Pakai ulang komponen scanner stok via kamera yang sudah ada; jangan membuat baru.
- **Template cetak laporan:** halaman khusus dengan CSS `@media print`, ukuran A4, kop (logo, judul, periode, tanggal cetak), header tabel berulang di tiap halaman, footer nomor halaman. Sembunyikan navbar dan tombol saat cetak. Hasil cetak tidak boleh terlihat seperti screenshot dari menu laporan.

Selesai kalau: scan kamera mencatat masuk/keluar dengan benar, dan hasil cetak laporan rapi serta konsisten.

### Paket 6: WA Alert (kirim lewat Fonnte)
**Bergantung pada:** Paket 3 dan 4.

Tugas:
1. **Akses:** menu WA Alert di Tools bisa dibuka semua role. Hanya developer, admin, dan admin gudang yang boleh mengubah pengaturan (dicek di backend). Teknisi hanya melihat riwayat.
2. **Tiga jenis pesan**, otomatis dari data stok, tanpa teks bebas:
   - Peringatan dini: hanya untuk produk/tipe di daftar pantauan.
   - Stok menipis.
   - Stok habis.
   Item berkondisi Rusak tidak dihitung sebagai stok tersedia.
3. **Ambang berjenjang** (menipis dan peringatan dini): **tipe > produk > global**, ambil yang paling spesifik. Katalog tidak dipakai sebagai level ambang. Di halaman pengaturan, tampilkan ambang yang berlaku untuk tiap produk/tipe beserta sumbernya ("dari tipe", "dari produk", "dari global").
4. **Daftar pantauan:** pilih produk atau tipe tertentu dengan ambang dini masing-masing, agar ada waktu menyiapkan barang sebelum benar-benar menipis.
5. **Pembatasan 15 menit di backend** (bukan hanya di tombol). Alert yang terkumpul dalam rentang itu digabung menjadi satu pesan ringkasan (habis, menipis, perlu disiapkan). Alert yang tertunda masuk antrean untuk jendela berikutnya. **Anti-duplikat berbasis status:** barang yang sama tidak dikirim ulang selama statusnya tidak berubah; status direset saat stok naik di atas ambang.
6. **Pengaturan lain:** kejadian yang dikirim (menipis, habis, dini), jeda (default 15 menit dengan batas minimum, tidak boleh 0), jam aktif opsional, saklar aktif/nonaktif.
7. **Penerima:** satu grup WhatsApp dan/atau beberapa nomor, dalam satu daftar, tanpa duplikat. Pastikan integrasi Fonnte mendukung kirim ke grup. Sediakan tombol **kirim pesan uji** yang juga kena batas 15 menit.
8. **Log pengiriman:** waktu, isi ringkas, status Fonnte, pemicu, dicatat di log aktivitas.
9. Rancang agar metode penentuan "segera menipis" bisa diperluas nanti ke perkiraan sisa hari berdasarkan rata-rata pemakaian, tanpa mengubah struktur daftar pantauan.

Selesai kalau: pesan terkirim sesuai ambang berjenjang, tidak lebih dari satu pesan per 15 menit, tidak ada duplikat, dan teknisi tidak bisa mengubah pengaturan.

### Paket 7: Branding (logo)
**Tidak bergantung pada paket lain.** Gambar logo dilampirkan bersama prompt ini (ikon kubus hijau dan biru tua dengan pin lokasi dan centang, latar transparan). Simpan sebagai aset statis (misalnya `/public/logo.webp`).

Tugas:
1. **Top navigation, sisi kiri:** satu blok yang bisa diklik berisi [kotak logo] + teks **"FieldOps IT"** (tebal) + ikon panah dropdown (chevron abu-abu) di kanannya. Ini menggantikan tampilan sekarang yang hanya logo kecil + panah.
2. **Kotak logo:** persegi bersudut membulat dengan latar terang (putih/abu muda) agar logo terlihat di tema gelap dan terang. Isinya logo baru, bukan inisial "FO".
3. Perilaku dropdown dan fungsi klik tetap seperti sekarang; hanya tampilan yang berubah.
4. Di layar sempit (HP), teks "FieldOps IT" boleh disembunyikan; logo dan panah tetap tampil.
5. Terapkan logo baru juga di tempat lain yang memakai logo: favicon, ikon PWA (192x192 dan 512x512, latar tidak transparan), halaman login, dan template label cetak. Sebutkan dulu tempat mana saja yang akan diubah.
6. Pastikan tampilan benar di tema terang dan gelap, dan ukuran file logo kecil (cache PWA dibatasi 5 MB).

Selesai kalau: tampilan navbar sesuai model di atas di desktop dan HP, dan logo baru konsisten di semua tempat yang disebut.

## 4. Perubahan data (rancang dalam satu alur migrasi per paket)

- **Produk:** `kategori_barang` (Alat / Barang Habis Pakai), `tipe_stok`.
- **Item:** `kondisi`, `catatan_kondisi`.
- **Riwayat kondisi:** tercatat lewat log aktivitas yang sudah ada.
- **WA Alert (baru):** pengaturan (jeda, jam aktif, saklar, kejadian), ambang berjenjang (global, produk, tipe), daftar pantauan (produk/tipe + ambang dini), daftar penerima (grup/nomor), status alert untuk anti-duplikat dan antrean, log pengiriman.
- **Permission:** definisi role x aksi dipusatkan di satu tempat.
- Semua perubahan skema disertai migrasi dengan nilai default untuk data lama.

## 5. Urutan pengerjaan

1. Paket 1 dan Paket 2 (boleh paralel, area kodenya berbeda)
2. Paket 3
3. Paket 4
4. Paket 5 dan Paket 6 (boleh paralel)
5. Paket 7 (kapan saja, tidak bergantung pada yang lain)

## 6. Rencana test per paket

Tulis test otomatis dengan framework yang sudah dipakai proyek. Layanan eksternal (Fonnte) di-mock, jangan mengirim pesan sungguhan. Test harus gagal bila aturannya dilanggar, bukan sekadar lolos.

| Paket | Test yang diminta |
|---|---|
| 1. Hak akses | Tabel role x endpoint: tiap kombinasi dipanggil dan status (200/403) dicocokkan dengan matriks bagian 2. Teknisi ditolak di semua endpoint tulis Katalog dan Setting API. Admin gudang diizinkan menulis di Katalog dan melihat isi storage box. |
| 2. Bug | Transaksi masuk menambah stok dan tercatat "masuk"; transaksi keluar mengurangi stok dan tercatat "keluar". File Excel hasil ekspor dibuka ulang dengan library dan datanya cocok dengan sumber. |
| 3. Tools | Daftar item Tools dari API sesuai role. Endpoint tiap item menolak role yang tidak berhak (Database dan Audit untuk teknisi dan admin gudang). Ekspor tidak memuat data akun atau pengaturan API. |
| 4. Katalog | Migrasi tidak mengubah atau menghapus data lama dan memberi nilai default. Item Rusak tidak dihitung stok tersedia dan tidak bisa dipilih di request teknisi. Perubahan kondisi tercatat di log aktivitas. Tipe stok dan kategori barang tersimpan dan terfilter. |
| 5. Kamera dan cetak | Scan kode valid dan tidak valid ditangani benar dan transaksi tercatat sesuai arah. Halaman cetak tidak memuat navbar dan tombol. |
| 6. WA Alert | Ambang berjenjang tipe > produk > global memilih yang paling spesifik. Maksimal satu pesan per 15 menit, alert yang terkumpul digabung dalam satu ringkasan. Tidak ada pesan duplikat selama status sama; status direset saat stok naik di atas ambang. Jeda tidak bisa diatur ke 0. Teknisi tidak bisa mengubah pengaturan, penerima, atau daftar pantauan. Penerima duplikat hanya dikirimi sekali. |
| 7. Branding | Pemeriksaan manual: navbar di desktop dan HP, tema terang dan gelap, favicon dan ikon PWA. |

## 7. Checklist uji akhir

- [ ] Tiap role diuji terhadap matriks Katalog, Setting API, dan Tools.
- [ ] Teknisi tidak bisa memanggil endpoint tulis Katalog atau Setting API (403).
- [ ] Transaksi masuk menambah stok dan tercatat sebagai masuk.
- [ ] File Excel terbuka di Excel, datanya benar, dan hanya berisi data yang boleh dilihat role-nya.
- [ ] Header tidak lagi berisi tombol Database, Akses HP, WA Alert, Audit, Ekspor Excel; semuanya ada di Tools sesuai role.
- [ ] Daftar storage box bisa dibuka dan menampilkan isi (campuran produk).
- [ ] Tipe stok, kategori barang, dan kondisi tersimpan dan tampil; item Rusak tidak dihitung stok tersedia.
- [ ] Input stok via kamera di keluar/masuk berfungsi.
- [ ] Hasil cetak laporan memakai template khusus, bukan screenshot.
- [ ] WA Alert: ambang berjenjang benar, maksimal satu pesan per 15 menit, tidak ada duplikat, pesan uji berfungsi, log tercatat.
- [ ] Logo dan navbar sesuai model baru di desktop dan HP, tema terang dan gelap.
- [ ] Data lama tetap utuh setelah migrasi.
