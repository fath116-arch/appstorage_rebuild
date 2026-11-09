# FIX_PRINT_LABEL.md — Perbaikan Bug Cetak Label (Halaman A4 Berlebih)

Panduan untuk agent AI (Google AI Studio, Build mode). Kerjakan berurutan dan jangan mengubah fitur lain di luar cetak label.

## 1. Gejala

| Jumlah label dipilih | Hasil preview / print preview | Seharusnya |
|---|---|---|
| 1 label | 2 lembar A4 | 1 lembar |
| 2 label | 2 lembar A4 | 1 lembar |
| 3 label | 1 lembar A4 (normal) | 1 lembar |

Pola: lembar penuh normal, lembar tidak penuh bermasalah. Berarti ada elemen atau perilaku yang hanya muncul atau berubah ketika lembar tidak terisi penuh.

## 2. Aturan yang TIDAK boleh berubah

- Ukuran satu label tetap sama untuk semua pilihan (1/2/3 label per lembar), mengikuti ukuran saat 3 label per A4.
- Titik petunjuk potong tetap berada di tengah-tengah jarak antar label.
- Satu label berisi 2 tabel berdampingan, masing-masing 5 baris x 3 kolom (NO, NAMA PRODUK, TIPE), jadi maksimal 10 produk per label.
- Template label tidak diubah (logo FieldOps, nama katalog, tabel, QR "scan untuk lihat detail").

## 3. Langkah investigasi

Cari komponen/CSS cetak label (kemungkinan nama: `PrintLabel`, `LabelPrint`, `LabelSheet`, atau file CSS `@media print`), lalu periksa:

1. **Jumlah lembar yang dihasilkan.** Cari logika pembagian label ke lembar (`chunk`, `Math.ceil`, `slice`, dsb.).
   - Pastikan `jumlahLembar = Math.ceil(jumlahLabel / labelPerLembar)`.
   - Pastikan tidak ada lembar kosong ekstra (misalnya lembar khusus penanda potong atau slot kosong).
2. **`break-after` / `page-break-after`.** Jika `always` dipasang pada semua lembar, lembar terakhir menghasilkan halaman kosong.
3. **Tinggi lembar.** Cari `min-height: 297mm`, `height: 100vh`, `h-screen`, `min-h-screen`, padding/border yang menambah tinggi di atas 297mm (cek `box-sizing`).
4. **Slot kosong dan titik potong.** Cari `flex: 1`, `height: 100%`, `justify-content: space-between`, atau elemen `position: absolute` yang posisinya dihitung dari jumlah label. Elemen seperti ini bisa meluap melewati 297mm ketika label kurang dari penuh.
5. **Wrapper preview.** Pastikan wrapper preview di layar tidak ikut tercetak sebagai halaman tambahan (header, tombol, margin, dsb. harus `display: none` di `@media print`).

Catat penyebab pasti yang ditemukan sebelum memperbaiki.

## 4. Perbaikan yang diharapkan

```css
@page {
  size: A4;
  margin: 0;
}

@media print {
  html, body {
    margin: 0;
    padding: 0;
  }

  /* sembunyikan semua yang bukan area cetak */
  .no-print { display: none !important; }
}

.print-sheet {
  width: 210mm;
  height: 296mm;           /* sisakan 1mm agar tidak meluap ke halaman kedua */
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  break-after: page;
  break-inside: avoid;
}

.print-sheet:last-child {
  break-after: auto;       /* hindari halaman kosong di belakang */
}

/* slot kosong tetap memakai ukuran label yang sama, tapi tidak terlihat */
.label-slot-empty {
  width: var(--label-width);
  height: var(--label-height);
  visibility: hidden;
}
```

Catatan implementasi:

- Gunakan ukuran tetap (mm) untuk label, jangan `flex: 1` atau `height: 100%`.
- Posisi titik potong dihitung dari ukuran label tetap dan jarak antar label (bukan dari jumlah label yang terisi), dan harus berada di dalam area 296mm.
- Nama class di atas hanya contoh; sesuaikan dengan nama class yang sudah ada di kode.

## 5. Pengujian wajib

Uji preview dan print preview (Ctrl+P) untuk setiap layout (1, 2, dan 3 label per lembar) dengan jumlah label berikut:

| Jumlah label | 1 per lembar | 2 per lembar | 3 per lembar |
|---|---|---|---|
| 1 | 1 lembar | 1 lembar | 1 lembar |
| 2 | 2 lembar | 1 lembar | 1 lembar |
| 3 | 3 lembar | 2 lembar | 1 lembar |
| 4 | 4 lembar | 2 lembar | 2 lembar |
| 6 | 6 lembar | 3 lembar | 2 lembar |
| 7 | 7 lembar | 4 lembar | 3 lembar |

Checklist tambahan:

- [ ] Tidak ada halaman kosong di akhir.
- [ ] Ukuran label sama di semua layout.
- [ ] Titik potong tetap di tengah jarak antar label dan tidak terpotong tepi kertas.
- [ ] Satu label memuat 2 tabel 5x3 dengan benar (sampai 10 produk).
- [ ] Hasil sama di Chrome dan Edge.
- [ ] Pilih banyak katalog sekaligus tetap menghasilkan jumlah lembar yang benar.

## 6. Laporan setelah selesai

Tuliskan ringkasan singkat:

1. Penyebab pasti bug (file dan baris).
2. Perubahan yang dilakukan.
3. Hasil pengujian dari tabel di atas.
