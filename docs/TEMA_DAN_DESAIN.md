# Sistem Tema, Desain & Responsivitas - FieldOps IT (v1.2.7)

Dokumen ini memuat spesifikasi sistem desain, token warna CSS di `frontend/src/index.css`, disiplin *Dark Mode & Zero-Pill*, tipografi, responsivitas layout, serta isolasi cetak A4 pada **FieldOps IT (`v1.2.7`)**.

---

## 🎨 1. Palette Warna & Token Desain (`frontend/src/index.css`)

Aplikasi menggunakan **Tailwind CSS v4** (`@import "tailwindcss";` dengan `@custom-variant dark (&:where(.dark, .dark *));`) dan variabel CSS terstruktur:

### A. Tema Terang (Light Mode)
- **Background Halaman**: `--color-bg-page: #f8fafc` (`bg-slate-50`) dengan aksen radial halus.
- **Card / Surface**: `--color-surface-card: #ffffff` (`bg-white`) & efek frosted glass `.glass` (`rgba(255, 255, 255, 0.65)`, `backdrop-filter: blur(14px)`).
- **Teks Utama & Sekunder**: `--color-text-main: #0f172a` (`text-slate-900`), `--color-text-sub: #475569` (`text-slate-600`), `--color-text-muted: #64748b` (`text-slate-500`).
- **Border**: `--color-border-default: #e2e8f0` (`border-slate-200`).
- **Primary Brand**: `--color-brand-primary: #0f172a` (`slate-900`) & aksen operasional **Emerald** (`--color-accent-emerald: #10b981`) di samping aksen biru (`blue-600`) pada kontrol aksi tertentu.

### B. Tema Gelap (Dark Mode)
- **Background Halaman**: `--color-bg-page: #0f172a` (`bg-slate-900`) dan latar belakang tubuh `#020617` (`bg-slate-950`).
- **Card / Surface**: `--color-surface-card: #1e293b` (`dark:bg-slate-800` / `dark:bg-slate-900`) agar tetap kontras jelas dengan latar belakang utama, plus `.glass` gelap (`rgba(15, 23, 42, 0.65)`).
- **Teks Utama & Sekunder (WCAG AA)**: `--color-text-main: #f8fafc` (`dark:text-slate-50` / `dark:text-slate-100`), `--color-text-sub: #cbd5e1` (`dark:text-slate-300`), `--color-text-muted: #94a3b8` (`dark:text-slate-400`).
- **Border**: `--color-border-subtle: #1e293b` (`dark:border-slate-800`) dan `--color-border-default: #334155` (`dark:border-slate-700`).
- **Primary Brand & Aksen**: `--color-brand-primary: #10b981` (`emerald-500`) & `--color-accent-emerald: #34d399` (`emerald-400`).

### C. Token Status Semantik
- **Success / Aman**: `emerald-50` / `emerald-700` (terang) & `emerald-300` (gelap).
- **Warning / Menipis**: `amber-50` / `amber-700` (terang) & `amber-300` (gelap).
- **Danger / Habis / Rusak**: `rose-50` / `rose-700` (terang) & `rose-300` (gelap).

### D. Tipografi
- **UI & Display**: `Inter`, `Plus Jakarta Sans`, `Outfit`, `system-ui, sans-serif`.
- **Metrik, Kode SKU/SN, & Timestamp WIB**: `Space Mono`, `JetBrains Mono`, `monospace` dengan `font-variant-numeric: tabular-nums`.

---

## 🚫 2. Disiplin Zero-Pill & Perbaikan Border Gelap

1. **Pembersihan Garis Pemisah Menu (Zero-Pill Border)**:
   - Dilarang menambahkan border putih mencolok pada elemen navigasi atau submenu di tema gelap; gunakan border halus `dark:border-slate-800/60` atau `dark:border-slate-700`.
2. **Kontrol Profil & Kotak Logo Top Navigation**:
   - Avatar profil pengguna di header menggunakan `dark:bg-slate-800/80` dengan teks `dark:text-slate-200` (menghilangkan pill putih terang).
   - Kotak Logo kiri atas (`rounded-xl`, `bg-white` / `dark:bg-slate-100`) menjaga logo kubus tetap tajam di mode terang maupun gelap, dengan teks `"FieldOps IT"` responsif (`hidden sm:inline-block` pada layar sempit).
3. **Modal & Dialog In-App (Tanpa `alert`/`confirm`/`prompt` Native)**:
   - Seluruh notifikasi aksi dan konfirmasi destruktif menggunakan `ToastContext` dan komponen modal in-app (`ConfirmDeleteModal.tsx` & modal penolakan/selesai request) agar kompatibel dengan runtime iframe dan tetap mengikuti tema aktif.

---

## 📱 3. Responsivitas & Isolasi Cetak A4

- **Breakpoints & Layout Mobile**:
  - `sm` (640px), `md` (768px), `lg` (1024px).
  - Navigasi menggunakan top navbar adaptif dengan drawer/menu seluler di layar sempit serta pembungkus tabel `overflow-x-auto`.
- **Isolasi Cetak A4 (`@media print` & `.print-sheet`)**:
  - Aturan `@page { size: A4 portrait; margin: 0; }` otomatis memaksa warna cetak terang (putih/hitam) dan menyembunyikan navbar, footer, serta kontrol interaktif (`.no-print { display: none !important; }`).
  - Lembar cetak label QR Batch (`BatchLabelPrintModal.tsx`) menggunakan `.print-sheet` berdimensi presisi **`210mm × 296mm`** (`overflow: hidden`) dengan kartu label `190 × 89 mm` agar cetak 1–3 label selalu tepat dalam 1 halaman A4.
