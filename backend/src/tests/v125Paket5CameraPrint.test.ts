/**
 * Test Suite: FieldOps v1.2.5 Paket 5 (Kamera dan Laporan Cetak)
 * Lokasi: backend/src/tests/v125Paket5CameraPrint.test.ts
 * 
 * Cakupan Pengujian:
 * 1. Scan kode valid (SKU, Barcode, ID) ditangani dengan benar dan mengembalikan detail barang.
 * 2. Scan kode tidak valid ditolak dan menghasilkan pesan error informatif.
 * 3. Transaksi masuk (Stock IN) via hasil scan menambah stok fisik dan mencatat tipe 'IN'.
 * 4. Transaksi keluar (Stock OUT) via hasil scan mengurangi stok fisik dan mencatat tipe 'OUT'.
 * 5. Transaksi keluar (Stock OUT) menolak kuantitas yang melebihi sisa stok fisik.
 * 6. Transaksi ditolak jika barang tidak terdaftar di database inventori.
 * 7. Template cetak laporan memiliki Kop Resmi, Logo, Metadata Cetak, dan thead berulang (table-header-group).
 * 8. Isolasi cetak: navbar, header, footer, dan tombol aksi memiliki kelas no-print dan disembunyikan pada @media print.
 */

import { executeQuery, initDatabase, memoryStore } from '../db/database';
import { InventoryService } from '../services/inventoryService';
import { TransactionService } from '../services/transactionService';
import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' RUNNING TESTS: FieldOps v1.2.5 Paket 5 (Kamera & Cetak A4)');
  console.log('================================================================\n');

  // 1. Setup Database
  await test('Inisialisasi database inventori & migrasi', async () => {
    await initDatabase();
  });

  const testOperatorId = `user-op-${Date.now()}`;
  const testOperator = { id: testOperatorId, name: 'Budi Teknisi Lapangan' };

  await executeQuery(
    `INSERT INTO users (id, username, name, email, role, department, password_hash, salt, status)
     VALUES (?, ?, ?, ?, 'warehouse_admin', 'Logistik', 'hash123', 'salt123', 'ACTIVE')`,
    [testOperatorId, `op_${Date.now()}`, testOperator.name, `op_${Date.now()}@fieldops.id`]
  );

  // Buat kategori & barang pengujian
  const catCode = `CAT-${Date.now().toString().slice(-4)}`;
  const testCat = await InventoryService.createCategory(catCode, 'Kategori Alat Uji Paket 5', 'Testing');

  const testSku = `CAB-SFP-${Date.now().toString().slice(-4)}`;
  const testBarcode = `899123456${Date.now().toString().slice(-4)}`;
  const initialQty = 10;

  const itemBarang = await InventoryService.createItem({
    sku: testSku,
    barcode: testBarcode,
    name: 'Kabel Patch Cord Fiber Optic LC-LC Duplex 3M',
    category_id: testCat.id,
    quantity: initialQty,
    min_stock_alert: 3,
    unit: 'pcs',
    location: 'Rak B-04'
  }, testOperatorId);

  // 2. Pengujian Scan Kode Valid
  await test('Scan SKU valid mengembalikan detail barang yang tepat', async () => {
    const found = await InventoryService.getItemByCode(testSku);
    if (!found) throw new Error(`Barang dengan SKU ${testSku} gagal ditemukan.`);
    if (found.id !== itemBarang.id) throw new Error(`ID barang tidak cocok: ${found.id} !== ${itemBarang.id}`);
    if (found.quantity !== initialQty) throw new Error(`Kuantitas tidak sesuai: ${found.quantity} !== ${initialQty}`);
  });

  await test('Scan Barcode valid mengembalikan detail barang yang tepat', async () => {
    const found = await InventoryService.getItemByCode(testBarcode);
    if (!found) throw new Error(`Barang dengan Barcode ${testBarcode} gagal ditemukan.`);
    if (found.sku !== testSku) throw new Error(`SKU barang tidak cocok: ${found.sku} !== ${testSku}`);
  });

  await test('Scan ID valid mengembalikan detail barang yang tepat', async () => {
    const found = await InventoryService.getItemByCode(itemBarang.id);
    if (!found) throw new Error(`Barang dengan ID ${itemBarang.id} gagal ditemukan.`);
    if (found.name !== itemBarang.name) throw new Error('Nama barang tidak cocok.');
  });

  // 3. Pengujian Scan Kode Tidak Valid
  await test('Scan kode acak/tidak valid mengembalikan null (barang tidak ditemukan)', async () => {
    const found = await InventoryService.getItemByCode('BARCODE-TIDAK-ADA-999999');
    if (found !== null) throw new Error('Kode tidak valid seharusnya mengembalikan null.');
  });

  await test('Scan kode kosong atau spasi mengembalikan null', async () => {
    const found = await InventoryService.getItemByCode('   ');
    if (found !== null) throw new Error('Kode kosong seharusnya mengembalikan null.');
  });

  // 4. Pengujian Transaksi Masuk (Stock IN) via Scan
  await test('Transaksi Masuk (IN) dengan kode valid menambah stok dan mencatat tipe IN', async () => {
    const addQty = 5;
    const resIn = await TransactionService.recordStockIn({
      itemId: itemBarang.id,
      quantity: addQty,
      referenceType: 'PURCHASE_ORDER',
      referenceNumber: 'PO-2026-P5-001',
      sourceOrVendor: 'Supplier Optik Mandiri',
      notes: 'Penerimaan restock via scan barcode kamera'
    }, testOperator);

    if (!resIn.success) throw new Error('Gagal mencatat mutasi stok masuk.');
    if (!resIn.item) throw new Error('Item hasil mutasi tidak dikembalikan.');
    if (resIn.item.quantity !== initialQty + addQty) {
      throw new Error(`Stok akhir (${resIn.item.quantity}) !== perkiraan (${initialQty + addQty})`);
    }

    // Periksa pencatatan transaksi mutasi
    const txRows = await executeQuery<any>('SELECT * FROM transactions WHERE id = ?', [resIn.transactionId]);
    if (txRows.length === 0) throw new Error('Transaksi tidak tercatat di tabel transactions.');
    const tx = txRows[0];
    if (tx.type !== 'IN') throw new Error(`Tipe transaksi salah: ${tx.type} (diharapkan 'IN')`);
    if (Number(tx.quantity) !== addQty) throw new Error(`Kuantitas transaksi salah: ${tx.quantity}`);
    if (Number(tx.previous_qty) !== initialQty) throw new Error('Previous qty tidak cocok.');
    if (Number(tx.new_qty) !== initialQty + addQty) throw new Error('New qty tidak cocok.');
  });

  // 5. Pengujian Transaksi Keluar (Stock OUT) via Scan
  await test('Transaksi Keluar (OUT) dengan kode valid mengurangi stok dan mencatat tipe OUT', async () => {
    const currentItem = await InventoryService.getItemById(itemBarang.id);
    const prevQty = currentItem!.quantity;
    const deductQty = 4;

    const resOut = await TransactionService.recordStockOut({
      itemId: itemBarang.id,
      quantity: deductQty,
      referenceType: 'TICKET_EXTERNAL',
      referenceNumber: 'TCK-2026-P5-998',
      recipientOrDestination: 'POP Sudirman Lt 5',
      notes: 'Penggantian kabel putus perbaikan tiket insiden'
    }, testOperator);

    if (!resOut.success) throw new Error('Gagal mencatat mutasi stok keluar.');
    if (!resOut.item) throw new Error('Item hasil mutasi tidak dikembalikan.');
    if (resOut.item.quantity !== prevQty - deductQty) {
      throw new Error(`Stok akhir (${resOut.item.quantity}) !== perkiraan (${prevQty - deductQty})`);
    }

    // Periksa pencatatan transaksi mutasi
    const txRows = await executeQuery<any>('SELECT * FROM transactions WHERE id = ?', [resOut.transactionId]);
    if (txRows.length === 0) throw new Error('Transaksi keluar tidak tercatat.');
    const tx = txRows[0];
    if (tx.type !== 'OUT') throw new Error(`Tipe transaksi salah: ${tx.type} (diharapkan 'OUT')`);
    if (Number(tx.quantity) !== deductQty) throw new Error('Kuantitas keluar tidak cocok.');
  });

  // 6. Pengujian Validasi Stok Tidak Cukup pada Transaksi Keluar
  await test('Transaksi Keluar (OUT) ditolak jika kuantitas melebihi sisa stok', async () => {
    const currentItem = await InventoryService.getItemById(itemBarang.id);
    const excessiveQty = currentItem!.quantity + 100;

    let threwError = false;
    try {
      await TransactionService.recordStockOut({
        itemId: itemBarang.id,
        quantity: excessiveQty,
        referenceNumber: 'TCK-OVER-001'
      }, testOperator);
    } catch (err: any) {
      threwError = true;
      if (!err.message.includes('tidak mencukupi')) {
        throw new Error(`Pesan error tidak sesuai: ${err.message}`);
      }
    }

    if (!threwError) throw new Error('Seharusnya transaksi keluar melebihi stok ditolak.');
  });

  // 7. Pengujian Penolakan Transaksi pada Barang Tidak Terdaftar
  await test('Transaksi masuk menolak item ID yang tidak ada di database', async () => {
    let threwError = false;
    try {
      await TransactionService.recordStockIn({
        itemId: 'ITEM-NON-EXISTENT-999',
        quantity: 5
      }, testOperator);
    } catch (err: any) {
      threwError = true;
      if (!err.message.includes('tidak ditemukan')) {
        throw new Error(`Pesan error tidak sesuai: ${err.message}`);
      }
    }
    if (!threwError) throw new Error('Seharusnya transaksi pada ID fiktif ditolak.');
  });

  await test('Transaksi keluar menolak item ID yang tidak ada di database', async () => {
    let threwError = false;
    try {
      await TransactionService.recordStockOut({
        itemId: 'ITEM-NON-EXISTENT-999',
        quantity: 5
      }, testOperator);
    } catch (err: any) {
      threwError = true;
      if (!err.message.includes('tidak ditemukan')) {
        throw new Error(`Pesan error tidak sesuai: ${err.message}`);
      }
    }
    if (!threwError) throw new Error('Seharusnya transaksi keluar pada ID fiktif ditolak.');
  });

  // 8. Pengujian Struktur Template Cetak Laporan (PrintReportModal)
  await test('File PrintReportModal.tsx ada dan memiliki komponen Kop Resmi, Tabel thead berulang, dan Lembar Pengesahan', async () => {
    const filePath = path.join(process.cwd(), 'frontend/src/components/reports/PrintReportModal.tsx');
    if (!fs.existsSync(filePath)) {
      throw new Error('Komponen PrintReportModal.tsx tidak ditemukan.');
    }
    const content = fs.readFileSync(filePath, 'utf-8');

    // 1. Verifikasi Kop Surat Resmi
    if (!content.includes('PT. SOLUSI INFORMATIKA LAPANGAN')) {
      throw new Error('Kop resmi instansi tidak ditemukan dalam PrintReportModal.');
    }
    if (!content.includes('LAPORAN AUDIT & MUTASI STOK SUKU CADANG IT')) {
      throw new Error('Judul laporan tidak ditemukan.');
    }
    if (!content.includes('logo.webp') && !content.includes('logo-full.webp')) {
      throw new Error('Logo tidak ditemukan pada Kop Surat.');
    }

    // 2. Verifikasi thead berulang pada cetak
    if (!content.includes('print:table-header-group') && !content.includes('table-header-group')) {
      throw new Error('Header tabel tidak dikonfigurasi untuk berulang di tiap halaman cetak.');
    }

    // 3. Verifikasi Lembar Pengesahan (Signatures)
    if (!content.includes('Dibuat Oleh') || !content.includes('Diverifikasi') || !content.includes('Disetujui')) {
      throw new Error('Lembar tanda tangan pengesahan tidak lengkap.');
    }

    // 4. Verifikasi Metadata Cetak (Periode & Dicetak Oleh)
    if (!content.includes('Dicetak Oleh') || !content.includes('Periode Laporan')) {
      throw new Error('Metadata cetak (Dicetak Oleh / Periode) tidak ditemukan.');
    }
  });

  // 9. Pengujian Isolasi Media Print & CSS @page
  await test('File index.css mengonfigurasi ukuran A4 portrait, thead table-header-group, dan isolasi no-print', async () => {
    const cssPath = path.join(process.cwd(), 'frontend/src/index.css');
    if (!fs.existsSync(cssPath)) throw new Error('File index.css tidak ditemukan.');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    if (!cssContent.includes('size: A4 portrait') && !cssContent.includes('size: A4')) {
      throw new Error('CSS @page ukuran A4 tidak dikonfigurasi.');
    }
    if (!cssContent.includes('thead') || !cssContent.includes('table-header-group')) {
      throw new Error('CSS thead display: table-header-group tidak ditemukan.');
    }
    if (!cssContent.includes('.no-print') || !cssContent.includes('display: none !important')) {
      throw new Error('CSS .no-print display: none tidak ditemukan.');
    }
  });

  // 10. Pengujian Header Navbar & Footer Memiliki Kelas no-print
  await test('Navbar dan Footer memiliki kelas no-print agar tidak muncul pada cetakan kertas', async () => {
    const navbarPath = path.join(process.cwd(), 'frontend/src/components/Navbar.tsx');
    const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
    if (!navbarContent.includes('no-print')) {
      throw new Error('Kelas no-print tidak ditemukan pada Navbar.');
    }

    const appPath = path.join(process.cwd(), 'frontend/src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    if (!appContent.includes('footer className="no-print')) {
      throw new Error('Footer pada App.tsx tidak memiliki kelas no-print.');
    }
  });

  // 11. Pengujian Integrasi Pemindai Kamera pada Modal Keluar/Masuk
  await test('StockInOutModal.tsx memuat logika scanner kamera dan pemrosesan kode barcode/QR', async () => {
    const modalPath = path.join(process.cwd(), 'frontend/src/components/StockInOutModal.tsx');
    if (!fs.existsSync(modalPath)) throw new Error('StockInOutModal.tsx tidak ditemukan.');
    const content = fs.readFileSync(modalPath, 'utf-8');

    if (!content.includes('getUserMedia')) {
      throw new Error('Logika pemindai kamera (getUserMedia) tidak ditemukan dalam StockInOutModal.');
    }
    if (!content.includes('videoRef')) {
      throw new Error('Elemen video kamera (videoRef) tidak ditemukan dalam StockInOutModal.');
    }
    if (!content.includes('handleProcessCode') && !content.includes('scanItem')) {
      throw new Error('Handler pemrosesan kode scan tidak ditemukan dalam StockInOutModal.');
    }
  });

  // Tampilkan Ringkasan
  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(` HASIL PENGUJIAN PAKET 5: ${passed}/${total} PASS (${failed} GAGAL)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
