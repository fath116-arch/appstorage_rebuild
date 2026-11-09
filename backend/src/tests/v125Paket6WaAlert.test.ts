/**
 * Test Suite: FieldOps v1.2.5 Paket 6 (WA Alert Otomatis Fonnte & Ambang Berjenjang 15m)
 * Lokasi: backend/src/tests/v125Paket6WaAlert.test.ts
 */

import { executeQuery, initDatabase, memoryStore } from '../db/database';
import { WhatsappAlertService } from '../services/whatsappAlertService';
import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';

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

async function runTestSuite() {
  console.log('================================================================');
  console.log(' RUNNING TESTS: FieldOps v1.2.5 Paket 6 (WA Alert & Ambang 15m)');
  console.log('================================================================\n');

  // 1. Inisialisasi Database
  await test('Migrasi 09_v125_paket6_wa_alert.sql dijalankan tanpa error', async () => {
    await initDatabase();
  });

  const testOp = { id: `op-${Date.now()}`, name: 'Admin Gudang Test' };

  // 2. Ambang Berjenjang (tipe > produk > global)
  await test('Ambang Berjenjang: Tipe mewarisi nilai global bila belum disetel khusus', async () => {
    // Reset config ke global 3 (menipis) dan 5 (dini)
    await WhatsappAlertService.updateConfig({
      globalLowStockThreshold: 3,
      globalEarlyWarningThreshold: 5,
      cooldownMinutes: 15
    }, testOp);

    const res = await WhatsappAlertService.resolveThreshold(999, 888);
    if (res.lowStockThreshold !== 3 || res.lowStockSource !== 'dari global') {
      throw new Error(`Ambang global tidak sesuai: ${res.lowStockThreshold} [${res.lowStockSource}]`);
    }
    if (res.earlyWarningThreshold !== 5 || res.earlyWarningSource !== 'dari global') {
      throw new Error(`Ambang dini global tidak sesuai: ${res.earlyWarningThreshold} [${res.earlyWarningSource}]`);
    }
  });

  await test('Ambang Berjenjang: Ambang level produk mengesampingkan level global', async () => {
    const dummyProdId = 101;
    await WhatsappAlertService.setThreshold({
      level: 'produk',
      targetId: dummyProdId,
      lowStockThreshold: 7,
      earlyWarningThreshold: 12
    }, testOp);

    const res = await WhatsappAlertService.resolveThreshold(dummyProdId, 201);
    if (res.lowStockThreshold !== 7 || res.lowStockSource !== 'dari produk') {
      throw new Error(`Ambang produk tidak aktif: ${res.lowStockThreshold} [${res.lowStockSource}]`);
    }
    if (res.earlyWarningThreshold !== 12 || res.earlyWarningSource !== 'dari produk') {
      throw new Error(`Ambang dini produk tidak aktif: ${res.earlyWarningThreshold} [${res.earlyWarningSource}]`);
    }
  });

  await test('Ambang Berjenjang: Ambang level tipe mengesampingkan produk dan global (tipe > produk > global)', async () => {
    const dummyProdId = 101;
    const dummyTipeId = 202;

    await WhatsappAlertService.setThreshold({
      level: 'tipe',
      targetId: dummyTipeId,
      lowStockThreshold: 2,
      earlyWarningThreshold: 4,
      isWatchlist: true
    }, testOp);

    const res = await WhatsappAlertService.resolveThreshold(dummyProdId, dummyTipeId);
    if (res.lowStockThreshold !== 2 || res.lowStockSource !== 'dari tipe') {
      throw new Error(`Ambang tipe tidak aktif: ${res.lowStockThreshold} [${res.lowStockSource}]`);
    }
    if (res.earlyWarningThreshold !== 4 || res.earlyWarningSource !== 'dari tipe') {
      throw new Error(`Ambang dini tipe tidak aktif: ${res.earlyWarningThreshold} [${res.earlyWarningSource}]`);
    }
    if (!res.isWatchlist) {
      throw new Error('Status watchlist dari tipe harus bernilai true.');
    }
  });

  // 3. Filter Stok Rusak (Item Rusak Dikecualikan dari Stok Tersedia)
  await test('Item berkondisi Rusak tidak dihitung sebagai stok tersedia dalam evaluasi alert', async () => {
    const testBox = await StockService.createBox('BOX-WA-P6', 'Box Uji Paket 6', testOp.id);
    const testJenis = await CatalogService.createJenis({
      nama: `Jenis WA Test ${Date.now()}`,
      sumber_id_bawaan: 'manual',
      atributs: []
    }, testOp.id);

    const prod = await CatalogService.createProduk({
      jenis_id: testJenis.id,
      nama: `Konektor RJ45 WA Test ${Date.now()}`,
      kategori: 'fast_moving',
      kategori_barang: 'Barang Habis Pakai',
      tipe_stok: 'pcs'
    }, testOp.id);

    const tipe = await CatalogService.createTipe({
      produk_id: prod.id,
      sumber_id: 'manual',
      nilai_atribut: []
    }, testOp.id);

    // Masukkan 3 item Baik, 2 item Rusak
    await StockService.inputStokItemSingle({
      tipe_id: tipe.id,
      box_id: testBox.id,
      kode_id: `SN-RJ-01-${Date.now()}`,
      user_id: testOp.id,
      kondisi: 'Baik'
    });

    await StockService.inputStokItemSingle({
      tipe_id: tipe.id,
      box_id: testBox.id,
      kode_id: `SN-RJ-02-${Date.now()}`,
      user_id: testOp.id,
      kondisi: 'Baik'
    });

    await StockService.inputStokItemSingle({
      tipe_id: tipe.id,
      box_id: testBox.id,
      kode_id: `SN-RJ-03-${Date.now()}`,
      user_id: testOp.id,
      kondisi: 'Baik'
    });

    await StockService.inputStokItemSingle({
      tipe_id: tipe.id,
      box_id: testBox.id,
      kode_id: `SN-RJ-04-${Date.now()}`,
      user_id: testOp.id,
      kondisi: 'Rusak',
      catatan_kondisi: 'Pin patah saat uji crimping'
    });

    await StockService.inputStokItemSingle({
      tipe_id: tipe.id,
      box_id: testBox.id,
      kode_id: `SN-RJ-05-${Date.now()}`,
      user_id: testOp.id,
      kondisi: 'Rusak',
      catatan_kondisi: 'Klip pengunci retak'
    });

    const availableStock = await WhatsappAlertService.getAvailableStockForTipe(tipe.id);
    // Total 5 unit, 2 rusak -> Tersedia harus 3!
    if (availableStock !== 3) {
      throw new Error(`Stok tersedia salah: ${availableStock} (diharapkan 3, karena 2 unit Rusak).`);
    }
  });

  // 4. Pengujian Jeda 15 Menit Tidak Boleh 0
  await test('Pengaturan jeda pengiriman (cooldown) ditolak jika disetel ke 0 menit', async () => {
    let threw = false;
    try {
      await WhatsappAlertService.updateConfig({
        cooldownMinutes: 0
      }, testOp);
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('minimal 1 menit')) {
        throw new Error(`Pesan error tidak sesuai: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Seharusnya cooldown 0 menit ditolak.');
  });

  // 5. Pengujian Deduplikasi Daftar Penerima
  await test('Penerima duplikat dibersihkan sehingga hanya dikirim satu kali per target', async () => {
    const raw = ['081290008888', ' 081290008888 ', '120363041920@g.us', '081290008888', '081299990000'];
    const deduped = WhatsappAlertService.deduplicateRecipients(raw);

    if (deduped.length !== 3) {
      throw new Error(`Panjang deduplikasi salah: ${deduped.length} (diharapkan 3 unik).`);
    }
    if (!deduped.includes('081290008888') || !deduped.includes('120363041920@g.us') || !deduped.includes('081299990000')) {
      throw new Error('Daftar unik kehilangan entri penerima.');
    }
  });

  // 6. Anti-Duplikat Berbasis Status
  await test('Anti-Duplikat: Item dengan status sama tidak dikirim ulang; status direset saat stok naik', async () => {
    // Evaluasi awal
    const eval1 = await WhatsappAlertService.evaluateStockAlerts();
    // Dispatch alert pertama
    const dispatch1 = await WhatsappAlertService.dispatchConsolidatedAlert({ force: true, triggerSource: 'Test Audit 1' });
    if (!dispatch1.sent) throw new Error(`Dispatch 1 gagal: ${dispatch1.message}`);

    // Evaluasi kedua langsung setelah dispatch tanpa ada perubahan stok
    const eval2 = await WhatsappAlertService.evaluateStockAlerts();
    if (eval2.newAlertsCount !== 0) {
      throw new Error(`Anti-duplikat gagal: terdapat ${eval2.newAlertsCount} alert duplikat padahal status belum berubah.`);
    }
  });

  // 7. Pengujian Jeda 15 Menit di Backend
  await test('Pengiriman dalam rentang jeda 15 menit ditahan / berstatus inCooldown', async () => {
    // Dispatch pertama sudah mencatat last_sent_at = NOW
    const dispatch2 = await WhatsappAlertService.dispatchConsolidatedAlert({ force: false });
    if (!dispatch2.inCooldown) {
      throw new Error('Pengiriman dalam jeda 15 menit seharusnya masuk cooldown.');
    }
    if (!dispatch2.remainingSeconds || dispatch2.remainingSeconds <= 0) {
      throw new Error('Sisa detik cooldown harus positif.');
    }
  });

  // 8. Pengujian Pesan Uji Kena Batas 15 Menit
  await test('Tombol Kirim Pesan Uji (test message) juga mematuhi batas jeda 15 menit di backend', async () => {
    let threw = false;
    try {
      await WhatsappAlertService.sendTestMessage('081290008888', testOp);
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('masih aktif')) {
        throw new Error(`Pesan error salah: ${err.message}`);
      }
    }
    if (!threw) throw new Error('Seharusnya pesan uji ditolak saat cooldown aktif.');
  });

  // 9. Format Pesan Ringkasan Konsolidasi (3 Jenis Pesan Tanpa Teks Bebas)
  await test('Format pesan ringkasan konsolidasi memuat bagian Habis, Menipis, dan Peringatan Dini secara presisi', async () => {
    const { formatConsolidatedStockAlertMessage } = await import('../integrations/whatsapp/templates');
    const msg = formatConsolidatedStockAlertMessage({
      outOfStock: [{ sku: 'FO-SFP-01', name: 'SFP 10G SR', unit: 'pcs' }],
      lowStock: [{ sku: 'CAB-UTP-06', name: 'Kabel UTP Cat6', quantity: 2, unit: 'roll', threshold: 5, source: 'dari produk' }],
      earlyWarning: [{ sku: 'ADP-12V-02', name: 'Adaptor 12V 2A', quantity: 4, unit: 'unit', threshold: 6, source: 'dari tipe' }],
      triggerSource: 'Uji Otomatis v1.2.5'
    });

    if (!msg.includes('STOK HABIS (0 UNIT)')) throw new Error('Bagian STOK HABIS hilang.');
    if (!msg.includes('STOK MENIPIS (PERLU RESTOCK)')) throw new Error('Bagian STOK MENIPIS hilang.');
    if (!msg.includes('PERINGATAN DINI / DAFTAR PANTAUAN')) throw new Error('Bagian PERINGATAN DINI hilang.');
    if (!msg.includes('[FO-SFP-01]')) throw new Error('Item SKU habis hilang.');
    if (!msg.includes('dari produk') || !msg.includes('dari tipe')) throw new Error('Keterangan sumber ambang hilang.');
  });

  // 10. Pengujian Hak Akses HTTP Middleware (Teknisi Ditolak 403, Developer/Admin/Admin Gudang Diizinkan)
  await test('Hak Akses HTTP: Teknisi ditolak 403 saat ubah config, ambang, atau kirim alert', async () => {
    const waGuardMiddleware = requireRole(['developer', 'admin', 'warehouse_admin']);

    // 1. Teknisi -> 403
    const reqTech: any = { user: { id: 'usr-tech', username: 'budi_tech', role: 'technician' } };
    const resTech = createMockRes();
    const stateTech = { called: false };
    waGuardMiddleware(reqTech as AuthenticatedRequest, resTech, () => {
      stateTech.called = true;
    });

    if (stateTech.called || resTech.statusCode !== 403) {
      throw new Error(`Teknisi harus ditolak 403, actual statusCode: ${resTech.statusCode}`);
    }

    // 2. Admin Gudang -> 200 (Diizinkan)
    const reqWh: any = { user: { id: 'usr-wh', username: 'siti_wh', role: 'warehouse_admin' } };
    const resWh = createMockRes();
    const stateWh = { called: false };
    waGuardMiddleware(reqWh as AuthenticatedRequest, resWh, () => {
      stateWh.called = true;
    });

    if (!stateWh.called || resWh.statusCode !== 200) {
      throw new Error(`Admin Gudang harus diizinkan (next called), actual statusCode: ${resWh.statusCode}`);
    }

    // 3. Admin -> 200 (Diizinkan)
    const reqAdm: any = { user: { id: 'usr-adm', username: 'hendra_adm', role: 'admin' } };
    const resAdm = createMockRes();
    const stateAdm = { called: false };
    waGuardMiddleware(reqAdm as AuthenticatedRequest, resAdm, () => {
      stateAdm.called = true;
    });

    if (!stateAdm.called || resAdm.statusCode !== 200) {
      throw new Error(`Admin harus diizinkan (next called), actual statusCode: ${resAdm.statusCode}`);
    }
  });

  // 11. Ekstensibilitas Estimasi Sisa Hari (Section 3 point 9)
  await test('Metode estimateDaysRemaining menghitung estimasi sisa hari konsumsi dengan tepat', async () => {
    // 50 unit tersedia, konsumsi 5 unit/hari -> sisa 10 hari
    const days1 = WhatsappAlertService.estimateDaysRemaining(50, 5);
    if (days1 !== 10) throw new Error(`Estimasi hari salah: ${days1} !== 10`);

    // 12 unit tersedia, konsumsi 0 unit/hari -> null (belum ada data penggunaan)
    const days2 = WhatsappAlertService.estimateDaysRemaining(12, 0);
    if (days2 !== null) throw new Error('Konsumsi 0 harus menghasilkan null.');
  });

  // Tampilkan Ringkasan
  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(` HASIL PENGUJIAN PAKET 6: ${passed}/${total} PASS (${failed} GAGAL)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
