/**
 * Setup Database MariaDB Script
 * Jalankan: npm run setup:db
 */

import { initDatabase } from '../db/database';
import { SystemSetupService } from '../services/systemSetupService';
import { getErrorMessage } from '../utils/errorUtils';
import { loadLocalEnv, parseCliArgs, printBanner, promptSecret, promptText, promptYesNo } from './setupUtils';

async function main() {
  loadLocalEnv();
  const { flags } = parseCliArgs();

  if (flags.help) {
    printBanner('KONFIGURASI DATABASE MARIADB (.env & LIVE TEST)');
    console.log('Penggunaan:');
    console.log('  npm run setup:db                  (Mode interaktif)');
    console.log('  npm run setup:db -- --host localhost --port 3306 --name fieldops_inventory --user fieldops_user --password <sandi>\n');
    console.log('Opsi:');
    console.log('  --host <host>           Alamat server MariaDB (contoh: localhost / mariadb)');
    console.log('  --port <port>           Port MariaDB (default: 3306)');
    console.log('  --name <db_name>        Nama database');
    console.log('  --user <db_user>        Username database');
    console.log('  --password <pass>       Password user database');
    console.log('  --root-password <pass>  Password root MariaDB (opsional untuk Docker)');
    console.log('  --migrate               Jalankan inisialisasi skema & migrasi jika koneksi berhasil\n');
    process.exit(0);
  }

  printBanner('KONFIGURASI DATABASE MARIADB', 'Simpan ke .env & Uji Koneksi Langsung');
  const current = SystemSetupService.getMaskedSettings();

  const hasNonInteractiveFlags = Boolean(flags.host || flags.port || flags.name || flags.user || flags.password);

  const host = typeof flags.host === 'string'
    ? flags.host
    : hasNonInteractiveFlags
    ? current.database.host
    : await promptText('Host MariaDB', current.database.host || 'localhost');

  const port = typeof flags.port === 'string'
    ? flags.port
    : hasNonInteractiveFlags
    ? String(current.database.port)
    : await promptText('Port MariaDB', String(current.database.port || 3306));

  const name = typeof flags.name === 'string'
    ? flags.name
    : hasNonInteractiveFlags
    ? current.database.name
    : await promptText('Nama Database', current.database.name || 'fieldops_inventory');

  const user = typeof flags.user === 'string'
    ? flags.user
    : hasNonInteractiveFlags
    ? current.database.user
    : await promptText('Username Database', current.database.user || 'fieldops_user');

  const password = typeof flags.password === 'string'
    ? flags.password
    : hasNonInteractiveFlags
    ? ''
    : await promptSecret('Password Database User', current.database.password.hasValue);

  const rootPassword = typeof flags['root-password'] === 'string'
    ? flags['root-password']
    : '';

  console.log('\n[1/2] Menyimpan konfigurasi ke .env & menguji koneksi ke MariaDB...');
  const saveRes = await SystemSetupService.saveAndTestDatabase({
    host,
    port,
    name,
    user,
    password: password || undefined,
    rootPassword: rootPassword || undefined,
    reloadPool: false
  });

  const probe = saveRes.testResult;
  if (probe.connected) {
    console.log(`✅ Koneksi MariaDB BERHASIL! (${probe.host}:${probe.port}/${probe.database}, latency ${probe.latencyMs} ms)`);
    if (probe.serverVersion) {
      console.log(`   Versi Server  : ${probe.serverVersion}`);
    }
    console.log(`   Jumlah Tabel  : ${probe.tableCount}`);
    if (probe.hasCoreTables) {
      console.log('   Skema Inti    : Lengkap dan siap digunakan.\n');
    } else {
      console.log(`   Skema Inti    : Belum lengkap (${probe.missingCoreTables.join(', ')}).\n`);
    }

    const shouldMigrate = Boolean(flags.migrate) || (!probe.hasCoreTables && !hasNonInteractiveFlags && await promptYesNo('Jalankan inisialisasi & migrasi skema tabel sekarang?', true));
    if (shouldMigrate) {
      console.log('\n[2/2] Menjalankan migrasi database...');
      await initDatabase();
      console.log('✅ Migrasi skema selesai dijalankan.\n');
    }
  } else {
    console.log(`\n⚠️ Konfigurasi disimpan ke .env, namun koneksi ke MariaDB belum berhasil.`);
    console.log(`   Detail Galat  : ${probe.error || 'Tidak dapat menjangkau host MariaDB.'}`);
    console.log('   Tips          : Pastikan layanan MariaDB/Docker container sedang berjalan dan kredensial sesuai.\n');
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('❌ Gagal menjalankan setup:db:', getErrorMessage(err));
  process.exit(1);
});
