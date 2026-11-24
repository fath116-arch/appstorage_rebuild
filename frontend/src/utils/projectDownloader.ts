/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { APP_VERSION } from '../constants/version';

export interface ExportDataPayload {
  products: any[];
  jenisList: any[];
  transactions: any[];
  apiKeys?: any[];
  integrationLogs?: any[];
  currentUser?: any;
}

export function sanitizeBackupPayload(data: ExportDataPayload): ExportDataPayload {
  const sanitized = JSON.parse(JSON.stringify(data));

  // Strip sensitive credentials (passwordHash & salt) from currentUser
  if (sanitized.currentUser) {
    delete sanitized.currentUser.passwordHash;
    delete sanitized.currentUser.salt;
  }

  // If users array exists, strip credentials
  if (Array.isArray((sanitized as any).users)) {
    (sanitized as any).users.forEach((u: any) => {
      delete u.passwordHash;
      delete u.salt;
    });
  }

  // Mask API keys
  if (Array.isArray(sanitized.apiKeys)) {
    sanitized.apiKeys = sanitized.apiKeys.map((k: any) => ({
      ...k,
      key: typeof k.key === 'string' && k.key.length > 12
        ? `${k.key.slice(0, 10)}...${k.key.slice(-4)}`
        : 'fops_demo_masked_key'
    }));
  }

  return sanitized;
}

