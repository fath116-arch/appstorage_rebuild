/**
 * Setup Master Admin Script
 * Jalankan di server lokal: npm run setup:admin
 */

import { executeQuery, getDbRuntimeStatus, initDatabase } from '../db/database';
import { AuthService } from '../services/authService';
import { getErrorMessage } from '../utils/errorUtils';
import { loadLocalEnv, parseCliArgs, printBanner, promptSecret, promptText, promptYesNo } from './setupUtils';

async function main() {
  loadLocalEnv();
  const { flags } = parseCliArgs();

  if (flags.help) {
    printBanner('INISIALISASI AKUN ADMIN / DEVELOPER');
    console.log('Penggunaan:');
    console.log('  npm run setup:admin');
    console.log('  npm run setup:admin -- --username developer --password <sandi> --role developer --email dev@fieldops.local\n');
    process.exit(0);
  }

  printBanner('INISIALISASI AKUN MASTER ADMIN PERTAMA');

  const dbInit = await initDatabase();
  const dbStatus = getDbRuntimeStatus();

  if (!dbInit.isMariaDb) {
    console.warn('⚠️  PERINGATAN: MariaDB belum terhubung! Akun akan tersimpan ke mode memori lokal sementara.');
    console.warn('    Jika Anda ingin menyimpan ke MariaDB, jalankan "npm run setup:db" terlebih dahulu.\n');
  } else {
    console.log(`🗄️  Target Database: MariaDB (${dbStatus.host}:${dbStatus.port}/${dbStatus.database})\n`);
  }

  const rawUsername = typeof flags.username === 'string'
    ? flags.username
    : await promptText('Masukkan Username [developer / admin]', 'developer');
  const username = rawUsername.trim() || 'developer';

  const rawName = typeof flags.name === 'string'
    ? flags.name
    : await promptText('Masukkan Nama Lengkap', 'Lead System Developer');
  const name = rawName.trim() || 'Lead System Developer';

  const rawEmail = typeof flags.email === 'string'
    ? flags.email
    : await promptText('Masukkan Email', `${username.toLowerCase()}@fieldops.local`);
  const email = rawEmail.trim() || `${username.toLowerCase()}@fieldops.local`;

  const rawRole = typeof flags.role === 'string'
    ? flags.role
    : await promptText('Masukkan Peran Akun [developer / admin / warehouse_admin / technician]', 'developer');
  const roleNormalized = rawRole.trim().toLowerCase();
  const role = ['developer', 'admin', 'warehouse_admin', 'technician', 'superadmin', 'supervisor'].includes(roleNormalized)
    ? (roleNormalized === 'superadmin' ? 'developer' : roleNormalized === 'supervisor' ? 'admin' : roleNormalized)
    : 'developer';

  let password = typeof flags.password === 'string' ? flags.password.trim() : '';
  while (!password) {
    password = (await promptSecret('Masukkan Kata Sandi', false)).trim();
  }

  const existing = await executeQuery<{ id: string; username: string }>(
    'SELECT id, username FROM users WHERE LOWER(TRIM(username)) = LOWER(?) OR LOWER(TRIM(email)) = LOWER(?)',
    [username, email]
  );

  if (existing.length > 0) {
    console.log(`\n⚠️ User dengan username "${username}" atau email "${email}" sudah ada (ID: ${existing[0].id}).`);
    const shouldOverwrite = flags.force
      ? true
      : await promptYesNo('Apakah Anda ingin mereset kata sandi dan mengaktifkan akun ini?', false);

    if (shouldOverwrite) {
      const { hash, salt } = AuthService.hashPassword(password);
      await executeQuery(
        'UPDATE users SET password_hash = ?, salt = ?, role = ?, status = "ACTIVE" WHERE id = ?',
        [hash, salt, role, existing[0].id]
      );
      const verified = AuthService.verifyPassword(password, salt, hash);
      console.log(`\n✅ Kata sandi & peran (${role}) akun "${username}" berhasil direset dan berstatus ACTIVE.`);
      console.log(`   Verifikasi hash PBKDF2: ${verified ? 'COCOK' : 'GAGAL'}`);
      console.log('   Jalankan "npm run setup:test-login" bila ingin menguji kesiapan login & sesi.\n');
    }
    process.exit(0);
  }

  const userId = `usr-master-${Date.now()}`;
  const { hash, salt } = AuthService.hashPassword(password);

  await executeQuery(
    `INSERT INTO users (id, username, name, email, role, department, phone, password_hash, salt, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      username,
      name,
      email,
      role,
      role === 'developer' ? 'Core Architecture & System Engineering' : 'IT Operations & Warehouse',
      '',
      hash,
      salt,
      'ACTIVE'
    ]
  );

  const verified = AuthService.verifyPassword(password, salt, hash);

  console.log('\n✅ Akun Server-Side Berhasil Dibuat!');
  console.log(`   Target DB       : ${dbInit.isMariaDb ? `MariaDB (${dbStatus.database})` : 'Memori Lokal'}`);
  console.log(`   User ID         : ${userId}`);
  console.log(`   Username        : ${username}`);
  console.log(`   Email           : ${email}`);
  console.log(`   Peran           : ${role} (Status: ACTIVE)`);
  console.log(`   Verifikasi Hash : ${verified ? 'COCOK (PBKDF2 SHA-256 100.000 iterasi)' : 'PERLU CEK'}\n`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('❌ Gagal menjalankan setup:admin:', getErrorMessage(err));
  process.exit(1);
});

