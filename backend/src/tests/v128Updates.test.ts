/**
 * Test Suite: FieldOps IT Inventory v1.2.8 Updates
 * Covers:
 * 1. Closed public registration (login-only page; POST /api/auth/register -> 403)
 * 2. Unified 3-role RBAC (warehouse_admin/supervisor -> admin; superadmin -> developer) & Admin user scope limits
 * 3. Developer-only per-account feature sliders (PUT /api/auth/users/:id/features & requireFeature enforcement)
 * 4. Developer-only Dual WhatsApp Gateways (gateway1/gateway2 ON/OFF, failover/parallel, Admin isolation)
 * 5. Multi-select bulk delete + "delete" Tier-3 confirmation across Produk, Kategori, Atribut, Box, & Item Fisik
 * 6. Excel (.xlsx/.csv) & Public Google Spreadsheet import (template, URL parsing, preview validation, atomic commit)
 */

import http from 'http';
import express from 'express';
import ExcelJS from 'exceljs';
import { initDatabase, executeQuery } from '../db/database';
import { AuthService } from '../services/authService';
import { SessionService } from '../services/sessionService';
import { ConfirmationService } from '../services/confirmationService';
import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { ImportService, parseGoogleSheetUrl } from '../services/importService';
import { normalizeRole } from '../utils/permissions';
import { authenticate } from '../middleware/authMiddleware';
import authRouter from '../routes/auth';
import whatsappRouter from '../routes/whatsapp';
import catalogRouter from '../routes/catalog';
import boxRouter from '../routes/box';
import stockRouter from '../routes/stock';
import importRouter from '../routes/import';

async function httpJson(
  baseUrl: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; data: any; rawBuffer?: Buffer }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const arrayBuf = await res.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuf);
  const text = rawBuffer.toString('utf-8');
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, rawBuffer };
}

