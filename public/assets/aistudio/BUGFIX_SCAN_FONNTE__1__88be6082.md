# BUGFIX_SCAN_FONNTE.md

Panduan perbaikan untuk agent AI — FieldOps Inventory.
Tanggal: 9 November 2026

Ada 2 bug yang harus diperbaiki:

1. Scan kamera tidak membaca SN pada label router/modem.
2. Role **admin gudang** bisa mengakses konfigurasi token Fonnte.

---

## BUG 1 — Scan kamera tidak membaca SN

### Gejala

- Fitur scan kamera tidak berjalan saat scan SN dari label router (contoh: TP-Link EN020-F5).
- Saat test scan SN modem, hasilnya sama (gagal).
- Karena router dan modem sama-sama gagal, penyebab hampir pasti ada di scanner/konfigurasi, bukan di label.

### Dugaan penyebab

**A. Bukan secure context (HTTPS).**
`getUserMedia` hanya berjalan di `https://` atau `localhost`. Jika aplikasi dibuka lewat `http://192.168.x.x:port` atau dari Termux, kamera diblokir.
Tanda: tidak muncul popup izin kamera, atau error `NotAllowedError` / `navigator.mediaDevices` bernilai `undefined`.

**B. Format barcode tidak diaktifkan.**
SN pada label adalah **barcode 1D (kemungkinan Code 128)**, bukan QR. Jika scanner hanya mengaktifkan `QR_CODE` (default `html5-qrcode`, atau memakai `jsQR`), barcode ini tidak akan terbaca.
Tanda: kamera menyala tetapi tidak pernah menghasilkan hasil.

**C. Barcode kecil dan rapat.**
Resolusi kamera rendah, area scan berbentuk kotak, atau fokus tidak kontinu membuat barcode 1D sulit terbaca.

**D. Satu label berisi beberapa barcode.**
Label router memiliki 3 barcode (Model/SN, MAC, Wireless Password/PIN). Scanner bisa mengambil barcode yang salah.

### Yang harus dilakukan

1. **Periksa konfigurasi scanner** dan aktifkan format:
   `CODE_128`, `CODE_39`, `EAN_13`, `QR_CODE`, `DATA_MATRIX`.
2. **Gunakan `BarcodeDetector` bawaan browser** bila tersedia; fallback ke ZXing (`@zxing/browser`).
3. **Area scan persegi panjang lebar** (bukan kotak), karena barcode 1D berbentuk pipih.
4. **Constraint kamera:**
   - `facingMode: "environment"`
   - resolusi ideal minimal 1280x720
   - fokus kontinu (`focusMode: "continuous"`) bila didukung
5. **Penanganan error kamera yang jelas di UI**, dibedakan antara:
   - izin kamera ditolak
   - kamera tidak ditemukan
   - halaman bukan secure context (HTTP non-aman) → tampilkan petunjuk memakai HTTPS
6. **Filter hasil multi-barcode:** ambil hasil yang cocok dengan pola ID item/SN produk, abaikan barcode MAC dan PIN. Normalisasi hasil (trim spasi, hapus karakter kontrol).
7. **Terapkan di semua titik scan:** input stok via kamera, menu keluar/masuk, dan test scan.
8. **HTTPS untuk deploy lokal:** dokumentasikan opsi (sertifikat lokal, reverse proxy, atau Cloudflare Tunnel) agar kamera bisa dipakai dari HP.

### Kriteria selesai

- [ ] Scan barcode 1D (Code 128) dari label router terbaca dan mengisi ID item.
- [ ] Scan barcode label modem terbaca.
- [ ] QR tetap terbaca.
- [ ] Jika dibuka lewat HTTP non-aman, UI menampilkan pesan yang jelas, bukan gagal diam-diam.
- [ ] Saat label punya beberapa barcode, yang dipakai adalah SN, bukan MAC/PIN.

---

## BUG 2 — Admin gudang bisa mengakses konfigurasi token Fonnte

### Gejala

Role `admin gudang` dapat membuka dan mengubah konfigurasi token Fonnte. Seharusnya admin gudang **hanya** bisa memilih tujuan pengiriman notifikasi (grup WhatsApp atau nomor).

### Penyebab

Otorisasi tidak dibatasi per role pada konfigurasi token, dan kemungkinan hanya mengandalkan penyembunyian menu di frontend. Endpoint tetap bisa dipanggil langsung.

### Yang harus dilakukan

1. **Pisahkan endpoint di backend:**
   - Konfigurasi token/device Fonnte (contoh: `GET/PUT /api/settings/fonnte`) → hanya `developer` dan `admin`, dilindungi middleware role.
   - Pemilihan penerima notifikasi (contoh: `GET/PUT /api/wa-alert/recipients`) → boleh untuk `admin gudang` (dan role lain sesuai aturan WA Alert).
2. **Token tidak boleh dikirim ke frontend.**
   - Simpan di server (env atau tabel settings).
   - Untuk admin/developer, tampilkan dalam bentuk tersamar (misalnya `••••abcd`); mengubah token lewat input baru.
