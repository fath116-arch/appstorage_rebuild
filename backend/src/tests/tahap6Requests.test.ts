/**
 * Unit & Integration Test — Tahap 6: Alur Request Teknisi & Persetujuan Cepat
 * FieldOps Inventory v2
 */

import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { RequestService } from '../services/requestService';
import { ConfirmationService } from '../services/confirmationService';
import { initDatabase } from '../db/database';

async function runTahap6Tests() {
  console.log('=== STARTING TAHAP 6 REQUEST & QUICK APPROVAL SUITE ===\n');
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
    const userWarehouse = { id: 'usr-wh-demo', username: 'admin_gudang', role: 'warehouse_admin' };

    // 1. Setup Jenis, Produk, Tipe, Box & Stock
    const testJenis = await CatalogService.createJenis({
      nama: `Jenis T6 ${Date.now()}`,
      sumber_id_bawaan: 'manual',
      prefix_id_bawaan: 'T6-',
      atributs: [
        { kode: 'tipe_kabel', nama: 'Tipe Kabel', tipe_isian: 'teks', wajib: true, urutan: 1, masuk_nama: true }
      ]
    }, userAdmin.id);

    const testProd = await CatalogService.createProduk({
      jenis_id: testJenis.id,
      nama: `Kabel Optik T6 ${Date.now()}`,
      kategori: 'fast_moving'
    }, userAdmin.id);

    const testTipeSN = await CatalogService.createTipe({
      produk_id: testProd.id,
      sumber_id: 'manual',
      nilai_atribut: [
        { atribut_id: testJenis.atributs![0].id, nilai_teks: 'Patchcord Single Core' }
      ]
    }, userAdmin.id);

    const testTipeQty = await CatalogService.createTipe({
      produk_id: testProd.id,
      sumber_id: 'tanpa_id',
      nilai_atribut: [
        { atribut_id: testJenis.atributs![0].id, nilai_teks: 'Dropcore 100m' }
      ]
    }, userAdmin.id);

    const boxA = await StockService.createBox(`BOX-T6-A-${Date.now().toString().slice(-4)}`, 'Box T6 A', userAdmin.id);

    const kodeSN1 = `SN-T6-9001-${Date.now()}`;
    await StockService.inputStokItemSingle({
      tipe_id: testTipeSN.id,
      box_id: boxA.id,
      kode_id: kodeSN1,
      user_id: userAdmin.id
    });

    await StockService.inputStokJumlah({
      tipe_id: testTipeQty.id,
      box_id: boxA.id,
      jumlah: 30,
      user_id: userAdmin.id
    });

    assert(true, 'Setup data katalog, stok, dan box awal berhasil');

    // 2. Permohonan Baru oleh Teknisi (Status MENUNGGU)
    const reqSN = await RequestService.createRequest({
      pemohonId: userTeknisi.id,
      tipeId: testTipeSN.id,
      kodeId: kodeSN1,
      alasan: 'Perbaikan koneksi pelanggan Gedung C'
    });

    assert(reqSN.status === 'menunggu', 'Permohonan item ber-ID berhasil dibuat dengan status MENUNGGU');
    assert(reqSN.pemohon_id === userTeknisi.id, 'Pemohon sesuai ID teknisi');

    const reqQty = await RequestService.createRequest({
      pemohonId: userTeknisi.id,
      tipeId: testTipeQty.id,
      boxId: boxA.id,
      jumlah: 10,
      alasan: 'Kebutuhan tarikan kabel pelanggan baru'
    });

    assert(reqQty.status === 'menunggu' && reqQty.jumlah === 10, 'Permohonan stok jumlah 10 unit berhasil dibuat');

    // 3. Uji List Request & Filter Status
    const listPending = await RequestService.listRequests({ status: 'menunggu' });
    assert(listPending.some(r => r.id === reqSN.id), 'Request SN ditemukan di daftar status MENUNGGU');

    // 4. Uji Persetujuan Cepat Atomik oleh Admin Gudang (1 Approval Cukup) + Auto Deduct Stok
    const tokenRes = await ConfirmationService.requestConfirmationToken({
      userId: userWarehouse.id,
      actionType: 'request_approve',
      targetId: reqSN.id,
      objectNameTyped: 'approve'
    });

    const approveRes = await RequestService.approveRequest({
      requestId: reqSN.id,
      penyetujuId: userWarehouse.id,
      confirmationToken: tokenRes.token
    });

    assert(approveRes.success === true, 'Persetujuan request SN oleh Admin Gudang berhasil');

    const reqSNAfter = await RequestService.getRequestById(reqSN.id);
    assert(reqSNAfter?.status === 'disetujui' && reqSNAfter.penyetuju_id === userWarehouse.id, 'Status request berubah menjadi DISETUJU');

    // Cek bahwa stok item SN otomatis dikeluarkan ke Arsip
    const checkDupSN = await StockService.checkDuplicateKodeId(kodeSN1);
    assert(checkDupSN.item?.status === 'keluar', 'Item fisik ber-ID otomatis KELUAR dari stok setelah request disetujui');

    // 5. Uji Pencegahan Double Approval (Race Condition Protection)
    let doubleApproveError = false;
    try {
      await RequestService.approveRequest({
        requestId: reqSN.id,
        penyetujuId: userAdmin.id
      });
    } catch (e: any) {
      doubleApproveError = true;
    }
    assert(doubleApproveError, 'Sistem mencegah double approval jika request sudah diproses');

    // 6. Uji Penolakan Request (Reject) oleh Admin
    const rejectRes = await RequestService.rejectRequest({
      requestId: reqQty.id,
      penyetujuId: userAdmin.id,
      catatanPenolakan: 'Stok dialokasikan untuk maintenance darurat'
    });

    assert(rejectRes.success === true, 'Penolakan request oleh Admin berhasil');

    const reqQtyAfter = await RequestService.getRequestById(reqQty.id);
    assert(reqQtyAfter?.status === 'ditolak' && reqQtyAfter.catatan_penolakan === 'Stok dialokasikan untuk maintenance darurat', 'Status request berubah menjadi DITOLAK dengan catatan penolakan');

    console.log(`\n🎉 TAHAP 6 TEST SUITE COMPLETED: ${passed}/${total} TESTS PASSED!`);
  } catch (err: any) {
    console.error('\n❌ TAHAP 6 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runTahap6Tests();
