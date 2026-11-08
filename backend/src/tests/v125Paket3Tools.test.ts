/**
 * Unit & Integration Test Suite - Paket 3: Menu Tools Navbar & Hak Akses (v1.2.5)
 * FieldOps IT Inventory Rebuild
 */

import { initDatabase } from '../db/database';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { UserRole } from '../utils/permissions';
import { generateInventoryExcelBuffer, sanitizeFormulaInput } from '../../../frontend/src/utils/excelExporter';
import exceljs from 'exceljs';

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

async function runPaket3Tests() {
  console.log('================================================================');
  console.log('  FIELDOPS IT V1.2.5 - PENGUJIAN OTOMATIS PAKET 3 (MENU TOOLS NAVBAR)');
  console.log('================================================================\n');

  await initDatabase();

  const roles: UserRole[] = ['developer', 'admin', 'warehouse_admin', 'technician'];

  // 1. Matriks Hak Akses Tool: Database (requireRole(['developer', 'admin']))
  console.log('[1] Matriks Hak Akses Tool: Database Backup & Trash (Developer/Admin ONLY):');
  const databaseMiddleware = requireRole(['developer', 'admin']);

  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    databaseMiddleware(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    if (role === 'developer' || role === 'admin') {
      assert(nextCalled === true && res.statusCode === 200, `Database Tool: Role "${role}" DIIZINKAN`);
    } else {
      assert(
        nextCalled === false && res.statusCode === 403 && res.body?.success === false,
        `Database Tool: Role "${role}" DITOLAK dengan HTTP 403 Forbidden`
      );
    }
  }

  // 2. Matriks Hak Akses Tool: Audit Keamanan & Trash Purge (Developer/Admin ONLY)
  console.log('\n[2] Matriks Hak Akses Tool: Audit Keamanan System (Developer/Admin ONLY):');
  const auditMiddleware = requireRole(['developer', 'admin']);

  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    auditMiddleware(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    if (role === 'developer' || role === 'admin') {
      assert(nextCalled === true && res.statusCode === 200, `Audit Tool: Role "${role}" DIIZINKAN`);
    } else {
      assert(
        nextCalled === false && res.statusCode === 403 && res.body?.success === false,
        `Audit Tool: Role "${role}" DITOLAK dengan HTTP 403 Forbidden`
      );
    }
  }

  // 3. Matriks Hak Akses Tool: WA Alert Configuration Edit (Developer/Admin/Warehouse Admin ONLY)
  console.log('\n[3] Matriks Hak Akses Tool: Ubah Pengaturan WA Alert (Ditolak 403 untuk Teknisi):');
  const waConfigMiddleware = requireRole(['developer', 'admin', 'warehouse_admin']);

  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    waConfigMiddleware(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    if (role === 'technician') {
      assert(
        nextCalled === false && res.statusCode === 403 && res.body?.success === false,
        `WA Config Edit: Role "${role}" DITOLAK dengan HTTP 403 Forbidden`
      );
    } else {
      assert(nextCalled === true && res.statusCode === 200, `WA Config Edit: Role "${role}" DIIZINKAN`);
    }
  }

  // 4. Matriks Hak Akses Tool: WA Alert Logs Read (Seluruh Role Termasuk Teknisi)
  console.log('\n[4] Matriks Hak Akses Tool: Riwayat Log WA Alert (Seluruh Role Boleh Akses):');
  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    requireAuth(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    assert(nextCalled === true, `WA Alert Logs Read: Role "${role}" DIIZINKAN membaca riwayat log`);
  }

  // 5. Matriks Hak Akses Tool: Akses HP, Ekspor Excel, Cetak Label (Seluruh Role)
  console.log('\n[5] Matriks Hak Akses Tool: Akses HP, Ekspor Excel, Cetak Label (Seluruh Role Boleh Akses):');
  for (const role of roles) {
    const req: any = { user: { id: `usr-${role}`, username: role, role } };
    const res = createMockRes();
    let nextCalled: any = false;

    requireAuth(req as AuthenticatedRequest, res, () => {
      nextCalled = true;
    });

    assert(nextCalled === true, `Tools Publik (Akses HP/Excel/Label): Role "${role}" DIIZINKAN`);
  }

  // 6. Pengujian Sanitasi & Keamanan Ekspor Excel (Sanitasi Karakter CWE-1236 & Tanpa Bocor Secret/Credentials)
  console.log('\n[6] Pengujian Ekspor Excel: Format Binary .xlsx Valid & Kerahasiaan Kredensial:');

  const sampleItems = [
    {
      id: 101,
      sku: 'SW-GIGA-24P',
      name: 'Managed Switch 24 Port',
      category: 'Network',
      category_name: 'Network Equipment',
      quantity: 15,
      unit: 'unit',
      location: 'Rak A-02',
      min_stock_alert: 5,
      minStockAlert: 5,
      secret_api_key: 'SECRET_SHOULD_NOT_LEAK',
      password_hash: 'PBKDF2_HASH_SECRET',
    },
    {
      id: 102,
      sku: 'KBL-UTP-CAT6',
      name: '=SUM(1+1) Formatted Test',
      category: 'Kabel',
      category_name: 'Kabel & Aksesoris',
      quantity: 10,
      unit: 'roll',
      location: 'Rak B-01',
      min_stock_alert: 2,
      minStockAlert: 2,
    }
  ];

  const buffer = await generateInventoryExcelBuffer(sampleItems);
  assert(Buffer.isBuffer(buffer) && buffer.length > 500, 'Berhasil membuat buffer binary Excel .xlsx (> 500 byte)');

  // Membaca ulang workbook dengan exceljs untuk memverifikasi isi tabel
  const workbook = new exceljs.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.getWorksheet('Katalog Inventori');

  assert(worksheet !== undefined, 'Worksheet "Katalog Inventori" dapat dibaca kembali dari Excel buffer');
  
  // Verifikasi Header
  const headerRow = worksheet?.getRow(1);
  const headers: string[] = [];
  headerRow?.eachCell((cell) => {
    headers.push(String(cell.value));
  });

  assert(
    !headers.includes('secret_api_key') && !headers.includes('password_hash'),
    'Header Excel TIDAK memuat kolom sensitif (secret_api_key / password_hash)'
  );

  // Verifikasi Formula Sanitization (Row 6 is Item 2)
  const row6 = worksheet?.getRow(6);
  const nameCell = String(row6?.getCell(4).value);
  assert(
    nameCell.startsWith("'=") || nameCell === "'=SUM(1+1) Formatted Test",
    `Sanitasi Formula CWE-1236 Berhasil: "${nameCell}"`
  );

  // Ringkasan Pengujian
  console.log('\n================================================================');
  if (testsFailed === 0) {
    console.log(`🎉 SELURUH PENGUJIAN PAKET 3 LULUS 100%! (${testsPassed} tes sukses)`);
  } else {
    console.error(`⚠️ PENGUJIAN PAKET 3 SELESAI DENGAN ${testsFailed} KEGAGALAN (${testsPassed} sukses)`);
  }
  console.log('================================================================\n');

  process.exit(testsFailed === 0 ? 0 : 1);
}

runPaket3Tests().catch(err => {
  console.error('Fatal Paket 3 Test Suite Error:', err);
  process.exit(1);
});