async function runV128Tests() {
  console.log('================================================================');
  console.log('  FIELDOPS IT v1.2.8 - COMPREHENSIVE UPDATE TEST SUITE');
  console.log('================================================================\n');

  await initDatabase();

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(authenticate);
  app.use('/api/auth', authRouter);
  app.use('/api/whatsapp', whatsappRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/boxes', boxRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/import', importRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

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
    const pwd = 'TestPassword#128';
    const { hash, salt } = AuthService.hashPassword(pwd);

    const devId = `usr-dev-v128-${suffix}`;
    const adminId = `usr-adm-v128-${suffix}`;
    const techId = `usr-tek-v128-${suffix}`;
    const legacyWhId = `usr-wh-v128-${suffix}`;

    const usersToSeed = [
      { id: devId, username: `dev128_${suffix}`, name: 'Dev v128', email: `dev128_${suffix}@test.local`, role: 'developer' },
      { id: adminId, username: `adm128_${suffix}`, name: 'Admin v128', email: `adm128_${suffix}@test.local`, role: 'admin' },
      { id: techId, username: `tek128_${suffix}`, name: 'Tek v128', email: `tek128_${suffix}@test.local`, role: 'technician' },
      { id: legacyWhId, username: `wh128_${suffix}`, name: 'Legacy WH v128', email: `wh128_${suffix}@test.local`, role: 'warehouse_admin' }
    ];

    for (const u of usersToSeed) {
      await executeQuery(
        `INSERT INTO users (id, username, name, email, role, department, phone, password_hash, salt, status)
         VALUES (?, ?, ?, ?, ?, 'IT Ops', '081111222333', ?, ?, 'ACTIVE')`,
        [u.id, u.username, u.name, u.email, u.role, hash, salt]
      );
    }

    const devSess = await SessionService.createSession(
      { id: devId, username: usersToSeed[0].username, name: 'Dev v128', email: usersToSeed[0].email, role: 'developer', department: 'IT Ops', phone: '', status: 'ACTIVE' },
      '127.0.0.1',
      'v128-test'
    );
    const admSess = await SessionService.createSession(
      { id: adminId, username: usersToSeed[1].username, name: 'Admin v128', email: usersToSeed[1].email, role: 'admin', department: 'IT Ops', phone: '', status: 'ACTIVE' },
      '127.0.0.1',
      'v128-test'
    );
    const tekSess = await SessionService.createSession(
      { id: techId, username: usersToSeed[2].username, name: 'Tek v128', email: usersToSeed[2].email, role: 'technician', department: 'IT Ops', phone: '', status: 'ACTIVE' },
      '127.0.0.1',
      'v128-test'
    );

    // ------------------------------------------------------------------
    // 1. Login-Only & Closed Public Registration
    // ------------------------------------------------------------------
    console.log('\n[1] Login-Only & Closed Public Registration:');
    const regRes = await httpJson(baseUrl, 'POST', '/api/auth/register', undefined, {
      username: `pub_${suffix}`,
      name: 'Public User',
      email: `pub_${suffix}@test.local`,
      password: pwd
    });
    assert(regRes.status === 403 && regRes.data?.success === false, 'POST /api/auth/register mengembalikan HTTP 403 (registrasi publik ditutup)');

    const loginRes = await httpJson(baseUrl, 'POST', '/api/auth/login', undefined, {
      username: usersToSeed[1].username,
      password: pwd
    });
    assert(loginRes.status === 200 && loginRes.data?.success === true && loginRes.data?.user?.role === 'admin', 'POST /api/auth/login berhasil dan mengembalikan peran kanonik');

    // ------------------------------------------------------------------
    // 2. Role Merge & Admin User Creation Scope Limits
    // ------------------------------------------------------------------
    console.log('\n[2] Peleburan Role & Batasan Admin Kelola Akun:');
    assert(normalizeRole('warehouse_admin') === 'admin', 'normalizeRole("warehouse_admin") -> "admin"');
    assert(normalizeRole('supervisor') === 'admin', 'normalizeRole("supervisor") -> "admin"');
    assert(normalizeRole('superadmin') === 'developer', 'normalizeRole("superadmin") -> "developer"');

    const adminCreateDev = await httpJson(baseUrl, 'POST', '/api/auth/users', admSess.accessToken, {
      username: `illdev_${suffix}`,
      name: 'Illegal Dev',
      email: `illdev_${suffix}@test.local`,
      role: 'developer',
      password: pwd
    });
    assert(adminCreateDev.status === 403, 'Admin ditolak (403) saat mencoba membuat akun Developer');

    const adminCreateTech = await httpJson(baseUrl, 'POST', '/api/auth/users', admSess.accessToken, {
      username: `newtek_${suffix}`,
      name: 'Teknisi Baru',
      email: `newtek_${suffix}@test.local`,
      role: 'technician',
      password: pwd,
      status: 'PENDING_APPROVAL'
    });
    assert(adminCreateTech.status === 200 && adminCreateTech.data?.success === true, 'Admin berhasil membuat akun Teknisi berstatus PENDING_APPROVAL');
    const createdTechId = adminCreateTech.data?.user?.id;

    const adminApproveTech = await httpJson(baseUrl, 'POST', `/api/auth/users/${createdTechId}/approve`, admSess.accessToken, {
      role: 'admin'
    });
    assert(adminApproveTech.status === 200 && adminApproveTech.data?.success === true, 'Admin dapat menyetujui akun ke peran Admin/Teknisi');

    const adminApproveToDev = await httpJson(baseUrl, 'POST', `/api/auth/users/${createdTechId}/approve`, admSess.accessToken, {
      role: 'developer'
    });
    assert(adminApproveToDev.status === 403, 'Admin ditolak (403) saat menyetujui/menaikkan akun ke peran Developer');

    const adminDeleteDev = await httpJson(baseUrl, 'DELETE', `/api/auth/users/${devId}`, admSess.accessToken);
    assert(adminDeleteDev.status === 403, 'Admin ditolak (403) saat mencoba menghapus akun Developer');

    // ------------------------------------------------------------------
    // 3. Developer-Only Per-Account Feature Sliders
    // ------------------------------------------------------------------
    console.log('\n[3] Saklar Fitur Per-Akun (Khusus Developer):');
    const adminEditFeatures = await httpJson(baseUrl, 'PUT', `/api/auth/users/${techId}/features`, admSess.accessToken, {
      featurePermissions: { catalog_manage: true }
    });
    assert(adminEditFeatures.status === 403, 'Admin ditolak (403) mengakses PUT /api/auth/users/:id/features');

    const techEditFeatures = await httpJson(baseUrl, 'PUT', `/api/auth/users/${techId}/features`, tekSess.accessToken, {
      featurePermissions: { catalog_manage: true }
    });
    assert(techEditFeatures.status === 403, 'Teknisi ditolak (403) mengakses PUT /api/auth/users/:id/features');

    // Developer turns OFF catalog_import for Admin -> Admin gets 403 on /api/import/template
    const disableImportRes = await httpJson(baseUrl, 'PUT', `/api/auth/users/${adminId}/features`, devSess.accessToken, {
      featurePermissions: { catalog_import: false }
    });
    assert(disableImportRes.status === 200 && disableImportRes.data?.feature_permissions?.catalog_import === false, 'Developer berhasil mematikan saklar catalog_import untuk akun Admin');

    const blockedImportRes = await httpJson(baseUrl, 'GET', '/api/import/template', admSess.accessToken);
    assert(blockedImportRes.status === 403, 'Middleware requireFeature("catalog_import") menolak Admin (403) setelah saklar dimatikan');

    // Developer grants catalog_manage to Technician -> Technician passes requireFeature('catalog_manage')
    const grantTechRes = await httpJson(baseUrl, 'PUT', `/api/auth/users/${techId}/features`, devSess.accessToken, {
      featurePermissions: { catalog_manage: true }
    });
    assert(grantTechRes.status === 200 && grantTechRes.data?.feature_permissions?.catalog_manage === true, 'Developer berhasil menyalakan saklar catalog_manage untuk Teknisi');

    const techBoxCreate = await httpJson(baseUrl, 'POST', '/api/boxes', tekSess.accessToken, {
      kode: `BOX-T-${suffix}`,
      keterangan: 'Dibuat oleh Teknisi dengan override fitur'
    });
    assert(techBoxCreate.status === 201 && techBoxCreate.data?.success === true, 'Teknisi dengan saklar catalog_manage ON diizinkan membuat Storage Box');

    // Reset back to role defaults
    const resetAdminRes = await httpJson(baseUrl, 'PUT', `/api/auth/users/${adminId}/features`, devSess.accessToken, {
      resetToDefault: true
    });
    const resetTechRes = await httpJson(baseUrl, 'PUT', `/api/auth/users/${techId}/features`, devSess.accessToken, {
      resetToDefault: true
    });
    assert(resetAdminRes.status === 200 && resetTechRes.status === 200, 'Developer berhasil mereset akses fitur akun ke bawaan peran');

    const restoredImportRes = await httpJson(baseUrl, 'GET', '/api/import/template', admSess.accessToken);
    assert(restoredImportRes.status === 200, 'Admin kembali bisa mengakses /api/import/template setelah reset ke bawaan peran');

    // ------------------------------------------------------------------
    // 4. Developer-Only Dual WhatsApp Gateways
    // ------------------------------------------------------------------
    console.log('\n[4] Dual WhatsApp Gateway & Isolasi Role Developer:');
    const adminWaConfig = await httpJson(baseUrl, 'GET', '/api/whatsapp/config', admSess.accessToken);
    assert(
      adminWaConfig.status === 200 &&
      adminWaConfig.data?.config?.hasGatewayAccess === false &&
      adminWaConfig.data?.config?.apiUrl === '' &&
      adminWaConfig.data?.config?.gateways?.gateway1?.apiUrl === '' &&
      adminWaConfig.data?.config?.gateways?.gateway2?.apiUrl === '',
      'GET /api/whatsapp/config untuk Admin menyembunyikan URL & token Gateway 1/2'
    );

    const devWaConfig = await httpJson(baseUrl, 'GET', '/api/whatsapp/config', devSess.accessToken);
    assert(
      devWaConfig.status === 200 &&
      devWaConfig.data?.config?.hasGatewayAccess === true &&
      typeof devWaConfig.data?.config?.gateways?.gateway1?.apiUrl === 'string' &&
      devWaConfig.data?.config?.gateways?.gateway1?.apiUrl.length > 0,
      'GET /api/whatsapp/config untuk Developer menampilkan detail Gateway 1 & 2'
    );

    const adminEditGateway = await httpJson(baseUrl, 'POST', '/api/whatsapp/config', admSess.accessToken, {
      gatewayMode: 'parallel',
      gateways: {
        gateway1: { enabled: false, apiUrl: 'https://evil.local/send', apiToken: 'tok1' },
        gateway2: { enabled: true, apiUrl: 'https://evil2.local/send', apiToken: 'tok2' }
      }
    });
    assert(adminEditGateway.status === 403, 'Admin ditolak (403) saat mencoba mengubah konfigurasi Gateway WA');

    const adminEditRecipients = await httpJson(baseUrl, 'POST', '/api/whatsapp/config', admSess.accessToken, {
      recipientSlots: [
        { slot: 1, label: 'Gudang', number: '0811111111', enabled: true },
        { slot: 2, label: 'Ops', number: '0822222222', enabled: false },
        { slot: 3, label: '', number: '', enabled: false },
        { slot: 4, label: '', number: '', enabled: false }
      ]
    });
    assert(adminEditRecipients.status === 200 && adminEditRecipients.data?.config?.recipients?.length === 1, 'Admin tetap dapat mengatur 4 slot penerima & saklar ON/OFF WA');

    const adminTestGw = await httpJson(baseUrl, 'POST', '/api/whatsapp/test-gateway', admSess.accessToken, {
      gatewayId: 'gateway1',
      targetPhone: '0811111111'
    });
    assert(adminTestGw.status === 403, 'POST /api/whatsapp/test-gateway menolak Admin (403)');

    const devUpdateDualGw = await httpJson(baseUrl, 'POST', '/api/whatsapp/config', devSess.accessToken, {
      gatewayMode: 'parallel',
      gateways: {
        gateway1: { enabled: true, label: 'Gateway 1 Utama', provider: 'fonnte', apiUrl: 'https://api.fonnte.com/send', apiToken: '' },
        gateway2: { enabled: true, label: 'Gateway 2 Cadangan', provider: 'fonnte', apiUrl: 'https://api.fonnte.com/send', apiToken: '' }
      }
    });
    assert(
      devUpdateDualGw.status === 200 &&
      devUpdateDualGw.data?.config?.gatewayMode === 'parallel' &&
      devUpdateDualGw.data?.config?.gateways?.gateway1?.enabled === true &&
      devUpdateDualGw.data?.config?.gateways?.gateway2?.enabled === true,
      'Developer berhasil mengaktifkan Dual Gateway (Gateway 1 & Gateway 2 ON, mode parallel)'
    );

    const devTestGw2 = await httpJson(baseUrl, 'POST', '/api/whatsapp/test-gateway', devSess.accessToken, {
      gatewayId: 'gateway2',
      targetPhone: '0811111111'
    });
    assert(devTestGw2.status === 200 && devTestGw2.data?.gatewayId === 'gateway2', 'Developer berhasil menguji Gateway 2 via POST /api/whatsapp/test-gateway');

    // ------------------------------------------------------------------
    // 5. Multi-Select Bulk Delete + "delete" Confirmation Across All 5 Targets
    // ------------------------------------------------------------------
    console.log('\n[5] Multi-Pilih Hapus Massal + Konfirmasi Ketik "delete" (5 Target):');
    const jenisA = await CatalogService.createJenis({
      nama: `J-BulkA-${suffix}`,
      sumber_id_bawaan: 'manual',
      prefix_id_bawaan: 'BKA',
      atributs: [{ kode: `atr_a_${suffix}`, nama: 'Attr Bulk A', tipe_isian: 'teks', wajib: false, urutan: 1, masuk_nama: false }]
    }, devId);
    const jenisB = await CatalogService.createJenis({
      nama: `J-BulkB-${suffix}`,
      sumber_id_bawaan: 'manual',
      prefix_id_bawaan: 'BKB',
      atributs: [{ kode: `atr_b_${suffix}`, nama: 'Attr Bulk B', tipe_isian: 'teks', wajib: false, urutan: 1, masuk_nama: false }]
    }, devId);

    const prod1 = await CatalogService.createProduk({ jenis_id: jenisA.id, nama: `Prod Bulk 1 ${suffix}`, kategori: 'fast_moving' }, devId);
    const prod2 = await CatalogService.createProduk({ jenis_id: jenisB.id, nama: `Prod Bulk 2 ${suffix}`, kategori: 'fast_moving' }, devId);
    const tipe1 = await CatalogService.createTipe({ produk_id: prod1.id, sumber_id: 'manual', nilai_atribut: [] }, devId);
    const box1 = await StockService.createBox(`BOX-B1-${suffix}`, 'Box Bulk 1', devId);
    const box2 = await StockService.createBox(`BOX-B2-${suffix}`, 'Box Bulk 2', devId);

    const snBulk1 = `SN-BK1-${suffix}`;
    const snBulk2 = `SN-BK2-${suffix}`;
    const snSingle = `SN-SGL-${suffix}`;
    await StockService.inputStokItemBulk({ tipe_id: tipe1.id, box_id: box1.id, kode_ids: [snBulk1, snBulk2, snSingle], user_id: devId });
    const itemBulk1 = (await StockService.checkDuplicateKodeId(snBulk1)).item!;
    const itemBulk2 = (await StockService.checkDuplicateKodeId(snBulk2)).item!;
    const itemSingle = (await StockService.checkDuplicateKodeId(snSingle)).item!;

    // Wrong confirmation text (typing object name instead of "delete") MUST fail!
    const wrongConfirm = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_product',
      targetId: `bulk:${[prod1.id, prod2.id].sort().join(',')}`,
      targetName: `Prod Bulk 1 ${suffix}`,
      objectNameTyped: `Prod Bulk 1 ${suffix}`,
      lastLoginTime: Date.now()
    });
    assert(wrongConfirm.success === false, 'Konfirmasi hapus Tier 3 menolak nama objek dan mewajibkan kata "delete"');

    // Blocker guard: box1 still contains active items -> DELETE /api/boxes/bulk MUST return 400!
    const boxTargetIds = [box1.id, box2.id].sort();
    const boxBulkTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_box',
      targetId: `bulk:${boxTargetIds.join(',')}`,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const blockedBoxDel = await httpJson(baseUrl, 'DELETE', '/api/boxes/bulk', devSess.accessToken, {
      ids: boxTargetIds,
      confirmation_token: boxBulkTok.token
    });
    assert(blockedBoxDel.status === 400, 'Hapus massal Box ditolak (400) jika salah satu Box masih berisi stok aktif');

    // (a) Single Item Delete with "delete"
    const singleItemTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_item',
      targetId: itemSingle.id,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const singleItemDel = await httpJson(baseUrl, 'DELETE', `/api/stock/items/${itemSingle.id}`, devSess.accessToken, {
      confirmation_token: singleItemTok.token
    });
    assert(singleItemDel.status === 200 && singleItemDel.data?.success === true, 'Hapus item fisik tunggal berhasil dengan konfirmasi ketik "delete"');

    // (b) Bulk Item Delete with "delete"
    const bulkItemIds = [itemBulk1.id, itemBulk2.id].sort();
    const bulkItemTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_item',
      targetId: `bulk:${bulkItemIds.join(',')}`,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const bulkItemDel = await httpJson(baseUrl, 'DELETE', '/api/stock/items/bulk', devSess.accessToken, {
      ids: bulkItemIds,
      confirmation_token: bulkItemTok.token
    });
    assert(bulkItemDel.status === 200 && bulkItemDel.data?.deletedCount === 2, 'Hapus massal Item Fisik Ber-ID (2 item) berhasil dengan konfirmasi "delete"');

    // (c) Now boxes are empty -> Bulk Box Delete succeeds!
    const boxBulkTok2 = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_box',
      targetId: `bulk:${boxTargetIds.join(',')}`,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const boxBulkDel = await httpJson(baseUrl, 'DELETE', '/api/boxes/bulk', devSess.accessToken, {
      ids: boxTargetIds,
      confirmation_token: boxBulkTok2.token
    });
    assert(boxBulkDel.status === 200 && boxBulkDel.data?.deletedCount === 2, 'Hapus massal Storage Box (2 box) berhasil setelah kosong');

    // (d) Bulk Product Delete
    const prodBulkIds = [prod1.id, prod2.id].sort((a, b) => a - b);
    const prodBulkTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_product',
      targetId: `bulk:${prodBulkIds.join(',')}`,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const prodBulkDel = await httpJson(baseUrl, 'DELETE', '/api/catalog/products/bulk', devSess.accessToken, {
      ids: prodBulkIds,
      confirmation_token: prodBulkTok.token
    });
    assert(prodBulkDel.status === 200 && prodBulkDel.data?.deletedCount === 2, 'Hapus massal Produk (2 produk) berhasil dengan konfirmasi "delete"');

    // (e) Bulk Attribute Delete
    const attrBulkIds = [jenisA.atributs![0].id, jenisB.atributs![0].id].sort((a, b) => a - b);
    const attrBulkTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_attribute',
      targetId: `bulk:${attrBulkIds.join(',')}`,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const attrBulkDel = await httpJson(baseUrl, 'DELETE', '/api/catalog/attributes/bulk', devSess.accessToken, {
      ids: attrBulkIds,
      confirmation_token: attrBulkTok.token
    });
    assert(attrBulkDel.status === 200 && attrBulkDel.data?.deletedCount === 2, 'Hapus massal Atribut (2 atribut) berhasil dengan konfirmasi "delete"');

    // (f) Bulk Kategori (Jenis) Delete
    const jenisBulkIds = [jenisA.id, jenisB.id].sort((a, b) => a - b);
    const jenisBulkTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_kind',
      targetId: `bulk:${jenisBulkIds.join(',')}`,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const jenisBulkDel = await httpJson(baseUrl, 'DELETE', '/api/catalog/jenis/bulk', devSess.accessToken, {
      ids: jenisBulkIds,
      confirmation_token: jenisBulkTok.token
    });
    assert(jenisBulkDel.status === 200 && jenisBulkDel.data?.deletedCount === 2, 'Hapus massal Kategori/Jenis (2 kategori) berhasil dengan konfirmasi "delete"');

    // ------------------------------------------------------------------
    // 6. Excel (.xlsx/.csv) & Google Spreadsheet Import
    // ------------------------------------------------------------------
    console.log('\n[6] Impor Katalog, Box & Stok Awal (Excel / CSV / Google Spreadsheet):');

    // (a) Template download & sheet verification
    const tplRes = await httpJson(baseUrl, 'GET', '/api/import/template', admSess.accessToken);
    assert(tplRes.status === 200 && Boolean(tplRes.rawBuffer && tplRes.rawBuffer.length > 1000), 'GET /api/import/template mengunduh file .xlsx valid');
    const tplWb = new ExcelJS.Workbook();
    await tplWb.xlsx.load(tplRes.rawBuffer as any);
    assert(
      tplWb.getWorksheet('Data_Barang') !== undefined && tplWb.getWorksheet('Panduan_Isi') !== undefined,
      'Template Excel memiliki sheet Data_Barang dan Panduan_Isi'
    );

    // (b) parseGoogleSheetUrl helper validation
    const parsedSheet = parseGoogleSheetUrl('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit#gid=456789');
    assert(
      parsedSheet.sheetId === '1AbCdEfGhIjKlMnOpQrStUvWxYz' &&
      parsedSheet.gid === '456789' &&
      parsedSheet.exportUrl === 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=csv&gid=456789',
      'parseGoogleSheetUrl mengekstrak Sheet ID, GID, dan URL ekspor CSV dengan benar'
    );

    let invalidSheetRejected = false;
    try {
      parseGoogleSheetUrl('https://example.com/not-a-google-sheet');
    } catch {
      invalidSheetRejected = true;
    }
    assert(invalidSheetRejected, 'parseGoogleSheetUrl menolak URL bukan Google Spreadsheet');

    // (c) CSV Preview + validation (both valid rows and duplicate SN / invalid rows)
    const csvContent = [
      'Kategori,Produk,Kategori_Barang,Perputaran,Satuan,Tipe_Varian,Sumber_ID,Prefix_ID,Kode_Box,Stok_Awal,Daftar_Serial_Number',
      `Kabel Uji ${suffix},Kabel UTP Cat6 ${suffix},Barang Habis Pakai,fast_moving,roll,305m Outdoor,tanpa_id,,BOX-IMP-${suffix},4,`,
      `Perangkat Uji ${suffix},ONT Dualband ${suffix},Alat,recycle,unit,GPON 4P,scan_sn,ONT-${suffix},BOX-IMP-${suffix},2,SNIMP${suffix}A;SNIMP${suffix}B`,
      `Perangkat Uji ${suffix},ONT Duplikat ${suffix},Alat,recycle,unit,GPON Err,scan_sn,ONT-ERR,BOX-IMP-${suffix},1,SNIMP${suffix}A`
    ].join('\n');
    const csvBase64 = Buffer.from(csvContent, 'utf-8').toString('base64');

    const previewRes = await httpJson(baseUrl, 'POST', '/api/import/preview', admSess.accessToken, {
      sourceType: 'file',
      fileName: 'data_uji_v128.csv',
      fileBase64: csvBase64,
      conflictMode: 'add_stock_only'
    });
    assert(
      previewRes.status === 200 &&
      previewRes.data?.preview?.totalRows === 3 &&
      previewRes.data?.preview?.validRows === 2 &&
      previewRes.data?.preview?.errorRows === 1,
      'POST /api/import/preview CSV memvalidasi 2 baris valid dan mendeteksi 1 baris SN duplikat'
    );

    // (d) Commit valid rows via HTTP endpoint
    const validRows = previewRes.data.preview.rows.filter((r: any) => r.rowState !== 'error');
    const commitRes = await httpJson(baseUrl, 'POST', '/api/import/commit', admSess.accessToken, {
      rows: validRows,
      conflictMode: 'add_stock_only',
      sourceLabel: 'data_uji_v128.csv'
    });
    assert(
      commitRes.status === 201 &&
      commitRes.data?.success === true &&
      commitRes.data?.createdJenis === 2 &&
      commitRes.data?.createdProduk === 2 &&
      commitRes.data?.createdTipe === 2 &&
      commitRes.data?.createdBoxes === 1 &&
      commitRes.data?.addedStockUnits === 6,
      'POST /api/import/commit membuat 2 Kategori, 2 Produk, 2 Tipe, 1 Box, & 6 unit stok awal secara atomik'
    );

    // Verify imported items actually exist in StockService
    const checkSnA = await StockService.checkDuplicateKodeId(`SNIMP${suffix}A`);
    const checkSnB = await StockService.checkDuplicateKodeId(`SNIMP${suffix}B`);
    assert(
      checkSnA.exists && checkSnA.item?.status === 'aktif' && checkSnB.exists && checkSnB.item?.kode_box === `BOX-IMP-${suffix}`,
      'Item ber-SN hasil impor tersimpan aktif di Box tujuan (BOX-IMP)'
    );

    // (e) Re-preview with skip_existing detects existing catalog variant
    const skipPreviewRes = await ImportService.previewImport({
      sourceType: 'file',
      fileName: 'recheck.csv',
      fileBase64: Buffer.from(
        [
          'Kategori,Produk,Kategori_Barang,Perputaran,Satuan,Tipe_Varian,Sumber_ID,Prefix_ID,Kode_Box,Stok_Awal,Daftar_Serial_Number',
          `Kabel Uji ${suffix},Kabel UTP Cat6 ${suffix},Barang Habis Pakai,fast_moving,roll,305m Outdoor,tanpa_id,,BOX-IMP-${suffix},2,`
        ].join('\n'),
        'utf-8'
      ).toString('base64'),
      conflictMode: 'skip_existing'
    });
    assert(
      skipPreviewRes.rows[0]?.rowState === 'skip' && skipPreviewRes.existingCatalogItems === 1,
      'Mode konflik skip_existing menandai varian katalog yang sudah ada sebagai skip'
    );
  } catch (err) {
    console.error('Fatal error in v128Updates.test.ts:', err);
    failed++;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n================================================================');
  console.log(`  HASIL TEST v1.2.8: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================\n');
  process.exit(failed === 0 ? 0 : 1);
}

runV128Tests();
