/**
 * System Connection Check CLI Script
 * Jalankan: npm run setup:check
 */

import { initDatabase } from '../db/database';
import { SystemSetupService } from '../services/systemSetupService';
import { getErrorMessage } from '../utils/errorUtils';
import { loadLocalEnv, parseCliArgs, printBanner } from './setupUtils';

async function main() {
  loadLocalEnv();
  const { flags } = parseCliArgs();

  if (flags.help) {
    printBanner('PEMERIKSAAN KONEKSI & KESIAPAN SISTEM');
    console.log('Penggunaan:');
    console.log('  npm run setup:check');
    console.log('  npm run setup:check -- --url https://stok.domain.com');
    console.log('  npm run setup:check -- --json\n');
    process.exit(0);
  }

  await initDatabase();
  const publicUrl = typeof flags.url === 'string' ? flags.url : undefined;
  const report = await SystemSetupService.runSystemCheck({ publicUrl });

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.overallStatus === 'incomplete' ? 1 : 0);
  }

  printBanner('PEMERIKSAAN STATUS KONEKSI SISTEM', `Status Keseluruhan: ${report.overallStatus.toUpperCase()}`);

  for (const item of report.checks) {
    const icon =
      item.status === 'connected'
        ? '[TERHUBUNG]     '
        : item.status === 'warning'
        ? '[PERINGATAN]    '
        : '[BELUM DIATUR]  ';

    console.log(`${icon} ${item.label}`);
    console.log(`                  Ringkasan : ${item.summary}`);
    console.log(`                  Detail    : ${item.details}`);
    if (item.hint) {
      console.log(`                  Saran     : ${item.hint}`);
    }
    if (item.cliCommand) {
      console.log(`                  Perintah  : ${item.cliCommand}`);
    }
    console.log('');
  }

  console.log('Untuk melihat semua perintah setup yang tersedia, jalankan: npm run setup:help\n');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('❌ Gagal menjalankan setup:check:', getErrorMessage(err));
  process.exit(1);
});
