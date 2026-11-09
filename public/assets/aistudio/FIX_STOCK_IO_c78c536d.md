# FIX_STOCK_IO.md — Perbaikan Masuk/Keluar, Sinkronisasi Katalog & Sesi Login

Kerjakan berurutan: **Masalah 2** (arsitektur data) dulu, lalu **Masalah 1** (input jumlah) karena form Masuk/Keluar akan ditulis ulang mengikuti sumber data baru, terakhir **Masalah 3** (sesi login). Jangan ubah hal lain di luar daftar ini. Pertahankan hash password PBKDF2 yang sudah ada dan semua tema/design token.

---

## Masalah 1 — Kolom "Jumlah Masuk" terkunci di angka 1

### Gejala
Di modal "Catat Barang Masuk" dan "Catat Barang Keluar", angka `1` tidak bisa dihapus. Pengguna hanya bisa menambah digit di belakangnya (12, 13, ...), sehingga jumlah 2–9 mustahil dimasukkan.

### Penyebab (cari pola ini di komponen form)
Nilai dipaksa menjadi angka di dalam `onChange`, misalnya:

```tsx
// SALAH
onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
// atau
onChange={(e) => setQty(Number(e.target.value) || 1)}
```

Saat field dikosongkan, nilainya langsung dipaksa kembali ke `1`, jadi angka baru tidak pernah bisa diketik dari nol.

### Perbaikan
1. Simpan jumlah sebagai **string** di state form, bukan number.
2. Di `onChange`, hanya buang karakter non-digit. **Jangan** beri nilai default dan jangan paksa minimal di sini.
3. Validasi (minimal 1, maksimal stok untuk Keluar) dilakukan saat **blur** dan saat **submit**.
4. Ubah ke number hanya saat submit.

```tsx
const [qty, setQty] = useState<string>("1");
const [qtyError, setQtyError] = useState<string | null>(null);

const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const digitsOnly = e.target.value.replace(/\D/g, ""); // boleh kosong
  setQty(digitsOnly);
  setQtyError(null);
};

const validateQty = (): number | null => {
  const n = parseInt(qty, 10);
  if (!qty || Number.isNaN(n) || n < 1) {
    setQtyError("Jumlah minimal 1");
    return null;
  }
  if (mode === "OUT" && n > currentStock) {
    setQtyError(`Melebihi stok saat ini (${currentStock})`);
    return null;
  }
  return n;
};

<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  value={qty}
  onChange={handleQtyChange}
  onBlur={() => qty === "" ? setQty("1") : validateQty()}
  onFocus={(e) => e.target.select()}
/>
```

Catatan:
- Pakai `type="text"` + `inputMode="numeric"` (bukan `type="number"`) supaya tidak ada spinner/scroll yang mengubah angka dan perilaku backspace konsisten di HP.
- `onFocus select()` supaya angka default 1 langsung tertimpa saat mengetik.
- Terapkan pola yang sama di **semua** field jumlah lain (input stok kamera/massal, request teknisi, dll.). Cari dengan: `parseInt(e.target.value) ||`, `Number(e.target.value) ||`, `Math.max(1,`.

### Uji penerimaan
- Hapus angka 1, ketik 2 → tampil 2. Ulangi untuk 3–9, 10, 25, 100.
- Kosongkan lalu klik di luar → kembali ke 1.
- Keluar dengan jumlah > stok → pesan error, tombol simpan tidak jalan.
- Jumlah 0 atau kosong tidak bisa disimpan.

---

## Masalah 2 — Buat Produk (Katalog v2) dan Masuk/Keluar tumpang tindih & tidak sinkron

### Temuan dari tampilan saat ini
- Form Masuk/Keluar memilih barang dari **inventori lama** (contoh: `[CAB-UTP-CAT6-BLD] Kabel UTP Cat6 Belden ... (Stok: 6 roll)`).
- Tab Katalog v2 menampilkan **"Tidak ada produk ditemukan"**, sementara tab "Inventori Stok Fisik" berisi 12 item. Artinya ada **dua sumber data terpisah**.
- Riwayat mutasi menampilkan kolom "Suku Cadang / Barang" = `-` dan satuan `pcs`, padahal form memakai satuan `roll`. Riwayat mencari barang di struktur v2 (id tidak ditemukan), sedangkan transaksi ditulis dengan id inventori lama.

