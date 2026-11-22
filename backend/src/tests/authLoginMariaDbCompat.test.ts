/**
 * Test Suite: MariaDB Strict Authentication & Session Compatibility + Login Diagnostics
 */

import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT_DIR, executeQuery, initDatabase, memoryStore } from '../db/database';
import { AuthService, sanitizeClientIp } from '../services/authService';
import { ConfirmationService } from '../services/confirmationService';
import { SessionService } from '../services/sessionService';
import { SystemSetupService } from '../services/systemSetupService';
import { TrashService } from '../services/trashService';
import { toMysqlUtcSeconds } from '../utils/timezone';

async function runTests() {
  console.log('================================================================');
  console.log('  PENGUJIAN AUTENTIKASI MARIADB STRICT COMPAT & DIAGNOSTIK LOGIN');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  await initDatabase();

  // 1. Format UTC SQL strict YYYY-MM-DD HH:mm:ss (tanpa 'T' dan 'Z')
  const sampleDate = new Date('2026-11-22T02:50:15.456Z');
  const formattedSql = toMysqlUtcSeconds(sampleDate);
  assert(
    formattedSql === '2026-11-22 02:50:15' && !formattedSql.includes('T') && !formattedSql.includes('Z'),
    'toMysqlUtcSeconds formats exact UTC YYYY-MM-DD HH:mm:ss compatible with MariaDB TIMESTAMP'
  );

  // 2. Sanitasi header x-forwarded-for agar tidak melebihi VARCHAR(45)
  const longForwardedFor =
    '2001:0db8:85a3:0000:0000:8a2e:0370:7334, 172.68.144.201, 10.0.0.12';
  const sanitized = sanitizeClientIp(longForwardedFor);
  assert(
    sanitized === '2001:0db8:85a3:0000:0000:8a2e:0370:7334' && sanitized.length <= 45,
    'sanitizeClientIp extracts first proxy IP and enforces <= 45 char limit'
  );

  const mappedIpv4 = sanitizeClientIp('::ffff:192.168.1.50, 10.0.0.1');
  assert(mappedIpv4 === '192.168.1.50', 'sanitizeClientIp normalizes ::ffff: IPv4-mapped address cleanly');

  const ultraLongIp = 'a'.repeat(80);
  assert(sanitizeClientIp(ultraLongIp).length === 45, 'sanitizeClientIp truncates abnormally long IP headers to 45 chars');

  // 3. Simulasi pembuatan akun seperti setup:admin (PBKDF2 100k SHA-256 + 16-byte salt)
  const testUserId = `usr-test-${Date.now()}`;
  const testUsername = `dev_diag_${Date.now()}`;
  const testPassword = 'SandiKuat#2026!';
  const { hash, salt } = AuthService.hashPassword(testPassword);

  await executeQuery(
    `INSERT INTO users (id, username, name, email, role, department, phone, password_hash, salt, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      testUserId,
      testUsername,
      'Dev Tester',
      `${testUsername}@fieldops.local`,
      'developer',
      'Core Engineering',
      '',
      hash,
      salt,
      'ACTIVE'
    ]
  );

  try {
    // 4. AuthService.login & SessionService.createSession dengan proxy header panjang
    const loginRes = await AuthService.login(testUsername, testPassword, longForwardedFor, 'Mozilla/5.0 Test');
    assert(loginRes.success && Boolean(loginRes.sessionToken) && loginRes.user?.username === testUsername, 'AuthService.login succeeds for setup:admin PBKDF2 account');

    const storedLegacySession = loginRes.sessionToken ? memoryStore.sessions.get(loginRes.sessionToken) : null;
    assert(
      Boolean(storedLegacySession && storedLegacySession.ip_address.length <= 45),
      'AuthService.login persists truncated IP <= 45 chars in sessions table'
    );

    const sessionRes = await SessionService.createSession(
      loginRes.user!,
      longForwardedFor,
      'Mozilla/5.0 Test'
    );
    assert(Boolean(sessionRes.accessToken) && Boolean(sessionRes.refreshToken), 'SessionService.createSession issues access and refresh tokens cleanly');

    const storedSesi = memoryStore.sesi.get(sessionRes.sessionId);
    assert(
      Boolean(storedSesi && storedSesi.ip.length <= 45 && !Number.isNaN(new Date(storedSesi.kedaluwarsa_mutlak).getTime())),
      'SessionService.createSession stores valid UTC expiry and IP <= 45 chars in sesi table'
    );

    const validated = await SessionService.validateSession(sessionRes.accessToken, sessionRes.deviceId);
    assert(validated.valid && validated.user?.id === testUserId, 'SessionService.validateSession validates newly created session');

    // 5. Diagnostik Login: Sukses untuk kredensial benar & tidak membocorkan hash/salt
    const diagOk = await SystemSetupService.runLoginDiagnostic({
      username: testUsername,
      password: testPassword,
      testSessionWrite: true
    });
    const diagSerialized = JSON.stringify(diagOk);
    assert(diagOk.overallSuccess === true, 'runLoginDiagnostic returns overallSuccess=true for valid active account');
    assert(
      diagOk.steps.every((s) => s.passed === true),
      'runLoginDiagnostic passes all 6 steps including live probe write & cleanup on sessions/sesi'
    );
    assert(
      !diagSerialized.includes(hash) && !diagSerialized.includes(salt),
      'runLoginDiagnostic never leaks password_hash or salt in diagnostic payload'
    );

    // 6. Diagnostik Login: Menolak kata sandi salah
    const diagWrongPass = await SystemSetupService.runLoginDiagnostic({
      username: testUsername,
      password: 'WrongPassword123',
      testSessionWrite: true
    });
    const passStep = diagWrongPass.steps.find((s) => s.key === 'password_verify');
    assert(
      diagWrongPass.overallSuccess === false && passStep?.passed === false,
      'runLoginDiagnostic accurately flags incorrect password'
    );

    // 7. Diagnostik Login: Akun tidak ditemukan
    const diagMissing = await SystemSetupService.runLoginDiagnostic({
      username: `tidak_ada_${Date.now()}`,
      password: 'abc'
    });
    assert(diagMissing.overallSuccess === false && Boolean(diagMissing.recommendation), 'runLoginDiagnostic reports missing account with clear recommendation');

    // 8. Audit SQL Timestamp: ConfirmationService & TrashService menggunakan format UTC MariaDB yang sah
    const confirmReq = await ConfirmationService.requestConfirmationToken({
      userId: testUserId,
      actionType: 'request_approve',
      targetId: 'req-audit-1',
      objectNameTyped: 'approve'
    });
    assert(confirmReq.success && Boolean(confirmReq.token), 'ConfirmationService.requestConfirmationToken succeeds with SQL UTC expiry');
    const consumeRes = await ConfirmationService.consumeConfirmationToken(
      confirmReq.token,
      testUserId,
      'request_approve',
      'req-audit-1'
    );
    assert(consumeRes.valid, 'ConfirmationService.consumeConfirmationToken validates UTC expiry cleanly');

    const trashRes = await TrashService.moveToTrash({
      jenis_objek: 'item',
      objek_id: `item-diag-${Date.now()}`,
      snapshot: { id: 'item-diag', name: 'Sample Modem' },
      dihapus_oleh: testUserId
    });
    const trashList = await TrashService.listTrash();
    const matchedTrash = trashList.find((t) => t.id === trashRes.trashId);
    assert(
      Boolean(matchedTrash && typeof matchedTrash.sisa_hari === 'number' && matchedTrash.sisa_hari >= 1),
      'TrashService.moveToTrash & listTrash compute retention cleanly using SQL UTC expiry'
    );

    // 9. Static invariant: Pastikan file layanan DB inti tidak lagi mengirim .toISOString() ke kueri SQL
    const auditedServices = [
      'backend/src/services/authService.ts',
      'backend/src/services/sessionService.ts',
      'backend/src/services/confirmationService.ts',
      'backend/src/services/trashService.ts',
      'backend/src/services/dataConsolidationService.ts'
    ];
    for (const relPath of auditedServices) {
      const code = fs.readFileSync(path.resolve(PROJECT_ROOT_DIR, relPath), 'utf-8');
      assert(
        !/\bexpiresAt\.toISOString\(|\bpurgeSetelah\.toISOString\(|\bkedaluwarsaMutlak\.toISOString\(/i.test(code),
        `${relPath} avoids .toISOString() in SQL TIMESTAMP parameters`
      );
    }
  } finally {
    await executeQuery('DELETE FROM users WHERE id = ?', [testUserId]).catch(() => {});
  }

  console.log(`\nHasil: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal error in authLoginMariaDbCompat.test.ts:', err);
  process.exit(1);
});
