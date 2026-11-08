/**
 * Unit & Integration Test Suite - Paket 2: Perbaikan Bug Stok & Ekspor Excel (v1.2.5)
 * FieldOps IT Inventory Rebuild
 */

import { initDatabase, executeQuery } from '../db/database';
import { TransactionService } from '../services/transactionService';
import { StockService } from '../services/stockService';
import { sanitizeFormulaInput } from '../utils/security';

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

async function runPaket2Tests() {
  console.log('================================================================');
  console.log('  FIELDOPS IT V1.2.5 - PENGUJIAN OTOMATIS PAKET 2 (MUTASI STOK & EXCEL)');
  console.log('================================================================\n');

  await initDatabase();

  const userDev = { id: 'usr-dev-01', name: 'System Developer' };

  // Setup sample item
  const testItemId = `item-test-pkt2-${Date.now()}`;
  const testSku = `SKU-PKT2-${Date.now()}`;

  await executeQuery(
    `INSERT INTO items (id, sku, barcode, name, category_id, quantity, min_stock_alert, unit, location, specs, unit_cost, status, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
    [testItemId, testSku, 'BC-PKT2-01', 'MikroTik RB750Gr3 Test Paket 2', 'cat-cables', 10, 2, 'unit', 'Rak Test A', '', 0, 'NORMAL']
  );

  // 1. Pengujian Stock IN (Masuk Stok Menambah Jumlah & Recorded type = 'IN')
  console.log('[1] Pengujian Transaksi Stock IN (Barang Masuk):');
  const initialQty = 10;
  const inQty = 5;

  const stockInRes = await TransactionService.recordStockIn({
    itemId: testItemId,
    quantity: inQty,
    referenceNumber: 'PO-TEST-IN-001',
    sourceOrVendor: 'Vendor Utama Micro',
    notes: 'Pengujian Mutasi Barang Masuk Paket 2'
  }, userDev);

  assert(stockInRes.success === true, 'Pencatatan Stock IN berhasil');
  assert(stockInRes.item?.quantity === initialQty + inQty, `Kuantitas stok bertambah dari ${initialQty} menjadi ${initialQty + inQty} (Actual: ${stockInRes.item?.quantity})`);

  const txInRows = await executeQuery<any>('SELECT * FROM transactions WHERE id = ?', [stockInRes.transactionId]);
  assert(txInRows && txInRows.length > 0, 'Data transaksi tercatat di database');
  assert(txInRows[0].type === 'IN', `Tipe transaksi tercatat sebagai "IN" (Actual: ${txInRows[0].type})`);
  assert(txInRows[0].previous_qty === initialQty, `Previous qty sesuai (${initialQty})`);
  assert(txInRows[0].new_qty === initialQty + inQty, `New qty sesuai (${initialQty + inQty})`);

  // 2. Pengujian Stock OUT (Keluar Stok Mengurangi Jumlah & Recorded type = 'OUT')
  console.log('\n[2] Pengujian Transaksi Stock OUT (Barang Keluar):');
  const currentQty = initialQty + inQty; // 15
  const outQty = 3;

  const stockOutRes = await TransactionService.recordStockOut({
    itemId: testItemId,
    quantity: outQty,
    referenceNumber: 'TCK-TEST-OUT-001',
    recipientOrDestination: 'Cabang Sudirman Lt 2',
    notes: 'Pengujian Mutasi Barang Keluar Paket 2'
  }, userDev);

  assert(stockOutRes.success === true, 'Pencatatan Stock OUT berhasil');
  assert(stockOutRes.item?.quantity === currentQty - outQty, `Kuantitas stok berkurang dari ${currentQty} menjadi ${currentQty - outQty} (Actual: ${stockOutRes.item?.quantity})`);

  const txOutRows = await executeQuery<any>('SELECT * FROM transactions WHERE id = ?', [stockOutRes.transactionId]);
  assert(txOutRows && txOutRows.length > 0, 'Data transaksi keluar tercatat di database');
  assert(txOutRows[0].type === 'OUT', `Tipe transaksi tercatat sebagai "OUT" (Actual: ${txOutRows[0].type})`);
  assert(txOutRows[0].previous_qty === currentQty, `Previous qty sesuai (${currentQty})`);
  assert(txOutRows[0].new_qty === currentQty - outQty, `New qty sesuai (${currentQty - outQty})`);

  // 3. Pengujian Sync V2 StockService (inputStokItemSingle & barangKeluarSingle)
  console.log('\n[3] Pengujian Sync v2 StockService (Single Scan & Barang Keluar):');
  
  // Setup Box & Tipe untuk StockService
  const testBoxId = `box-pkt2-${Date.now()}`;
  await StockService.createBox(`BOX-PKT2-${Date.now().toString().slice(-4)}`, 'Box Test Paket 2', userDev.id);
  const boxes = await StockService.listBoxes();
  const boxPkt2 = boxes[0];

  const singleSn = `SN-PKT2-${Date.now()}`;
  const stockSingleIn = await StockService.inputStokItemSingle({
    tipe_id: 1,
    box_id: boxPkt2.id,
    kode_id: singleSn,
    user_id: userDev.id,
    catatan: 'Single Stock IN v2'
  });

  assert(stockSingleIn.success === true, 'Input Stok v2 Single Scan berhasil');

  const checkSingleInTx = await executeQuery<any>('SELECT * FROM transactions WHERE reference_number = ?', [singleSn]);
  assert(checkSingleInTx && checkSingleInTx.length > 0, 'Sync transaksi v2 tercatat di tabel transactions');
  assert(checkSingleInTx[0].type === 'IN', `Tipe transaksi v2 tercatat sebagai "IN" (Actual: ${checkSingleInTx[0].type})`);

  // Single Out
  const stockSingleOut = await StockService.barangKeluarSingle({
    kodeId: singleSn,
    userId: userDev.id,
    catatan: 'Single Stock OUT v2'
  });

  assert(stockSingleOut.success === true, 'Barang Keluar v2 Single Scan berhasil');

  const checkSingleOutTx = await executeQuery<any>('SELECT * FROM transactions WHERE reference_number = ? AND type = "OUT"', [singleSn]);
  assert(checkSingleOutTx && checkSingleOutTx.length > 0, 'Sync transaksi keluar v2 tercatat sebagai "OUT" di tabel transactions');

  // 4. Pengujian Sanitasi Formula Ekspor Excel (CWE-1236 Formula Injection Prevention)
  console.log('\n[4] Pengujian Sanitasi Formula Ekspor Excel (CWE-1236 Prevention):');
  const unsafeFormula = '=SUM(A1:A100)';
  const sanitizedFormula = sanitizeFormulaInput(unsafeFormula);
  assert(sanitizedFormula.startsWith("'="), `Karakter berisiko "=" diprefiks dengan tanda petik tunggal: "${sanitizedFormula}"`);

  const unsafeCmd = '+cmd|"/C calc"!A0';
  const sanitizedCmd = sanitizeFormulaInput(unsafeCmd);
  assert(sanitizedCmd.startsWith("'+"), `Karakter berisiko "+" diprefiks dengan tanda petik tunggal: "${sanitizedCmd}"`);

  // Ringkasan
  console.log('\n================================================================');
  if (testsFailed === 0) {
    console.log(`🎉 SELURUH PENGUJIAN PAKET 2 LULUS 100%! (${testsPassed} tes sukses)`);
  } else {
    console.error(`⚠️ PENGUJIAN PAKET 2 SELESAI DENGAN ${testsFailed} KEGAGALAN (${testsPassed} sukses)`);
  }
  console.log('================================================================\n');

  process.exit(testsFailed === 0 ? 0 : 1);
}

runPaket2Tests().catch(err => {
  console.error('Fatal Paket 2 Test Suite Error:', err);
  process.exit(1);
});
