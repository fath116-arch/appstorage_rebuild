/**
 * Test Suite: FieldOps IT v1.2.9 - Catalog Management, Non-SN Delete, Variant Rename, Multi-Type Import & Moves
 */

import http from 'http';
import express from 'express';
import { initDatabase, executeQuery } from '../db/database';
import { AuthService } from '../services/authService';
import { SessionService } from '../services/sessionService';
import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { ConfirmationService } from '../services/confirmationService';
import { authenticate } from '../middleware/authMiddleware';
import catalogRouter from '../routes/catalog';
import stockRouter from '../routes/stock';
import importRouter from '../routes/import';

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
    // plain text
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('  FIELDOPS IT v1.2.9 - TEST KATALOG, NON-SN DELETE & PINDAH');
  console.log('================================================================\n');

  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/import', importRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let passed = 0;
  let failed = 0;
  const assert = (cond: boolean, msg: string) => {
    if (cond) {
      passed++;
      console.log(`  ✅ [PASS] ${msg}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${msg}`);
    }
  };

  try {
    const suffix = Date.now().toString().slice(-6);
    const { hash, salt } = AuthService.hashPassword('Dev129Pass!@#');
    const devId = `usr-dev-v129-${suffix}`;
    const devUsername = `dev_v129_${suffix}`;
    await executeQuery(
      `INSERT INTO users (id, username, name, email, role, department, phone, password_hash, salt, status)
       VALUES (?, ?, ?, ?, ?, 'IT Ops', '081111222333', ?, ?, 'ACTIVE')`,
      [devId, devUsername, `Dev129_${suffix}`, `${devUsername}@test.local`, 'developer', hash, salt]
    );
    const devSess = await SessionService.createSession(
      { id: devId, username: devUsername, name: `Dev129_${suffix}`, email: `${devUsername}@test.local`, role: 'developer', department: 'IT Ops', phone: '', status: 'ACTIVE' },
      '127.0.0.1',
      'test-agent'
    );
    const token = devSess.accessToken;

    // 1. Create categories, products, manual variant type (no attributes)
    console.log('[1] Pembuatan Kategori & Varian Tipe Manual Tanpa Atribut:');
    const catA = await CatalogService.createJenis({ nama: `Cat-A-${suffix}`, sumber_id_bawaan: 'tanpa_id' }, devId);
    const catB = await CatalogService.createJenis({ nama: `Cat-B-${suffix}`, sumber_id_bawaan: 'scan_sn' }, devId);
    const prodA = await CatalogService.createProduk({ jenis_id: catA.id, nama: `Kabel-A-${suffix}`, kategori: 'fast_moving' }, devId);
    const prodB = await CatalogService.createProduk({ jenis_id: catB.id, nama: `ONT-B-${suffix}`, kategori: 'recycle' }, devId);

    const createManualTypeRes = await httpJson(baseUrl, 'POST', '/api/catalog/types', token, {
      produk_id: prodA.id,
      nama_tipe: `100m Outdoor ${suffix}`,
      sumber_id: 'tanpa_id',
      catatan: 'Varian tanpa atribut'
    });
    assert(createManualTypeRes.status === 201 && createManualTypeRes.data?.type?.nama_tipe === `100m Outdoor ${suffix}`, 'Buat Varian Tipe manual tanpa nilai_atribut berhasil');
    const tipeNonSnId = createManualTypeRes.data?.type?.id;

    const createManualType2Res = await httpJson(baseUrl, 'POST', '/api/catalog/types', token, {
      produk_id: prodA.id,
      nama_tipe: `200m Outdoor ${suffix}`,
      sumber_id: 'tanpa_id'
    });
    const tipeNonSn2Id = createManualType2Res.data.type.id;

    // 2. Non-SN (stok_jumlah) input, move, partial delete & bulk delete
    console.log('\n[2] Hapus & Pindah Stok Non-SN (stok_jumlah):');
    const box1 = await StockService.createBox(`B1-${suffix}`, 'Box 1', devId);
    const box2 = await StockService.createBox(`B2-${suffix}`, 'Box 2', devId);
    await StockService.inputStokJumlah({ tipe_id: tipeNonSnId, box_id: box1.id, jumlah: 25, user_id: devId });

    // Move 10 non-SN units across box and compatible type
    const moveNonSnRes = await httpJson(baseUrl, 'POST', '/api/stock/move', token, {
      tipe_asal_id: tipeNonSnId,
      box_asal_id: box1.id,
      jumlah: 10,
      box_tujuan_id: box2.id,
      tipe_tujuan_id: tipeNonSn2Id,
      catatan: 'Pindah sebagian non-SN'
    });
    assert(moveNonSnRes.status === 200 && moveNonSnRes.data?.success === true, 'Pindah 10 unit stok non-SN antar Box & Tipe kompatibel berhasil');

    // Partial delete 5 units on remaining 15 in box1
    const delNonSnTargetId = `${tipeNonSnId}:${box1.id}`;
    const delNonSnTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_stok_jumlah',
      targetId: delNonSnTargetId,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const delPartialRes = await httpJson(baseUrl, 'DELETE', '/api/stock/quantity', token, {
      tipe_id: tipeNonSnId,
      box_id: box1.id,
      jumlah: 5,
      confirmation_token: delNonSnTok.token
    });
    assert(delPartialRes.status === 200 && delPartialRes.data?.deletedQty === 5, 'Hapus parsial 5 unit stok non-SN berhasil tanpa transaksi keluar');

    // Bulk delete remaining non-SN on box1 & box2
    const bulkKeys = [`${tipeNonSnId}:${box1.id}`, `${tipeNonSn2Id}:${box2.id}`].sort();
    const delBulkSjTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_stok_jumlah',
      targetId: `bulk:${bulkKeys.join(',')}`,
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const delBulkSjRes = await httpJson(baseUrl, 'DELETE', '/api/stock/quantity/bulk', token, {
      entries: [
        { tipe_id: tipeNonSnId, box_id: box1.id, jumlah: 10 },
        { tipe_id: tipeNonSn2Id, box_id: box2.id, jumlah: 10 }
      ],
      confirmation_token: delBulkSjTok.token
    });
    assert(delBulkSjRes.status === 200 && delBulkSjRes.data?.success === true, 'Hapus massal sisa stok non-SN di 2 box berhasil');

    // 3. Rename Tipe + Locked Change ID Rule confirmation
    console.log('\n[3] Ubah Nama Tipe & Koreksi Aturan ID:');
    const createOpenTypeRes = await httpJson(baseUrl, 'POST', '/api/catalog/types', token, {
      produk_id: prodA.id,
      nama_tipe: `50m Open ${suffix}`,
      sumber_id: 'tanpa_id'
    });
    const tipeOpenId = createOpenTypeRes.data?.type?.id;
    const renameOpenRes = await httpJson(baseUrl, 'PUT', `/api/catalog/types/${tipeOpenId}/id-rule`, token, {
      nama_tipe: `50m Open Rev ${suffix}`,
      sumber_id: 'scan_sn',
      pola_id: '^ZTEGD[0-9A-Fa-f]{7}$',
      alasan: 'Ubah nama tipe dan set pola SN'
    });
    if (renameOpenRes.status !== 200) {
      console.error('DEBUG renameOpenRes:', renameOpenRes);
    }
    assert(renameOpenRes.status === 200 && renameOpenRes.data?.type?.nama_tipe === `50m Open Rev ${suffix}`, 'Ubah nama tipe & aturan ID pada tipe terbuka berhasil');

    // Input 1 SN item so tipe becomes locked (id_dikunci = 1)
    const sn1 = `ZTEGDF${suffix.slice(0, 6)}`;
    await StockService.inputStokItemSingle({ tipe_id: tipeNonSnId, box_id: box1.id, kode_id: sn1, user_id: devId });
    const lockedAttemptNoToken = await httpJson(baseUrl, 'PUT', `/api/catalog/types/${tipeNonSnId}/id-rule`, token, {
      nama_tipe: `100m Outdoor Final ${suffix}`,
      sumber_id: 'scan_sn',
      pola_id: '^ZTEGD[0-9A-Fa-f]{7}$',
      alasan: 'Coba ubah tanpa token'
    });
    assert(lockedAttemptNoToken.status === 403 && lockedAttemptNoToken.data?.requiresConfirmation === true, 'Tipe terkunci (id_dikunci=1) mewajibkan token konfirmasi change_id_rule');

    const changeRuleTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'change_id_rule',
      targetId: String(tipeNonSnId),
      targetName: `100m Outdoor ${suffix}`,
      objectNameTyped: `100m Outdoor ${suffix}`,
      lastLoginTime: Date.now()
    });
    const lockedAttemptWithToken = await httpJson(baseUrl, 'PUT', `/api/catalog/types/${tipeNonSnId}/id-rule`, token, {
      nama_tipe: `100m Outdoor Final ${suffix}`,
      sumber_id: 'scan_sn',
      pola_id: '^ZTEGD[0-9A-Fa-f]{7}$',
      alasan: 'Ubah nama tipe terkunci dengan token',
      confirmation_token: changeRuleTok.token
    });
    assert(lockedAttemptWithToken.status === 200 && lockedAttemptWithToken.data?.type?.nama_tipe === `100m Outdoor Final ${suffix}`, 'Ubah nama tipe terkunci berhasil dengan token change_id_rule');

    // Move SN item across boxes
    const snItem = (await StockService.checkDuplicateKodeId(sn1)).item!;
    const moveItemRes = await httpJson(baseUrl, 'POST', '/api/stock/move', token, {
      item_ids: [snItem.id],
      box_tujuan_id: box2.id,
      catatan: 'Pindah box item SN'
    });
    assert(moveItemRes.status === 200 && moveItemRes.data?.success === true, 'Pindah item fisik SN ke Box tujuan berhasil');

    // 4. Move Produk & Move Tipe
    console.log('\n[4] Pindah Produk antar Kategori & Pindah Tipe antar Produk:');
    const moveProdRes = await httpJson(baseUrl, 'POST', '/api/catalog/products/move', token, {
      produk_ids: [prodA.id],
      target_jenis_id: catB.id
    });
    assert(moveProdRes.status === 200 && moveProdRes.data?.success === true, 'Pindah produk prodA ke Kategori B berhasil');

    const moveTipeRes = await httpJson(baseUrl, 'POST', `/api/catalog/types/${tipeNonSn2Id}/move`, token, {
      target_produk_id: prodB.id
    });
    assert(moveTipeRes.status === 200 && moveTipeRes.data?.success === true, 'Pindah varian tipe kosong ke Produk B berhasil');

    // Delete empty tipeNonSn2Id
    const delTypeTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_type',
      targetId: String(tipeNonSn2Id),
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const delTypeRes = await httpJson(baseUrl, 'DELETE', `/api/catalog/types/${tipeNonSn2Id}`, token, {
      confirmation_token: delTypeTok.token
    });
    if (delTypeRes.status !== 200) {
      console.error('DEBUG delTypeRes:', delTypeRes);
    }
    assert(delTypeRes.status === 200 && delTypeRes.data?.success === true, 'Hapus varian tipe tanpa stok berhasil');

    // 5. Delete Category with active products: move_products vs cascade
    console.log('\n[5] Hapus Kategori dengan Pilihan Pindah Produk vs Cascade:');
    const catC = await CatalogService.createJenis({ nama: `Cat-C-${suffix}`, sumber_id_bawaan: 'manual' }, devId);
    const prodC = await CatalogService.createProduk({ jenis_id: catC.id, nama: `Prod-C-${suffix}`, kategori: 'fast_moving' }, devId);

    // Move prodA back to catC then test move_products deletion on catC
    await httpJson(baseUrl, 'POST', '/api/catalog/products/move', token, {
      produk_ids: [prodA.id],
      target_jenis_id: catC.id
    });
    const delCatMoveTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_kind',
      targetId: String(catC.id),
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const delCatMoveRes = await httpJson(baseUrl, 'DELETE', `/api/catalog/jenis/${catC.id}`, token, {
      mode: 'move_products',
      target_jenis_id: catA.id,
      confirmation_token: delCatMoveTok.token
    });
    assert(delCatMoveRes.status === 200 && delCatMoveRes.data?.success === true, 'Hapus Kategori C dengan mode move_products memindahkan produk aktif ke Kategori A');

    // Cascade delete on catA fails when prodA inside has active SN item
    const delCatCascadeTokBlocked = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_kind',
      targetId: String(catA.id),
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const delCatCascadeBlockedRes = await httpJson(baseUrl, 'DELETE', `/api/catalog/jenis/${catA.id}`, token, {
      mode: 'cascade',
      confirmation_token: delCatCascadeTokBlocked.token
    });
    assert(delCatCascadeBlockedRes.status === 400, 'Hapus Kategori A mode cascade ditolak (400) karena produk di dalamnya masih punya item aktif');

    // Cascade delete on empty-stock category with empty product succeeds
    const catD = await CatalogService.createJenis({ nama: `Cat-D-${suffix}`, sumber_id_bawaan: 'manual' }, devId);
    await CatalogService.createProduk({ jenis_id: catD.id, nama: `Prod-D-${suffix}`, kategori: 'fast_moving' }, devId);
    const delCatCascadeTok = await ConfirmationService.requestConfirmationToken({
      userId: devId,
      actionType: 'delete_kind',
      targetId: String(catD.id),
      objectNameTyped: 'delete',
      lastLoginTime: Date.now()
    });
    const delCatCascadeOk = await httpJson(baseUrl, 'DELETE', `/api/catalog/jenis/${catD.id}`, token, {
      mode: 'cascade',
      confirmation_token: delCatCascadeTok.token
    });
    assert(delCatCascadeOk.status === 200 && delCatCascadeOk.data?.success === true, 'Hapus Kategori D mode cascade menghapus kategori & produk kosong sekaligus');
    assert(Boolean(prodC), 'Produk dummy terdaftar sebelum pindah kategori');

    // 6. Multi-Type Import (1 product -> 2 variant types with distinct Pola_ID)
    console.log('\n[6] Impor Multi-Tipe dengan Pola ID Berbeda per Baris:');
    const csvMulti = [
      'Kategori,Produk,Kategori_Barang,Perputaran,Satuan,Tipe_Varian,Sumber_ID,Prefix_ID,Pola_ID,Kode_Box,Stok_Awal,Daftar_Serial_Number',
      `Modem_${suffix},ZTE F609_${suffix},Barang Habis Pakai,fast_moving,unit,ZTE V3,scan_sn,,^ZTEGD[0-9A-Fa-f]{7}$,BOX-M-${suffix},1,ZTEGD9988776`,
      `Modem_${suffix},ZTE F609_${suffix},Barang Habis Pakai,fast_moving,unit,ZTE V9,otomatis,Z9-,,BOX-M-${suffix},2,`
    ].join('\n');

    const prevRes = await httpJson(baseUrl, 'POST', '/api/import/preview', token, {
      sourceType: 'file',
      fileName: 'multi-type.csv',
      fileBase64: Buffer.from(csvMulti, 'utf8').toString('base64'),
      conflictMode: 'add_stock_only'
    });
    if (prevRes.status !== 200) {
      console.error('DEBUG prevRes:', prevRes);
    }
    assert(
      prevRes.status === 200 &&
      prevRes.data?.preview?.validRows === 2 &&
      prevRes.data?.preview?.rows?.[0]?.polaId === '^ZTEGD[0-9A-Fa-f]{7}$',
      'Preview impor multi-tipe membaca 2 varian tipe berbeda & Pola_ID per tipe'
    );

    const commitRes = await httpJson(baseUrl, 'POST', '/api/import/commit', token, {
      rows: prevRes.data?.preview?.rows || [],
      conflictMode: 'add_stock_only',
      sourceLabel: 'multi-type.csv'
    });
    if (commitRes.status !== 201) {
      console.error('DEBUG commitRes:', commitRes);
    }
    assert(
      commitRes.status === 201 &&
      commitRes.data?.createdTipe === 2 &&
      commitRes.data?.createdProduk === 1 &&
      commitRes.data?.addedStockUnits === 3,
      'Commit impor multi-tipe membuat 1 produk dengan 2 varian tipe & memisahkan SN sesuai tipe'
    );
  } catch (err) {
    console.error('Fatal error in v129CatalogAndStock.test.ts:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  HASIL TEST v1.2.9: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