3. **Frontend:** untuk admin gudang, halaman WA Alert hanya menampilkan pemilih penerima. Bagian token/device **tidak dirender sama sekali** (bukan sekadar disabled).
4. **Konsistensi dengan aturan sebelumnya:** menu Setting API hanya untuk `admin` dan `developer`.
5. **Tambahkan tes otorisasi:**
   - `admin gudang` memanggil endpoint token → harus mendapat `403`.
   - `teknisi` memanggil endpoint token → `403`.
   - `admin` / `developer` → berhasil.
   - `admin gudang` memanggil endpoint penerima → berhasil.

### Kriteria selesai

- [ ] Admin gudang tidak melihat maupun bisa mengubah token Fonnte (UI dan API).
- [ ] Admin gudang tetap bisa memilih tujuan notifikasi.
- [ ] Respons API tidak pernah memuat token mentah ke role non-admin; untuk admin/developer hanya tersamar.
- [ ] Tes otorisasi lulus.

---

## Prompt singkat untuk agent AI

```
Baca BUGFIX_SCAN_FONNTE.md lalu perbaiki 2 bug di dalamnya:
(1) scanner kamera tidak membaca SN barcode 1D di label router/modem,
(2) role admin gudang tidak boleh mengakses konfigurasi token Fonnte,
hanya boleh memilih tujuan notifikasi.
Jangan mengubah bagian lain. Setelah selesai, jelaskan file yang diubah
dan cara mengujinya.
```

---

## UPDATE — Kamera live tidak aktif + jalur upload/foto (Opsi A)

### Keputusan

Scan SN memakai **decode di sisi klien (browser)**. Gambar **tidak diupload dan tidak disimpan di server**; yang dikirim ke server hanya **teks SN**. Karena itu tidak perlu sistem kompresi upload maupun job penghapusan 24 jam.

### Kenapa kamera live tidak aktif walau izin sudah diberikan

1. Aplikasi dibuka di iframe (preview) tanpa `allow="camera"`, atau lewat HTTP non-aman (`http://IP:port`) sehingga `getUserMedia` tidak tersedia.
2. Constraint kamera terlalu ketat (`facingMode: { exact: "environment" }`, resolusi/focus wajib) → `OverconstrainedError`.
3. Stream/scanner sebelumnya belum dimatikan (tidak di-`stop()` saat unmount, init ganda di React StrictMode), atau kamera dipakai tab/aplikasi lain.
4. Izin kamera untuk browser dimatikan di pengaturan sistem HP.

Tampilkan `error.name` di UI untuk membedakan: `NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError`, `mediaDevices undefined`.

### Yang harus dilakukan

1. **Perbaiki kamera live**
   - Ganti `exact` menjadi `ideal` untuk `facingMode`, resolusi, dan `focusMode`. Jika gagal, ulangi dengan `{ video: true }`.
   - Matikan stream/scanner (`track.stop()`, `scanner.stop()` + `clear()`) saat unmount, modal ditutup, dan sebelum start ulang. Cegah init ganda.
   - Jika di-embed di iframe, tambahkan `allow="camera"`.
2. **Tambahkan scan lewat foto sebagai fallback permanen**
   - `<input type="file" accept="image/*" capture="environment">` di samping tombol scan kamera live.
   - Decode di klien dengan `BarcodeDetector.detect(imageBitmap)` bila tersedia; fallback ke ZXing (`decodeFromImageUrl`) atau `html5-qrcode` `scanFile`.
   - Format: `CODE_128`, `CODE_39`, `EAN_13`, `QR_CODE`, `DATA_MATRIX`.
   - Jika gagal: coba ulang dengan gambar di-resize, grayscale, kontras dinaikkan, lalu rotasi 90 derajat. Jika tetap gagal, tampilkan "barcode tidak terbaca, coba foto lebih dekat dan terang" dan sediakan input SN manual.
   - Hasil memakai filter pola SN yang sama dengan scan live (abaikan barcode MAC dan PIN).
3. **Kirim ke server hanya teks SN.** Jangan buat endpoint upload gambar.
4. **Jika kamera live tidak tersedia** (bukan secure context atau error), otomatis tampilkan opsi foto dan input manual, bukan layar kosong.

### Kriteria selesai

- [ ] Kamera live menyala di HP, atau menampilkan pesan error yang spesifik.
- [ ] Scan lewat foto/galeri membaca barcode SN dari label router dan modem.
- [ ] Tidak ada gambar yang tersimpan di server.
- [ ] Ada input SN manual sebagai jalur terakhir.

### Prompt singkat untuk agent AI

```
Baca bagian UPDATE di BUGFIX_SCAN_FONNTE.md. Perbaiki kamera live dan tambahkan
scan lewat foto dengan decode di sisi klien (Opsi A). Jangan buat endpoint
upload gambar; kirim hanya teks SN ke server. Jangan mengubah bagian lain.
Setelah selesai, jelaskan file yang diubah dan cara mengujinya.
```
