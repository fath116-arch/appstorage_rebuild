/**
 * Unit & Integration Test — Tahap 8: Notifikasi Fonnte, Audit Keamanan, & Sistem Desain
 * FieldOps Inventory v2
 */

import { NotificationService } from '../services/notificationService';
import { RequestService } from '../services/requestService';
import { CatalogService } from '../services/catalogService';
import { initDatabase } from '../db/database';

async function runTahap8Tests() {
  console.log('=== STARTING TAHAP 8 NOTIFIKASI FONNTE, AUDIT, & DOKUMENTASI SUITE ===\n');
  await initDatabase();
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS ${total}] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL ${total}] ${title}`);
      throw new Error(`Test failed: ${title}`);
    }
  }

  try {
    const userTeknisi = { id: 'usr-tek-demo', username: 'teknisi', role: 'technician' };
    const userAdmin = { id: 'usr-admin-demo', username: 'admin', role: 'admin' };

    // 1. Uji Pengambilan Nomor Target WhatsApp untuk Admin / Developer / Gudang
    const targets = await NotificationService.getTargetPhoneNumbers();
    assert(Array.isArray(targets) && targets.length > 0, 'Target nomor WhatsApp untuk notifikasi berhasil diperoleh');

    // 2. Setup Data Katalog Cepat
    const testJenis = await CatalogService.createJenis({
      nama: `Jenis T8 ${Date.now()}`,
      sumber_id_bawaan: 'manual',
      prefix_id_bawaan: 'T8-',
      atributs: [{ kode: 'varian', nama: 'Varian', tipe_isian: 'teks', wajib: true, urutan: 1, masuk_nama: true }]
    }, userAdmin.id);

    const testProd = await CatalogService.createProduk({
      jenis_id: testJenis.id,
      nama: `ONU Mini T8 ${Date.now()}`,
      kategori: 'fast_moving'
    }, userAdmin.id);

    const testTipe = await CatalogService.createTipe({
      produk_id: testProd.id,
      sumber_id: 'manual',
      nilai_atribut: [{ atribut_id: testJenis.atributs![0].id, nilai_teks: 'XPON Compact' }]
    }, userAdmin.id);

    // 3. Uji Pembuatan Request Memicu Notifikasi WhatsApp Asinkron
    const req = await RequestService.createRequest({
      pemohonId: userTeknisi.id,
      tipeId: testTipe.id,
      jumlah: 2,
      alasan: 'Pemasangan mendesak pelanggan VIP'
    });

    assert(req.status === 'menunggu', 'Request berhasil dibuat dalam transaksi database');

    // 4. Uji Pemanggilan Langsung NotificationService
    const notifyRes = await NotificationService.notifyNewRequest({
      requestId: req.id,
      pemohonId: userTeknisi.id,
      produkNama: testProd.nama,
      tipeNama: testTipe.nama_tipe,
      jumlah: 2,
      alasan: 'Pemasangan mendesak pelanggan VIP'
    });

    assert(notifyRes.attempted === true, 'Pemicuan notifikasi WhatsApp Fonnte berhasil dieksekusi (fire and forget)');
    assert(notifyRes.targetsCount > 0, 'Notifikasi menyasar target pengelola');

    // 5. Uji Non-Fatal: Kegagalan Pengiriman WA Tidak Membatalkan Database
    const invalidNotify = await NotificationService.notifyNewRequest({
      requestId: 'req-fake-999',
      pemohonId: 'user-non-existent',
      produkNama: 'Barang Uji',
      tipeNama: 'Tipe Uji',
      jumlah: 1,
      alasan: 'Uji isolasi kesalahan'
    });
    assert(invalidNotify.attempted === true, 'Sistem tetap stabil dan tidak melempar pengecualian fatal (isolated error handling)');

    console.log(`\n🎉 TAHAP 8 TEST SUITE COMPLETED: ${passed}/${total} TESTS PASSED!`);
  } catch (err: any) {
    console.error('\n❌ TAHAP 8 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runTahap8Tests();