### Prinsip yang harus diterapkan
**Satu sumber kebenaran.** Struktur v2 adalah satu-satunya model data:

```
Jenis → Atribut → Produk → Tipe (varian) → Item/Stok → Box → Transaksi
```

- **Stok** hanya berubah lewat **Transaksi** (MASUK/KELUAR/koreksi). Tidak ada kode yang boleh menulis angka stok langsung.
- "Buat Produk" hanya mendefinisikan *apa barangnya* (Jenis, Produk, Tipe, satuan, aturan ID). Ia tidak mengatur stok, kecuali stok awal (lihat poin 3).
- "Masuk/Keluar" hanya mencatat *berapa yang bergerak*.

### Langkah perbaikan

1. **Hapus sumber data inventori lama sebagai penyimpanan terpisah.**
   - Tab "Inventori Stok Fisik" tetap ada, tetapi menjadi **tampilan read-only** yang dihitung dari Tipe v2 + total transaksi. Judul item = nama Tipe (nama otomatis dari atribut).
   - Jangan simpan salinan stok di tabel/koleksi kedua.

2. **Migrasi data lama ke v2 (sekali jalan, idempotent).**
   - Untuk tiap dari 12 item lama: buat Produk + Tipe di v2 (petakan SKU lama → kode Tipe; satuan lama, mis. `roll`, tetap dipakai).
   - Buat satu transaksi `MASUK` bertipe `SALDO_AWAL` per item sebesar stok lama, supaya stok v2 = stok lama.
   - Simpan pemetaan `legacy_sku → tipe_id` agar menjalankan migrasi dua kali tidak membuat duplikat.
   - Ketika selesai, tulis log jumlah item termigrasi dan item gagal (jika ada).

3. **Buat Produk dengan stok awal** (jika form menyediakan kolom stok awal):
   - Jangan tulis stok langsung. Buat Tipe lalu otomatis buat transaksi `MASUK` bertipe `SALDO_AWAL`.
   - Begitu juga "Input Stok Kamera / Massal": setiap item yang ditambahkan menghasilkan transaksi MASUK, bukan edit stok.

4. **Form Masuk/Keluar membaca dari Tipe v2.**
   - Dropdown "Pilih Barang" berisi Tipe v2 (tampilkan Produk + nama Tipe + kode + stok + satuan). Dukung pencarian/filter Jenis dan Atribut.
   - Panel "Stok Saat Ini" menampilkan stok hasil hitung dari transaksi, dengan satuan dari Tipe.
   - Jika Tipe memakai ID per item (mis. nomor SN), alur scan/ID tetap divalidasi regex yang diatur di Produk.

5. **Transaksi menyimpan referensi + snapshot.**
   - Simpan `tipe_id` sebagai kunci referensi, plus snapshot `nama_barang`, `sku`, `satuan` pada saat transaksi. Dengan begitu riwayat tetap terbaca walau produk di-soft-delete atau diubah namanya.
   - Perbaiki riwayat supaya kolom "Suku Cadang / Barang" menampilkan snapshot (bukan `-`) dan "Jumlah" memakai satuan snapshot (`roll`, bukan `pcs` tetap).

6. **Hilangkan jalur ganda di UI.**
   - Satu tombol untuk menambah barang baru ke sistem: **Buat Produk** (Katalog).
   - Satu tombol untuk memindahkan stok: **Input Barang Masuk / Output Barang Keluar** (Masuk/Keluar).
   - Hapus/gabungkan menu atau tombol lain yang mengubah stok lewat jalur berbeda. Jika perlu "tambah barang baru" dari form Masuk, buat tautan "+ Buat Produk Baru" yang membuka form Buat Produk, bukan form kedua dengan logika sendiri.

