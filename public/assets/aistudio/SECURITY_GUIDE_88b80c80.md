# SECURITY_GUIDE.md — FieldOps Inventory v2

Panduan untuk agent AI. Terapkan semua aturan di bawah.

> **Catatan penerapan:** dokumen ini adalah **target**. Bila kode sudah punya implementasi keamanan (misalnya perbaikan oleh kontributor lain), jangan menimpanya. Lakukan audit selisih lebih dulu (lihat *Status dan penyelarasan* di `IMPLEMENTATION_GUIDE.md`), laporkan tabel perbedaannya, dan terapkan hanya yang disetujui pemilik proyek. Semua angka waktu dan batas **harus dibaca dari konfigurasi** (file `.env` atau tabel pengaturan), tidak ditulis langsung di kode.

## 1. Sesi dan token

**Konfigurasi bawaan**

| Kunci | Nilai bawaan | Arti |
|---|---|---|
| `ACCESS_TOKEN_TTL_DETIK` | 900 | Masa berlaku access token (15 menit) |
| `IDLE_TIMEOUT_MENIT` | 30 | Sesi mati bila tidak ada aktivitas |
| `ABSOLUTE_TIMEOUT_JAM` | 12 | Sesi mati setelah sekian jam, seaktif apa pun |
| `MAX_SESI_PER_AKUN` | 1 | Login baru mencabut sesi lama. Bisa dinaikkan ke 2 (ponsel + komputer) |
| `REAUTH_MENIT` | 15 | Aksi tingkat 3 meminta password ulang bila login terakhir lebih lama dari ini |

**Aturan**
1. Sesi disimpan di server (tabel `sesi`), bukan JWT murni, supaya bisa dicabut kapan saja.
2. Token dikirim lewat cookie dengan flag `HttpOnly`, `Secure`, dan `SameSite=Strict` (atau `Lax` bila perlu). **Dilarang menyimpan token di localStorage atau sessionStorage.**
3. Access token berumur pendek. Refresh token dipakai untuk meminta access token baru dan **diganti di setiap pemakaian** (rotation). Bila refresh token lama muncul lagi, cabut seluruh sesi dan minta login ulang (indikasi token disalin).
4. Saat login, buat ID sesi baru (cegah session fixation) dan **ID perangkat acak** yang disimpan di cookie HttpOnly terpisah. Token hanya sah bila dibawa bersama ID perangkat yang cocok dengan catatan sesi.
5. Jangan mengikat sesi secara ketat ke alamat IP (IP ponsel dan WiFi sering berubah). IP dan user agent dicatat untuk audit dan deteksi anomali saja.
6. Logout menghapus sesi di server. Admin bisa memaksa logout akun lain.
7. HTTPS wajib, termasuk untuk akses dari luar kantor. Hash password dengan algoritma lambat (bcrypt/argon2/PBKDF2 yang sudah ada).

**Tabel `sesi`**: `id`, `user_id`, `refresh_hash`, `device_id_hash`, `user_agent`, `ip`, `dibuat_pada`, `aktivitas_terakhir`, `kedaluwarsa_mutlak`, `dicabut_pada`. Simpan hash token, bukan token aslinya.

## 2. Konfirmasi aksi sensitif bertingkat

Tingkat tiap aksi disimpan di konfigurasi dan dapat diubah.

| Tingkat | Bentuk | Aksi contoh |
|---|---|---|
| 0 | Langsung jalan, ada tombol batal singkat | Ubah catatan, pindah box satu item |
| 1 | Dialog dengan tombol "Ya, lanjutkan" | Barang keluar satu item, restore dari arsip |
| 2 | Ketik kata `approve` | Approve atau tolak request, barang keluar massal, input stok massal |
| 3 | Ketik **nama objek** + password ulang (bila melewati `REAUTH_MENIT`) | Hapus permanen, hapus produk/tipe/jenis/box, koreksi ID item, ubah role, ubah aturan ID |

**Aturan**
1. Dialog menyebut dampak: jumlah item, box, dan riwayat yang terdampak. Tombol baru aktif bila teks yang diketik cocok persis.
2. **Penegakan di server.** Sebelum aksi tingkat 2 atau 3, server menerbitkan *token konfirmasi* sekali pakai, terikat ke pengguna, jenis aksi, dan objek, dan hangus dalam 120 detik. Endpoint aksi menolak permintaan tanpa token yang sah. Pengecekan di antarmuka saja tidak cukup.
3. Persetujuan request teknisi: satu dari developer, admin, atau admin gudang sudah cukup. Cek status masih `menunggu` lewat `UPDATE ... WHERE status='menunggu'` dan periksa jumlah baris yang berubah, supaya tidak diproses dua kali.
4. Setiap konfirmasi dicatat di log aktivitas: siapa, aksi, objek, ringkasan dampak, waktu.

