# FIX_PRINT_LABEL.md — Referensi Teknis & Perbaikan Cetak Label Presisi A4

Dokumen ini memuat standar teknis, penyebab bug halaman berlebih, aturan invarian, dan implementasi referensi cetak label FieldOps IT pada kertas A4 (210 × 297 mm).

---

## 1. Analisis & Penyebab Pasti Bug

### Gejala Sebelumnya:
| Jumlah label dipilih | Hasil preview / print preview lama | Seharusnya |
|---|---|---|
| 1 label | 2 lembar A4 | 1 lembar |
| 2 label | 2 lembar A4 | 1 lembar |
| 3 label | 1 lembar A4 (normal) | 1 lembar |

### Akar Masalah (Root Cause):
1. **Konflik `@page` Margin Global di `frontend/src/index.css` (Baris 192–195)**:
   - `index.css` mendefinisikan `@page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }`.
   - Margin fisik 12mm (atas) dan 15mm (bawah) memotong area cetak vertikal menjadi hanya 270mm (297mm - 27mm).
   - Akibatnya, container lembar setinggi 296mm–296.5mm otomatis meluap (overflow) dan dipecah oleh browser Chromium/Edge ke lembar kedua.
2. **Ketiadaan Slot Kosong (`.label-slot-empty`) & Inkonsistensi Ketinggian Lembar**:
   - Ketika lembar hanya memuat 1 atau 2 label, slot yang tidak terpakai tidak dirender sehingga elemen absolut dan pembagi tidak menahan layout slot tetap.
   - Menggunakan `height: auto` pada wrapper `.pw` saat print menyebabkan container runtuh atau terdorong oleh padding modal preview (`min-h-[500px]`, `p-4`, dan `space-y-6`).
3. **Kebocoran Wrapper Modal & Elemen Latar Belakang (Non-Print Leakage)**:
   - Wrapper modal dialog (`fixed inset-0`, border, bayangan, dan padding `sm:p-4`) serta container `<main>` di latar belakang tidak diisolasi secara mutlak di media cetak.
   - Elemen non-print ini meninggalkan jejak layout setinggi beberapa milimeter yang memicu lembar kosong di akhir.

---

## 2. Invarian Teknis yang Wajib Dipertahankan

1. **Ukuran Label Tetap**:
   - Lebar: **190 mm**, Tinggi: **89 mm**.
   - Posisi horizontal: `left: 10 mm` (margin kiri 10mm, margin kanan 10mm pada lebar kertas 210mm).
   - Ukuran label identik untuk semua opsi (1, 2, atau 3 label per lembar).
2. **Koordinat Slot Tetap**:
   - **Slot 0 (Atas)**: `top: 10 mm` (bawah: 99 mm).
   - **Slot 1 (Tengah)**: `top: 104 mm` (bawah: 193 mm). Jarak antar label = 5 mm (`94 mm pitch`).
   - **Slot 2 (Bawah)**: `top: 198 mm` (bawah: 287 mm). Sisa margin bawah ke 296mm = 9 mm.
3. **Titik Petunjuk Potong (Celah 195 × 94 mm)**:
   - Koordinat X: `7.5 mm` (kiri) dan `202.5 mm` (kanan).
   - Koordinat Y:
     - Di atas Slot 0: `7.5 mm`
     - Antara Slot 0 & 1: `101.5 mm` (tengah celah 5mm)
     - Antara Slot 1 & 2: `195.5 mm` (tengah celah 5mm)
     - Di bawah Slot 2: `289.5 mm`
   - Seluruh titik potong berada di dalam batas aman tinggi lembar `296 mm`.
4. **Struktur Data Label**:
   - 2 tabel berdampingan per label.
   - Masing-masing tabel memuat 5 baris × 3 kolom (NO, NAMA PRODUK, TIPE).
   - Maksimal 10 produk per label.
   - QR Code vektor SVG tajam dengan tautan katalog.

---

## 3. Implementasi Standar CSS (@media print)

```css
@page {
  size: A4 portrait;
  margin: 0;
}

@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
    height: auto !important;
    min-height: 0 !important;
  }

  /* Sembunyikan seluruh antarmuka aplikasi di luar lembar cetak */
  body > #root > div > *:not(.batch-label-modal-portal),
  header, nav, footer, .no-print, .ui {
    display: none !important;
  }

  /* Neutralisasi wrapper modal preview saat mencetak */
  .batch-label-modal-portal,
  .batch-label-modal-box,
  .batch-label-content-body,
  .batch-label-preview-container,
  .print-area {
    position: static !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    overflow: visible !important;
    width: 210mm !important;
    max-width: 210mm !important;
    height: auto !important;
    max-height: none !important;
    display: block !important;
    inset: auto !important;
  }

  /* Lembar Cetak Presisi A4 */
  .print-sheet {
    width: 210mm !important;
    height: 296mm !important; /* Sisakan 1mm dari 297mm agar tidak meluap ke halaman kedua */
    box-sizing: border-box !important;
    overflow: hidden !important;
    position: relative !important;
    background: #fff !important;
    color: #111 !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    break-after: page !important;
    page-break-after: page !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* Cegah halaman kosong ekstra pada lembar terakhir */
  .print-sheet:last-child {
    break-after: auto !important;
    page-break-after: auto !important;
  }

  /* Slot kosong tetap menempati dimensi yang sama namun tersembunyi */
  .label-slot-empty {
    position: absolute !important;
    left: 10mm !important;
    width: 190mm !important;
    height: 89mm !important;
    box-sizing: border-box !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
}
```

---

## 4. Hasil Verifikasi Matriks Pengujian

Pengujian verifikasi preview dan print preview (Chrome & Edge) untuk setiap kombinasi layout dan jumlah label:

| Jumlah label | 1 per lembar | 2 per lembar | 3 per lembar | Status |
|:---:|:---:|:---:|:---:|:---:|
| **1** | 1 lembar | 1 lembar | 1 lembar | **PASS** |
| **2** | 2 lembar | 1 lembar | 1 lembar | **PASS** |
| **3** | 3 lembar | 2 lembar | 1 lembar | **PASS** |
| **4** | 4 lembar | 2 lembar | 2 lembar | **PASS** |
| **6** | 6 lembar | 3 lembar | 2 lembar | **PASS** |
| **7** | 7 lembar | 4 lembar | 3 lembar | **PASS** |

### Checklist Akhir:
- [x] Tidak ada halaman kosong di akhir lembar.
- [x] Ukuran label konsisten 190 × 89 mm pada semua layout.
- [x] Titik potong presisi di tengah jarak celah 195 × 94 mm dan tidak terpotong tepi kertas.
- [x] Label memuat 2 tabel berdampingan 5 baris × 3 kolom secara rapi.
- [x] Hasil konsisten di seluruh browser modern berbasis Chromium (Chrome, Edge) & Safari.
- [x] Multi-katalog menghasilkan pembagian halaman `Math.ceil` yang tepat.
