/**
 * Login & Session Diagnostic CLI Script
 * Jalankan: npm run setup:test-login -- --username developer --password <sandi>
 */

import { getDbRuntimeStatus, initDatabase } from '../db/database';
import { SystemSetupService } from '../services/systemSetupService';
import { getErrorMessage } from '../utils/errorUtils';
import { loadLocalEnv, parseCliArgs, printBanner, promptSecret, promptText } from './setupUtils';

async function main() {
  loadLocalEnv();
  const { flags } = parseCliArgs();

  if (flags.help) {
    printBanner('DIAGNOSTIK TES LOGIN & KESIAPAN SESI AKUN');
    console.log('Penggunaan:');
    console.log('  npm run setup:test-login');
    console.log('  npm run setup:test-login -- --username developer --password <sandi>');
    console.log('  npm run setup:test-login -- --username developer --json\n');
    process.exit(0);
  }

  await initDatabase();
  const dbStatus = getDbRuntimeStatus();

  const username = typeof flags.username === 'string'
    ? flags.username.trim()
    : await promptText('Masukkan Username yang akan diuji', 'developer');

  const password = typeof flags.password === 'string'
    ? flags.password
    : await promptSecret('Masukkan Kata Sandi (opsional, Enter untuk cek struktur saja)', false);

  const diagnostic = await SystemSetupService.runLoginDiagnostic({
    username,
    password: password || undefined,
    testSessionWrite: true
  });

  if (flags.json) {
    console.log(JSON.stringify(diagnostic, null, 2));
    process.exit(diagnostic.overallSuccess ? 0 : 1);
  }

  printBanner(
    'HASIL DIAGNOSTIK TES LOGIN AKUN',
    `Akun: ${diagnostic.username} | Mode DB: ${
      diagnostic.runtimeMode === 'mariadb'
        ? `MariaDB (${dbStatus.host}:${dbStatus.port}/${dbStatus.database})`
        : 'Memori Lokal'
    }`
  );

  for (const step of diagnostic.steps) {
    const badge = step.passed ? '[OK]   ' : '[GAGAL]';
    console.log(`${badge} ${step.label}`);
    console.log(`        ${step.detail}\n`);
  }

  if (diagnostic.recommendation) {
    console.log(`💡 Saran Perbaikan: ${diagnostic.recommendation}\n`);
  }

  console.log(
    diagnostic.overallSuccess
      ? '✅ Kesimpulan: Akun dan skema sesi SIAP untuk login.\n'
      : '❌ Kesimpulan: Ditemukan kendala pada alur autentikasi akun di atas.\n'
  );

  process.exit(diagnostic.overallSuccess ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('❌ Gagal menjalankan setup:test-login:', getErrorMessage(err));
  process.exit(1);
});