## 3. Hapus permanen dengan masa tunggu 14 hari

Dua lapis yang berbeda:
- **Soft delete (arsip barang keluar)**: dapat dicari dan dipulihkan dari aplikasi.
- **Hapus permanen**: hilang dari aplikasi seketika, tetapi salinannya disimpan di server selama `RETENSI_SAMPAH_HARI` (bawaan 14) sebelum dihapus sungguhan. Pemulihan hanya lewat terminal server.

**Tabel `sampah_hapus`**

| Kolom | Isi |
|---|---|
| `id` | ID entri |
| `jenis_objek` | item, produk, tipe, jenis, box, akun |
| `objek_id` | ID objek asli |
| `snapshot` | JSON (disimpan sebagai teks) berisi baris objek **dan baris turunannya** |
| `dihapus_oleh`, `dihapus_pada` | pelaku dan waktu |
| `aktivitas_id` | ID aktivitas di log |
| `purge_setelah` | `dihapus_pada` + retensi |
| `status` | `menunggu`, `dipulihkan`, `dibersihkan` |

**Aturan**
1. Hapus permanen berjalan dalam **satu transaksi**: tulis snapshot, hapus baris asli, tulis log. Bila salah satu gagal, semuanya dibatalkan.
2. Pendekatan snapshot dipilih agar query biasa tidak perlu menyaring data terhapus.
3. Penghapusan jenis atau produk **diblokir** bila masih punya stok aktif.
4. **Job terjadwal harian** menghapus entri `sampah_hapus` yang `purge_setelah`-nya sudah lewat, mengubah status menjadi `dibersihkan` (kolom `snapshot` dikosongkan), dan mencatatnya di log. Server berjalan di Windows: gunakan `node-cron` di dalam aplikasi atau Task Scheduler.
5. **Perintah pemulihan lewat terminal** (tidak ada tombolnya di aplikasi):
   - `npm run sampah -- --list` menampilkan entri yang masih bisa dipulihkan beserta sisa waktunya.
   - `npm run sampah -- --pulihkan <id> --dry-run` memeriksa tanpa mengubah apa pun.
   - `npm run sampah -- --pulihkan <id>` memulihkan dalam satu transaksi.
6. Pemulihan wajib memeriksa konflik sebelum memasukkan ulang: ID item atau SN yang sudah dipakai data baru, induk (produk, tipe, box) yang sudah tidak ada, dan atribut yang sudah berubah. Bila ada konflik, batalkan dan tampilkan alasannya.
7. Pemulihan dicatat di log dengan pelaku `terminal`. Log aktivitas **tidak pernah dihapus** dan tidak ikut dibersihkan.
8. Dialog konfirmasi tingkat 3 menyebutkan: "Data disimpan 14 hari di server dan bisa dipulihkan oleh administrator server."
9. Catatan: salinan data juga ada di backup. Atur masa simpan backup selaras dengan kebijakan ini.

## 4. Portabilitas database

- Akses database hanya lewat lapisan repository. Logika bisnis (persetujuan, restore, pembuatan log) ada di lapisan service.
- Gunakan ORM atau query builder (Prisma, Drizzle, atau Knex). Skema dan perubahannya lewat migrasi.
- Hindari fitur khusus satu database: `ENUM`, stored procedure, trigger, dan `CHECK` yang menjumlahkan boolean. Simpan waktu dalam UTC.
- Pindah database di masa depan harus berupa migrasi, bukan penulisan ulang aplikasi. Sediakan ekspor data ke CSV atau JSON.

## 5. Kriteria selesai

- [ ] Token tidak bisa dibaca JavaScript dan tidak ada di localStorage.
- [ ] Login kedua pada akun yang sama mencabut sesi pertama (sesuai `MAX_SESI_PER_AKUN`).
- [ ] Pemakaian ulang refresh token lama mencabut seluruh sesi.
- [ ] Memanggil endpoint aksi tingkat 2 atau 3 tanpa token konfirmasi ditolak oleh server.
- [ ] Dua orang menyetujui request yang sama bersamaan: hanya satu yang berhasil.
- [ ] Hapus permanen memindahkan data ke `sampah_hapus`, dan pemulihan via terminal mengembalikannya utuh, termasuk turunannya.
- [ ] Entri yang melewati `purge_setelah` dibersihkan otomatis dan tercatat di log.
- [ ] Semua konfirmasi, penghapusan, pemulihan, login, dan pencabutan sesi tercatat di log aktivitas.
