import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' RUNNING TESTS: FieldOps v1.2.5 Paket 7 (Branding & Logo Baru)');
  console.log('================================================================\n');

  const rootDir = process.cwd();

  // 1. Keberadaan Aset Statis Logo Baru
  await test('File aset logo kubus baru tersedia lengkap di frontend/public dan public', () => {
    const requiredFiles = [
      'frontend/public/logo.png',
      'frontend/public/logo.webp',
      'public/logo.png',
      'public/logo.webp',
      'frontend/public/pwa-192x192.png',
      'frontend/public/pwa-512x512.png',
      'frontend/public/pwa-maskable-512x512.png',
      'frontend/public/apple-touch-icon.png'
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(rootDir, file);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File aset wajib tidak ditemukan: ${file}`);
      }
      const stat = fs.statSync(fullPath);
      if (stat.size === 0) {
        throw new Error(`File aset kosong: ${file}`);
      }
    }
  });

  // 2. Batas Ukuran Cache PWA (< 5 MB)
  await test('Ukuran seluruh aset branding sangat efisien dan jauh di bawah batas cache PWA (5 MB)', () => {
    const files = [
      'frontend/public/logo.png',
      'frontend/public/logo.webp',
      'frontend/public/pwa-192x192.png',
      'frontend/public/pwa-512x512.png',
      'frontend/public/pwa-maskable-512x512.png',
      'frontend/public/apple-touch-icon.png'
    ];

    let totalBytes = 0;
    for (const f of files) {
      totalBytes += fs.statSync(path.join(rootDir, f)).size;
    }

    const totalKB = totalBytes / 1024;
    console.log(`    Total ukuran aset branding: ${totalKB.toFixed(2)} KB`);
    if (totalBytes > 5 * 1024 * 1024) {
      throw new Error(`Ukuran aset melebihi 5 MB: ${totalBytes} bytes`);
    }
  });

  // 3. Konfigurasi Favicon dan Meta Icons di index.html
  await test('frontend/index.html mengonfigurasi favicon, shortcut icon, dan apple-touch-icon', () => {
    const indexPath = path.join(rootDir, 'frontend/index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    if (!content.includes('apple-touch-icon') || !content.includes('/apple-touch-icon.png')) {
      throw new Error('index.html belum mengonfigurasi apple-touch-icon dengan /apple-touch-icon.png');
    }
    if (!content.includes('rel="icon"') || !content.includes('/logo.png')) {
      throw new Error('index.html belum mengonfigurasi favicon dengan /logo.png');
    }
    if (!content.includes('rel="shortcut icon"') || !content.includes('/logo.png')) {
      throw new Error('index.html belum mengonfigurasi shortcut icon dengan /logo.png');
    }
  });

  // 4. Struktur Top Navigation di Navbar.tsx
  await test('Navbar.tsx mengonfigurasi [Kotak Logo] + Teks "FieldOps IT" + Dropdown Chevron', () => {
    const navPath = path.join(rootDir, 'frontend/src/components/Navbar.tsx');
    const content = fs.readFileSync(navPath, 'utf-8');

    // Cek kotak logo berlatar terang (putih/abu muda)
    if (!content.includes('rounded-xl bg-white dark:bg-slate-100') && !content.includes('bg-white dark:bg-slate-100')) {
      throw new Error('Kotak logo harus berlatar terang (bg-white dark:bg-slate-100).');
    }

    // Cek logo baru
    if (!content.includes('src="/logo.webp"')) {
      throw new Error('Logo pada navbar harus memuat /logo.webp');
    }

    // Cek teks FieldOps IT tebal
    if (!content.includes('FieldOps IT') || !content.includes('font-extrabold')) {
      throw new Error('Teks FieldOps IT harus tebal (font-extrabold).');
    }

    // Cek responsif: teks disembunyikan di layar HP
    if (!content.includes('hidden sm:inline-block') && !content.includes('hidden sm:flex')) {
      throw new Error('Teks FieldOps IT harus disembunyikan di layar sempit/HP (hidden sm:inline-block).');
    }

    // Cek chevron dropdown
    if (!content.includes('ChevronDown')) {
      throw new Error('Ikon panah dropdown (ChevronDown) harus tersedia di sisi kanan blok logo.');
    }
  });

  // 5. Konsistensi Logo di Seluruh Komponen Aplikasi
  await test('Logo baru diterapkan secara konsisten di LoginScreen, UserRoleSwitcher, Cetak Laporan, Cetak Label, dan Footer', () => {
    // 5a. LoginScreen
    const loginContent = fs.readFileSync(path.join(rootDir, 'frontend/src/components/LoginScreen.tsx'), 'utf-8');
    if (!loginContent.includes('src="/logo.webp"')) {
      throw new Error('LoginScreen.tsx harus menggunakan /logo.webp');
    }

    // 5b. UserRoleSwitcher
    const switcherContent = fs.readFileSync(path.join(rootDir, 'frontend/src/components/UserRoleSwitcher.tsx'), 'utf-8');
    if (!switcherContent.includes('src="/logo.webp"')) {
      throw new Error('UserRoleSwitcher.tsx harus menggunakan /logo.webp');
    }

    // 5c. PrintReportModal (Kop Surat Resmi)
    const reportContent = fs.readFileSync(path.join(rootDir, 'frontend/src/components/reports/PrintReportModal.tsx'), 'utf-8');
    if (!reportContent.includes('src="/logo.webp"')) {
      throw new Error('PrintReportModal.tsx harus menggunakan /logo.webp pada Kop Surat');
    }

    // 5d. BatchLabelPrintModal (Label Cetak QR A4)
    const labelContent = fs.readFileSync(path.join(rootDir, 'frontend/src/components/BatchLabelPrintModal.tsx'), 'utf-8');
    if (!labelContent.includes('src="/logo.png"')) {
      throw new Error('BatchLabelPrintModal.tsx harus menggunakan /logo.png pada header kartu label');
    }

    // 5e. App.tsx (Footer)
    const appContent = fs.readFileSync(path.join(rootDir, 'frontend/src/App.tsx'), 'utf-8');
    if (!appContent.includes('src="/logo.webp"')) {
      throw new Error('App.tsx harus menggunakan /logo.webp pada footer');
    }
  });

  // 6. Konfigurasi PWA Manifest di vite.config.ts
  await test('frontend/vite.config.ts mendaftarkan aset logo baru dalam includeAssets PWA', () => {
    const viteConfigPath = path.join(rootDir, 'frontend/vite.config.ts');
    const content = fs.readFileSync(viteConfigPath, 'utf-8');

    if (!content.includes("'logo.png'") || !content.includes("'logo.webp'")) {
      throw new Error('vite.config.ts belum mendaftarkan logo.png dan logo.webp dalam includeAssets');
    }
    if (!content.includes('/pwa-192x192.png') || !content.includes('/pwa-512x512.png')) {
      throw new Error('vite.config.ts belum mendaftarkan icon pwa 192x192 dan 512x512');
    }
  });

  console.log('\n================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(` HASIL PENGUJIAN PAKET 7: ${passedCount}/${results.length} PASS (${failedCount} GAGAL)`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
