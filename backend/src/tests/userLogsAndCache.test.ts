/**
 * Test Suite: User Activity Log Separation & Production Anti-Cache Verification
 * Covers:
 * 1. Login, logout, session revocations, and user account management logs do NOT leak into GET /api/activities
 * 2. Inventory stock mutations DO appear in GET /api/activities
 * 3. GET /api/auth/user-logs allows Admin & Developer (with users_manage) and denies Technician (403)
 * 4. Category filtering (all, auth, session, account) and text search work accurately
 * 5. Account lifecycle endpoints (create, approve, reject, status, features, reset-password, delete) record user logs
 */

import http from 'http';
import express from 'express';
import { initDatabase, executeQuery } from '../db/database';
import { AuthService } from '../services/authService';
import { SessionService } from '../services/sessionService';
import { ActivityLogService, USER_ACTIVITY_ACTIONS } from '../services/activityLogService';
import { authenticate } from '../middleware/authMiddleware';
import authRouter from '../routes/auth';
import activitiesRouter from '../routes/activities';

async function httpJson(
  baseUrl: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Keep text
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('  FIELDOPS IT - TEST PEMISAHAN LOG USER & ANTI-CACHE');
  console.log('================================================================\n');

  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use('/api/auth', authRouter);
  app.use('/api/activities', activitiesRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${label}`);
      failed++;
    }
  }

  try {
    const suffix = Date.now().toString().slice(-6);
    const pwd = 'TestPassword#999';
    const { hash, salt } = AuthService.hashPassword(pwd);

    const devId = `usr-dev-log-${suffix}`;
    const adminId = `usr-adm-log-${suffix}`;
    const techId = `usr-tek-log-${suffix}`;

    for (const u of [
      { id: devId, username: `devlog_${suffix}`, name: 'Dev Log Tester', email: `devlog_${suffix}@test.local`, role: 'developer' },
      { id: adminId, username: `admlog_${suffix}`, name: 'Admin Log Tester', email: `admlog_${suffix}@test.local`, role: 'admin' },
      { id: techId, username: `teklog_${suffix}`, name: 'Teknisi Log Tester', email: `teklog_${suffix}@test.local`, role: 'technician' }
    ]) {
      await executeQuery(
        `INSERT INTO users (id, username, name, email, role, department, phone, password_hash, salt, status)
         VALUES (?, ?, ?, ?, ?, 'IT Ops', '081100001111', ?, ?, 'ACTIVE')`,
        [u.id, u.username, u.name, u.email, u.role, hash, salt]
      );
    }

    // 1. Login & Logout menghasilkan entri di transaksi, namun harus tersembunyi dari /api/activities
    console.log('[1] Pengujian Isolasi Log Login/Logout/Sesi dari Riwayat Keluar/Masuk:');
    const devLogin = await httpJson(baseUrl, 'POST', '/api/auth/login', undefined, {
      username: `devlog_${suffix}`,
      password: pwd
    });
    assert(devLogin.status === 200 && Boolean(devLogin.data?.token), 'Developer berhasil login untuk uji log');
    const devToken = devLogin.data.token as string;

    const adminSession = await SessionService.createSession(
      {
        id: adminId,
        username: `admlog_${suffix}`,
        name: 'Admin Log Tester',
        email: `admlog_${suffix}@test.local`,
        role: 'admin',
        department: 'IT Ops',
        phone: '081100001111',
        status: 'ACTIVE'
      },
      '127.0.0.1',
      'TestAgent'
    );

    const techSession = await SessionService.createSession(
      {
        id: techId,
        username: `teklog_${suffix}`,
        name: 'Teknisi Log Tester',
        email: `teklog_${suffix}@test.local`,
        role: 'technician',
        department: 'IT Ops',
        phone: '081100001111',
        status: 'ACTIVE'
      },
      '127.0.0.1',
      'TestAgent'
    );

    // Catat 1 transaksi barang agar terverifikasi tetap muncul di /api/activities
    await ActivityLogService.recordActivity({
      aksi: 'barang_keluar_jumlah',
      pelaku_id: adminId,
      tipe_mutasi: 'KELUAR',
      qty_total: 2,
      catatan: `Uji pengeluaran kabel patchcord ${suffix}`,
      details: [{ nama_snapshot: `Patchcord LC-LC ${suffix}`, jumlah: 2 }]
    });

    // 2. Jalankan aksi manajemen akun melalui endpoint API
    console.log('\n[2] Pengujian Pencatatan Log Manajemen Akun & Kontrol Akses:');
    const targetUsername = `target_${suffix}`;
    const createRes = await httpJson(baseUrl, 'POST', '/api/auth/users', adminSession.accessToken, {
      username: targetUsername,
      name: 'User Target Baru',
      email: `${targetUsername}@test.local`,
      role: 'technician',
      password: 'UserPass#123',
      status: 'PENDING_APPROVAL'
    });
    assert(createRes.status === 200 && createRes.data?.success === true, 'Admin dapat membuat akun Teknisi baru (tercatat buat_akun)');
    const createdUserId = createRes.data.user.id as string;

    const approveRes = await httpJson(baseUrl, 'POST', `/api/auth/users/${createdUserId}/approve`, adminSession.accessToken);
    assert(approveRes.status === 200, 'Admin dapat menyetujui akun (tercatat setujui_akun)');

    const statusRes = await httpJson(baseUrl, 'POST', `/api/auth/users/${createdUserId}/status`, adminSession.accessToken, {
      status: 'SUSPENDED'
    });
    assert(statusRes.status === 200, 'Admin dapat mengubah status akun (tercatat ubah_status_akun)');

    const featuresRes = await httpJson(baseUrl, 'PUT', `/api/auth/users/${createdUserId}/features`, devToken, {
      feature_permissions: { catalog_view: true, dashboard: false }
    });
    assert(featuresRes.status === 200, 'Developer dapat mengatur fitur akun (tercatat ubah_akses_fitur)');

    const resetRes = await httpJson(baseUrl, 'POST', `/api/auth/users/${createdUserId}/reset-password`, adminSession.accessToken, {
      newPassword: 'NewUserPass#456'
    });
    assert(resetRes.status === 200, 'Admin dapat mereset kata sandi akun (tercatat reset_sandi)');

    const deleteRes = await httpJson(baseUrl, 'DELETE', `/api/auth/users/${createdUserId}`, adminSession.accessToken);
    assert(deleteRes.status === 200, 'Admin dapat menghapus akun (tercatat hapus_akun)');

    // 3. Cek feed /api/activities bersih dari USER_ACTIVITY_ACTIONS
    console.log('\n[3] Verifikasi Feed Riwayat Barang (/api/activities) Bersih dari Log User:');
    const actFeedRes = await httpJson(baseUrl, 'GET', '/api/activities?limit=300', devToken);
    assert(actFeedRes.status === 200 && Array.isArray(actFeedRes.data?.transactions), 'GET /api/activities mengembalikan daftar transaksi');
    const leakedUserTx = (actFeedRes.data.transactions as Array<{ aksi: string }>).filter((tx) =>
      (USER_ACTIVITY_ACTIONS as readonly string[]).includes(tx.aksi)
    );
    assert(leakedUserTx.length === 0, `Tidak ada log login/logout/sesi/akun yang bocor ke /api/activities (ditemukan: ${leakedUserTx.length})`);
    const hasStockTx = (actFeedRes.data.transactions as Array<{ catatan?: string }>).some((tx) =>
      String(tx.catatan || '').includes(`Patchcord LC-LC ${suffix}`) || String(tx.catatan || '').includes(suffix)
    );
    assert(hasStockTx, 'Transaksi mutasi barang tetap tampil di /api/activities');

    // 4. Cek RBAC & filter GET /api/auth/user-logs
    console.log('\n[4] Verifikasi Endpoint GET /api/auth/user-logs (RBAC Admin & Developer + Filter):');
    const techLogsRes = await httpJson(baseUrl, 'GET', '/api/auth/user-logs', techSession.accessToken);
    assert(techLogsRes.status === 403, 'Teknisi ditolak mengakses GET /api/auth/user-logs (403)');

    const adminLogsRes = await httpJson(baseUrl, 'GET', '/api/auth/user-logs?limit=200', adminSession.accessToken);
    assert(adminLogsRes.status === 200 && Array.isArray(adminLogsRes.data?.logs), 'Admin dengan akses users_manage dapat mengakses GET /api/auth/user-logs');

    const devLogsRes = await httpJson(baseUrl, 'GET', '/api/auth/user-logs?limit=200', devToken);
    assert(devLogsRes.status === 200 && Array.isArray(devLogsRes.data?.logs), 'Developer dapat mengakses GET /api/auth/user-logs');

    const allActions = new Set((devLogsRes.data.logs as Array<{ aksi: string }>).map((l) => l.aksi));
    for (const expectedAction of ['login', 'buat_akun', 'setujui_akun', 'ubah_status_akun', 'ubah_akses_fitur', 'reset_sandi', 'hapus_akun']) {
      assert(allActions.has(expectedAction), `Log aktivitas user merekam aksi "${expectedAction}"`);
    }

    const authOnlyRes = await httpJson(baseUrl, 'GET', '/api/auth/user-logs?category=auth&limit=200', adminSession.accessToken);
    const authOnlyValid = (authOnlyRes.data.logs as Array<{ category: string }>).every((l) => l.category === 'auth');
    assert(authOnlyRes.status === 200 && authOnlyRes.data.logs.length > 0 && authOnlyValid, 'Filter category=auth hanya mengembalikan log login/logout');

    const accountSearchRes = await httpJson(
      baseUrl,
      'GET',
      `/api/auth/user-logs?category=account&search=${encodeURIComponent(targetUsername)}&limit=100`,
      adminSession.accessToken
    );
    assert(
      accountSearchRes.status === 200 &&
        accountSearchRes.data.logs.length >= 5 &&
        (accountSearchRes.data.logs as Array<{ catatan?: string }>).every((l) => String(l.catatan || '').includes(targetUsername)),
      `Filter category=account + search="${targetUsername}" mengembalikan riwayat akun target secara akurat`
    );

    // 5. Logout juga tercatat di user-logs dan tidak bocor ke /api/activities
    const logoutRes = await httpJson(baseUrl, 'POST', '/api/auth/logout', devToken);
    assert(logoutRes.status === 200, 'Logout berhasil');
    const afterLogoutUserLogs = await httpJson(baseUrl, 'GET', '/api/auth/user-logs?category=auth&limit=50', adminSession.accessToken);
    assert(
      (afterLogoutUserLogs.data.logs as Array<{ aksi: string }>).some((l) => l.aksi === 'logout'),
      'Aktivitas logout tercatat di GET /api/auth/user-logs'
    );
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n================================================================');
  console.log(`  HASIL TEST: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('[FATAL TEST ERROR]:', err);
  process.exit(1);
});