7. **Konsistensi perhitungan.**
   - Stok = jumlah semua MASUK − jumlah semua KELUAR per Tipe. Pakai satu fungsi (`getStock(tipeId)`) di backend, dipakai oleh Dashboard, Katalog, Inventori Stok Fisik, WA Alert, dan form Masuk/Keluar.
   - Backend menolak KELUAR yang membuat stok negatif (validasi di server, bukan hanya di form).
   - Kartu ringkasan di halaman Masuk/Keluar ("Total Catatan", "Barang Keluar", "Barang Masuk") dihitung dari transaksi yang sama.

8. **Perbaiki bug lama yang berkaitan** (dari daftar 8/11): semua transaksi tercatat sebagai KELUAR. Pastikan field `tipe_mutasi` dikirim sesuai tombol yang ditekan (+ Input Barang Masuk → `MASUK`, − Output Barang Keluar → `KELUAR`).

### Uji penerimaan
- Setelah migrasi: Katalog v2 menampilkan 12 produk/tipe, dan jumlah di "Inventori Stok Fisik" sama dengan jumlah di Katalog.
- Catat MASUK 5 roll pada Kabel UTP Cat6 Belden (stok 6) → stok jadi 11 di Masuk/Keluar, Katalog, Inventori Stok Fisik, dan Dashboard.
- Catat KELUAR 3 → stok jadi 8 di semua tempat; KELUAR 99 ditolak.
- Riwayat menampilkan nama barang dan satuan `roll` dengan benar (tidak ada `-`).
- Buat Produk baru dengan stok awal 10 → muncul satu transaksi SALDO_AWAL di riwayat, stok 10 di semua tampilan.
- Tidak ada lagi kode yang menulis stok tanpa transaksi (cek dengan pencarian di seluruh repo).

### Yang jangan diubah
- Hash PBKDF2 100.000 iterasi SHA-256, sistem role, tema, label cetak, WA Alert.
- Struktur v2 (Jenis → Atribut → Produk → Tipe) yang sudah disepakati.

### Laporan akhir dari agent
Setelah selesai, laporkan: (a) file yang diubah, (b) hasil migrasi (jumlah berhasil/gagal), (c) daftar jalur kode lama yang dihapus, (d) hasil uji penerimaan di atas.

---

## Masalah 3 — Hapus login ulang paksa setelah beberapa menit

### Gejala
Pengguna harus login ulang setiap beberapa menit. Aplikasi hanya dipakai internal oleh sekitar 7 orang di satu kantor, jadi ini lebih mengganggu daripada melindungi.

### Perbaikan
1. Cari dan hapus/nonaktifkan semua logika kedaluwarsa sesi jangka pendek di frontend dan backend:
   - token yang hangus dalam hitungan milidetik/menit (cari: `900`, `expiresIn`, `exp`, `maxAge`, `setTimeout`/`setInterval` untuk logout, idle timeout)
   - pengecekan "token sudah tidak valid" yang memaksa redirect ke halaman login
   - aturan token hanya boleh dipakai di 1 perangkat (single-device), karena ini juga memicu logout paksa
2. Ganti dengan sesi panjang: token berlaku **30 hari** dan diperpanjang otomatis setiap kali pengguna aktif. Login ulang hanya diminta jika tidak aktif lebih dari 30 hari atau pengguna menekan tombol Keluar.
3. Satu akun boleh login di beberapa perangkat sekaligus (HP dan komputer).
4. Pertahankan hash password PBKDF2 100.000 iterasi SHA-256, sistem role, dan tombol Keluar yang berfungsi (saat Keluar, token di perangkat itu dihapus).

### Uji penerimaan
- Login, diamkan 10 menit, refresh halaman, lalu lakukan transaksi masuk/keluar tanpa diminta login ulang.
- Login di dua perangkat sekaligus tetap berjalan.
- Tombol Keluar tetap menghapus sesi di perangkat itu.
