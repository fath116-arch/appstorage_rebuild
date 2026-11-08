/**
 * Unit & Integration Test Suite - Paket 1: Hak Akses RBAC (v1.2.5)
 * FieldOps IT Inventory Rebuild
 */

import express from 'express';
import { initDatabase } from '../db/database';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { PERMISSION_GROUPS, isRoleAllowed, UserRole } from '../utils/permissions';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    testsFailed++;
  }
}

// Mock Response Helper untuk simulasi Middleware Express
function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
}

async function runPaket1Tests() {
  console.log('================================================================');
  console.log('  FIELDOPS IT V1.2.5 - PENGUJIAN OTOMATIS PAKET 1 (HAK AKSES RBAC)');
  console.log('================================================================\n');

  await initDatabase();

  const roles: UserRole[] = ['developer', 'admin', 'warehouse_admin', 'technician'];

  // 1. Pengujian Helpers Matriks Permissions
  console.log('[1] Pengujian Definisi Permissions Terpusat (backend/src/utils/permissions.ts):');
  assert(isRoleAllowed('developer', PERMISSION_GROUPS.SETTING_API) === true, 'Developer diizinkan di Setting API');
  assert(isRoleAllowed('admin', PERMISSION_GROUPS.SETTING_API) === true, 'Admin diizinkan di Setting API');
  assert(isRoleAllowed('warehouse_admin', PERMISSION_GROUPS.SETTING_API) === false, 'Warehouse Admin dilarang di Setting API');
  assert(isRoleAllowed('technician', PERMISSION_GROUPS.SETTING_API) === false, 'Technician dilarang di Setting API');

  assert(isRoleAllowed('warehouse_admin', PERMISSION_GROUPS.CATALOG_WRITE) === true, 'Warehouse Admin diizinkan menulis di Katalog');
  assert(isRoleAllowed('technician', PERMISSION_GROUPS.CATALOG_WRITE) === false, 'Technician dilarang menulis di Katalog');
  assert(isRoleAllowed('technician', PERMISSION_GROUPS.CATALOG_READ) === true, 'Technician diizinkan membaca Katalog & Storage Box');

  // 2. Pengujian Setting API via Middleware requireRole(['developer', 'admin'])
  console.log('\n[2] Pengujian Middleware Endpoint Setting API (403 untuk Admin Gudang & Teknisi):');
  const settingApiMiddleware = requireRole(['developer', 'admin']);

  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    settingApiMiddleware(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    if (role === 'developer' || role === 'admin') {
      assert(nextCalled === true && res.statusCode === 200, `Setting API: Role "${role}" DIIZINKAN (Next called)`);
    } else {
      assert(
        nextCalled === false && res.statusCode === 403 && res.body?.success === false,
        `Setting API: Role "${role}" DITOLAK dengan HTTP 403 Forbidden`
      );
    }
  }

  // 3. Pengujian Katalog Write via Middleware requireRole(['developer', 'admin', 'warehouse_admin'])
  console.log('\n[3] Pengujian Middleware Endpoint Tulis Katalog (403 untuk Teknisi, 200 untuk Admin Gudang):');
  const catalogWriteMiddleware = requireRole(['developer', 'admin', 'warehouse_admin']);

  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    catalogWriteMiddleware(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    if (['developer', 'admin', 'warehouse_admin'].includes(role)) {
      assert(nextCalled === true && res.statusCode === 200, `Catalog Write: Role "${role}" DIIZINKAN (Next called)`);
    } else {
      assert(
        nextCalled === false && res.statusCode === 403 && res.body?.success === false,
        `Catalog Write: Role "${role}" (Teknisi) DITOLAK dengan HTTP 403 Forbidden`
      );
    }
  }

  // 4. Pengujian Storage Box Content Read (Dapat Dibuka oleh Semua Role Termasuk Teknisi)
  console.log('\n[4] Pengujian Pembacaan & Isi Storage Box (Seluruh Role Boleh Mengakses):');
  const requireAuthMiddleware = requireAuth;

  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    requireAuthMiddleware(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    assert(nextCalled === true, `Lihat Isi Storage Box: Role "${role}" DIIZINKAN membaca isi box`);
  }

  // 5. Pengujian WA Alert Settings (Developer, Admin, Warehouse Admin Boleh Ubah, Teknisi Ditolak 403)
  console.log('\n[5] Pengujian Pengaturan WhatsApp Alert (Ubah Pengaturan Ditolak 403 untuk Teknisi):');
  const waAlertSettingsMiddleware = requireRole(['developer', 'admin', 'warehouse_admin']);

  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    waAlertSettingsMiddleware(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    if (['developer', 'admin', 'warehouse_admin'].includes(role)) {
      assert(nextCalled === true, `WA Alert Settings: Role "${role}" DIIZINKAN mengubah konfigurasi`);
    } else {
      assert(
        nextCalled === false && res.statusCode === 403,
        `WA Alert Settings: Role "${role}" DITOLAK dengan HTTP 403 Forbidden`
      );
    }
  }

  // Ringkasan
  console.log('\n================================================================');
  if (testsFailed === 0) {
    console.log(`🎉 SELURUH PENGUJIAN PAKET 1 LULUS 100%! (${testsPassed} tes sukses)`);
  } else {
    console.error(`⚠️ PENGUJIAN PAKET 1 SELESAI DENGAN ${testsFailed} KEGAGALAN (${testsPassed} sukses)`);
  }
  console.log('================================================================\n');

  process.exit(testsFailed === 0 ? 0 : 1);
}

runPaket1Tests().catch(err => {
  console.error('Fatal Paket 1 Test Suite Error:', err);
  process.exit(1);
});