export function downloadJsonBackup(data: ExportDataPayload) {
  const sanitizedData = sanitizeBackupPayload(data);
  const jsonString = JSON.stringify(sanitizedData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fieldops-it-inventory-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadProjectZip(currentData?: ExportDataPayload): Promise<void> {
  const zip = new JSZip();

  // 1. package.json
  const packageJson = {
    "name": "fieldops-it-inventory",
    "private": true,
    "version": "0.2.4",
    "type": "module",
    "scripts": {
      "dev": "vite --port=3000 --host=0.0.0.0",
      "build": "tsc && vite build",
      "preview": "vite preview"
    },
    "dependencies": {
      "@tailwindcss/vite": "^4.3.3",
      "@vitejs/plugin-react": "^6.1.1",
      "jszip": "^3.10.1",
      "lucide-react": "^0.546.0",
      "motion": "^12.23.24",
      "qrcode": "^1.5.4",
      "react": "^19.0.1",
      "react-dom": "^19.0.1",
      "react-is": "^19.3.1",
      "recharts": "^2.15.1",
      "tailwindcss": "^4.3.3",
      "vite": "^8.3.0"
    },
    "devDependencies": {
      "@types/jszip": "^3.4.1",
      "@types/node": "^22.14.0",
      "@types/qrcode": "^1.5.5",
      "@types/react": "^19.3.0",
      "@types/react-dom": "^19.3.0",
      "@types/react-is": "^19.0.0",
      "typescript": "^7.0.2"
    }
  };
  zip.file("package.json", JSON.stringify(packageJson, null, 2));
  zip.file(".npmrc", "legacy-peer-deps=true\n");
  zip.file(".env.example", `# Salin file ini menjadi '.env' untuk konfigurasi lokal & Cloudflare Tunnel:
#   Windows CMD : copy .env.example .env
#   Linux/Mac   : cp .env.example .env

PORT=3000
APP_URL="http://localhost:3000"
VITE_APP_TITLE="FieldOps IT - Inventarisasi Lapangan"
GEMINI_API_KEY=""
`);

  // 2. tsconfig.json
  const tsConfig = {
    "compilerOptions": {
      "target": "ES2022",
      "useDefineForClassFields": true,
      "module": "ESNext",
      "types": ["vite/client"],
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "isolatedModules": true,
      "moduleDetection": "force",
      "jsx": "react-jsx",
      "paths": {
        "@/*": ["./*"]
      },
      "noEmit": true
    },
    "include": ["src"]
  };
  zip.file("tsconfig.json", JSON.stringify(tsConfig, null, 2));

  // 3. vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
`;
  zip.file("vite.config.ts", viteConfig);

  // 4. index.html
  const indexHtml = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FieldOps IT - Inventarisasi & Integrasi Tiket Lapangan</title>
    <meta name="description" content="Aplikasi manajemen inventori teknisi IT lapangan dengan UI smartphone, ekspor Excel, enkripsi Web Crypto SHA-256, dan integrasi Cloudflare Tunnel." />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="bg-slate-50 text-slate-900 font-sans antialiased min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  zip.file("index.html", indexHtml);

  // 5. README.md
  const readme = `# FieldOps IT - Aplikasi Inventori & Integrasi Tiket Lapangan (v${APP_VERSION})

Aplikasi manajemen inventori data barang untuk teknisi IT lapangan dengan fitur:
- Responsive Smartphone UI & Menu Dropdown Compact Header
- Ekspor katalog inventori & laporan mutasi stok ke Excel (.xlsx)
- Keamanan & Hashing Kata Sandi Akun PBKDF2 (100k SHA-256) & CWE-1236 Sanitization
- Pengerasan Keamanan Firestore Rules (isSignedIn) & Security Headers (SEC-01 s/d SEC-05)
- Ketersediaan stok fisik real-time & Barcode Scanning
- Dashboard Analisis Tren 30 Hari & Top-Moving Items (Recharts)
- Laporan stok mingguan (Weekly Report) dengan export Excel & CSV
- Input barang masuk (Restock/PO) & Output barang keluar (Tiket Lapangan)
- Akun pengguna dengan Role-Based Access Control (Teknisi, Admin, Developer)
- Integrasi Sistem Tiket Eksternal (Auto-deduct stok via API/Webhook)

## 🚀 Fitur & Perbaikan Utama Rilis v${APP_VERSION}:
1. **Smartphone UI & Dropdown Navigation:** Menu dropdown compact header & touch drawer untuk kemudahan penggunaan di layar seluler.
2. **Ekspor Format Excel (.xlsx):** Download data inventori & laporan dalam format spreadsheet Excel lengkap dengan header berwarna dan formula total.
3. **Enkripsi Akun Web Crypto SHA-256:** Hashing kata sandi akun dengan salt untuk pengamanan wewenang teknisi dan admin.
4. **Dark Mode UI Harmony & Fixes:** Penyempurnaan tema gelap secara menyeluruh untuk header dropdown, sub-dropdown, garis divider vertikal/horizontal, badge profil, dan pop-up profil pengguna.

## Cara Menjalankan di Komputer Lokal:

1. **Pastikan Node.js terinstall** (versi 18+ atau 20+ disarankan).
2. **Ekstrak file zip ini** ke sebuah folder di komputer Anda.
3. Buka terminal / command prompt di folder tersebut, lalu jalankan:
   \`\`\`bash
   npm install
   \`\`\`
4. Salin file konfigurasi lingkungan:
   \`\`\`bash
   # Windows CMD:
   copy .env.example .env

   # macOS / Linux / Git Bash:
   cp .env.example .env
   \`\`\`
5. Jalankan aplikasi:
   \`\`\`bash
   npm run dev
   \`\`\`
6. Hubungkan ke Cloudflare Tunnel (Opsional untuk Akses Remote):
   \`\`\`bash
   cloudflared tunnel --url http://localhost:3000
   \`\`\`

## Build untuk Production:
\`\`\`bash
npm run build
\`\`\`
File static akan berada di folder \`dist/\`.
`;
  zip.file("README.md", readme);

  // 6. If data is passed, add sanitized data-backup.json
  if (currentData) {
    const sanitizedData = sanitizeBackupPayload(currentData);
    zip.file("data-backup.json", JSON.stringify(sanitizedData, null, 2));
  }

  // Fetch or add src code files
  const srcFiles = [
    '/src/main.tsx',
    '/src/App.tsx',
    '/src/index.css',
    '/src/types/inventory.ts',
    '/src/context/InventoryContext.tsx',
    '/src/utils/security.ts',
    '/src/utils/timezone.ts',
    '/src/utils/excelExporter.ts',
    '/src/services/catalogApi.ts',
    '/src/services/stockApi.ts',
    '/src/services/requestApi.ts',
    '/src/services/activityApi.ts',
    '/src/components/Navbar.tsx',
    '/src/components/Dashboard.tsx',
    '/src/components/InventoryCatalog.tsx',
    '/src/components/catalog/CatalogV2Manager.tsx',
    '/src/components/stock/StockInputModal.tsx',
    '/src/components/stock/TransactionAttributionFields.tsx',
    '/src/components/StockInOutModal.tsx',
    '/src/components/TransactionHistory.tsx',
    '/src/components/requests/TechnicianRequestsView.tsx',
    '/src/components/WeeklyReport.tsx',
    '/src/components/TicketIntegrationHub.tsx',
    '/src/components/FieldTripChecklistModal.tsx',
    '/src/components/PrintDocumentModal.tsx',
    '/src/components/UserRoleSwitcher.tsx',
    '/src/components/DownloadModal.tsx',
    '/src/components/GoLiveModal.tsx',
    '/src/components/MobileAccessModal.tsx',
    '/src/components/ToastContainer.tsx',
  ];

  for (const filePath of srcFiles) {
    try {
      const res = await fetch(filePath);
      if (res.ok) {
        const text = await res.text();
        const relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        zip.file(relativePath, text);
      }
    } catch (e) {
      console.warn(`Could not fetch ${filePath} directly`, e);
    }
  }

  // Generate zip blob and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fieldops-it-inventory-v${APP_VERSION}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
