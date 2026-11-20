/**
 * Setup Command Directory & Help CLI Script
 * Jalankan: npm run setup:help  atau  npm run setup:list
 */

import { SystemSetupService } from '../services/systemSetupService';
import { printBanner } from './setupUtils';

function main() {
  printBanner('DAFTAR PERINTAH SETUP & UTILITAS CLI', 'FieldOps IT Inventory');

  const catalog = SystemSetupService.getCliScriptCatalog();
  const groups: Array<{ key: 'setup' | 'maintenance' | 'runtime'; title: string }> = [
    { key: 'setup', title: '1. Perintah Setup & Diagnostik Infrastruktur (setup:*)' },
    { key: 'maintenance', title: '2. Perintah Pemeliharaan Data & Pengujian' },
    { key: 'runtime', title: '3. Perintah Pengembangan & Produksi' }
  ];

  for (const group of groups) {
    console.log(group.title);
    console.log('----------------------------------------------------------------');
    const items = catalog.filter((entry) => entry.category === group.key);
    for (const item of items) {
      console.log(`  ${item.command}`);
      console.log(`    Fungsi : ${item.summary}`);
      if (item.flags) {
        console.log(`    Contoh : ${item.command} ${item.flags}`);
      }
    }
    console.log('');
  }

  process.exit(0);
}

main();
