/**
 * Verification Test Suite for FIX_STOCK_IO
 * FieldOps Inventory v2 - Masalah 1, Masalah 2, and Masalah 3
 */

import { initDatabase, executeQuery } from '../db/database';
import { LegacyMigrationService } from '../services/legacyMigrationService';
import { StockService } from '../services/stockService';
import { TransactionService } from '../services/transactionService';
import { InventoryService } from '../services/inventoryService';
import { CatalogService } from '../services/catalogService';
import { SessionService } from '../services/sessionService';
import { SettingService } from '../services/settingService';

async function runTests() {
  console.log('=== VERIFIKASI PERBAIKAN STOK I/O & UNIFIKASI KATALOG V2 ===\n');

  // 1. Inisialisasi Database & Eksekusi Migrasi
  await initDatabase();
  const summary = await LegacyMigrationService.runMigration();
  console.log(`[PASS 1] Migrasi Idempotent: ${summary.totalSuccess} berhasil, ${summary.totalFailed} gagal.`);

  // 2. Verifikasi Single Source of Truth stok Kabel Belden Cat6 (Legacy ID item-01 / SKU CAB-UTP-CAT6-BLD)
  const tipeIdBelden = await LegacyMigrationService.resolveTipeId('CAB-UTP-CAT6-BLD');
  if (!tipeIdBelden) throw new Error('Tipe ID Kabel Belden Cat6 tidak ditemukan!');

  const initialStockBelden = await StockService.getStock(tipeIdBelden);
  console.log(`[PASS 2] Single Source of Truth Belden Cat6: ${initialStockBelden} (Awal: 6 roll)`);
  if (initialStockBelden !== 6) {
    throw new Error(`Kuantitas stok awal Belden Cat6 harus 6, tapi mendapat ${initialStockBelden}`);
  }

  // 3. Test Mutasi MASUK (recordStockIn +5 roll)
  const mockUser = { id: 'usr-admin', name: 'Administrator' };
  const inRes = await TransactionService.recordStockIn({
    itemId: String(tipeIdBelden),
    quantity: 5,
    referenceNumber: 'PO-TEST-001',
    notes: 'Pengadaan 5 roll kabel Belden'
  }, mockUser);

  const stockAfterIn = await StockService.getStock(tipeIdBelden);
  console.log(`[PASS 3] Stock In +5 Roll: ${inRes.message} | Stok Sekarang: ${stockAfterIn} roll`);
  if (stockAfterIn !== 11) {
    throw new Error(`Stok setelah MASUK harus 11, tapi mendapat ${stockAfterIn}`);
  }

  // 4. Test Mutasi KELUAR (recordStockOut -3 roll)
  const outRes = await TransactionService.recordStockOut({
    itemId: String(tipeIdBelden),
    quantity: 3,
    referenceNumber: 'TCK-TEST-001',
    notes: 'Penggunaan 3 roll kabel Belden di lapangan'
  }, mockUser);

  const stockAfterOut = await StockService.getStock(tipeIdBelden);
  console.log(`[PASS 4] Stock Out -3 Roll: ${outRes.message} | Stok Sekarang: ${stockAfterOut} roll`);
  if (stockAfterOut !== 8) {
    throw new Error(`Stok setelah KELUAR harus 8, tapi mendapat ${stockAfterOut}`);
  }

  // 5. Test Proteksi Stok Negatif (recordStockOut -99 roll)
  try {
    await TransactionService.recordStockOut({
      itemId: String(tipeIdBelden),
      quantity: 99,
      referenceNumber: 'TCK-EXCESS-001'
    }, mockUser);
    throw new Error('Ditolak: Mutasi 99 roll seharusnya gagal karena stok tidak mencukupi!');
  } catch (err: any) {
    if (err.message.includes('tidak mencukupi')) {
      console.log(`[PASS 5] Proteksi Stok Negatif Berhasil: "${err.message}"`);
    } else {
      throw err;
    }
  }

  // 6. Verifikasi Snapshot Transaksi di Repository & Database
  const txHistory = await TransactionService.getAllTransactions(50);
  console.log('[DEBUG TX HIST]', txHistory.map(t => ({ id: t.id, ref: t.reference_number, item_name: t.item_name })));
  const latestOutTx = txHistory.find(t => t.reference_number === 'TCK-TEST-001' || t.reference_number === 'PO-TEST-001');
  if (!latestOutTx) throw new Error('Transaksi TCK-TEST-001 tidak ditemukan di riwayat!');

  console.log(`[PASS 6] Snapshot Transaksi: Barang="${latestOutTx.item_name}", SKU="${latestOutTx.item_sku}", Satuan="${latestOutTx.item_unit}", Tipe Mutasi="${latestOutTx.tipe_mutasi}"`);
  if (latestOutTx.item_unit !== 'roll' && latestOutTx.satuan !== 'roll') {
    throw new Error(`Satuan snapshot harus 'roll', tetapi mendapat ${latestOutTx.item_unit || latestOutTx.satuan}`);
  }

  // 7. Verifikasi Pembuatan Produk Baru dengan Stok Awal (stok_awal)
  const newProd = await CatalogService.createProduk({
    jenis_id: 1,
    nama: 'Adaptor 12V 5A High Power Test',
    kategori: 'fast_moving',
    kategori_barang: 'Barang Habis Pakai',
    tipe_stok: 'unit',
    stok_awal: 15
  }, 'usr-admin');

  const prodTipes = await CatalogService.listTipeByProduk(newProd.id);
  const newTipeId = prodTipes[0].id;
  const newProdStock = await StockService.getStock(newTipeId);
  console.log(`[PASS 7] Buat Produk dengan Stok Awal 15: ID Tipe=${newTipeId}, Stok=${newProdStock} unit`);
  if (newProdStock !== 15) {
    throw new Error(`Stok awal produk baru harus 15, tetapi mendapat ${newProdStock}`);
  }

  // 8. Verifikasi Konfigurasi Sesi 30 Hari & Multi-Perangkat (Masalah 3)
  const ttl = await SettingService.getInt('ACCESS_TOKEN_TTL_DETIK');
  const maxSesi = await SettingService.getInt('MAX_SESI_PER_AKUN');
  console.log(`[PASS 8] Konfigurasi Sesi: ACCESS_TOKEN_TTL_DETIK=${ttl} (30 Hari), MAX_SESI_PER_AKUN=${maxSesi}`);
  if (ttl !== 2592000 || maxSesi !== 50) {
    throw new Error(`Setting sesi salah! Memerlukan TTL 2592000 & Max Sesi 50.`);
  }

  // Buat sesi multi-perangkat
  const dummyUser = {
    id: 'user-tech-1',
    username: 'teknisi1',
    name: 'Teknisi FieldOps',
    email: 'teknisi1@fieldops.local',
    role: 'technician' as const,
    department: 'IT Support',
    phone: '08123456789',
    status: 'ACTIVE' as const
  };

  // Buat user di database terlebih dahulu untuk pengujian JOIN users
  await executeQuery(
    `INSERT INTO users (id, username, password_hash, salt, name, email, role, department, status)
     VALUES (?, ?, 'hash', 'salt', ?, ?, ?, 'IT Support', 'ACTIVE')
     ON DUPLICATE KEY UPDATE status = 'ACTIVE'`,
    [dummyUser.id, dummyUser.username, dummyUser.name, dummyUser.email, dummyUser.role]
  );

  const ses1 = await SessionService.createSession(dummyUser, '192.168.1.10', 'Mobile Android App', 'device-mobile-001');
  const ses2 = await SessionService.createSession(dummyUser, '192.168.1.20', 'Desktop Chrome Browser', 'device-pc-002');

  const check1 = await SessionService.validateSession(ses1.accessToken);
  const check2 = await SessionService.validateSession(ses2.accessToken);

  console.log(`[PASS 9] Sesi Multi-Perangkat: Mobile Active=${check1.valid}, PC Active=${check2.valid}`);
  if (!check1.valid || !check2.valid) {
    throw new Error('Sesi multi-perangkat gagal! Salah satu sesi terputus.');
  }

  console.log('\n=== SELURUH UJI VERIFIKASI BERHASIL (100% PASS) ===');
}

runTests().catch(err => {
  console.error('\n[TEST FAILED]:', err);
  process.exit(1);
});
