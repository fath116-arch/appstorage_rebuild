/**
 * Unit & Integration Test — Tahap 5: Barang Keluar, Arsip, & Restore
 * FieldOps Inventory v2
 */

import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { ConfirmationService } from '../services/confirmationService';
import { initDatabase } from '../db/database';

async function runTahap5Tests() {
  console.log('=== STARTING TAHAP 5 BARANG KELUAR, ARSIP, & RESTORE SUITE ===\n');
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
    const user = { id: 'usr-admin-demo', username: 'admin', role: 'admin' };

    // 1. Setup Jenis & Produk & Tipe
    const testJenis = await CatalogService.createJenis({
      nama: `Jenis T5 ${Date.now()}`,
      sumber_id_bawaan: 'manual',
      prefix_id_bawaan: 'T5-',
      atributs: [
        { kode: 'merek', nama: 'Merek', tipe_isian: 'teks', wajib: true, urutan: 1, masuk_nama: true }
      ]
    }, user.id);

    const testProd = await CatalogService.createProduk({
      jenis_id: testJenis.id,
      nama: `Switch T5 ${Date.now()}`,
      kategori: 'fast_moving'
    }, user.id);

    const testTipe = await CatalogService.createTipe({
      produk_id: testProd.id,
      sumber_id: 'manual',
      nilai_atribut: [
        { atribut_id: testJenis.atributs![0].id, nilai_teks: 'Cisco' }
      ]
    }, user.id);

    const testTipeJumlah = await CatalogService.createTipe({
      produk_id: testProd.id,
      sumber_id: 'tanpa_id',
      nilai_atribut: [
        { atribut_id: testJenis.atributs![0].id, nilai_teks: 'Generic' }
      ]
    }, user.id);

    // 2. Setup Box
    const boxA = await StockService.createBox(`BOX-T5-A-${Date.now().toString().slice(-4)}`, 'Box T5 A', user.id);
    const boxB = await StockService.createBox(`BOX-T5-B-${Date.now().toString().slice(-4)}`, 'Box T5 B', user.id);

    // 3. Input Stok Items
    const kodeId1 = `SN-T5-1001-${Date.now()}`;
    const kodeId2 = `SN-T5-1002-${Date.now()}`;

    await StockService.inputStokItemSingle({
      tipe_id: testTipe.id,
      box_id: boxA.id,
      kode_id: kodeId1,
      user_id: user.id
    });

    await StockService.inputStokItemSingle({
      tipe_id: testTipe.id,
      box_id: boxA.id,
      kode_id: kodeId2,
      user_id: user.id
    });

    await StockService.inputStokJumlah({
      tipe_id: testTipeJumlah.id,
      box_id: boxA.id,
      jumlah: 20,
      user_id: user.id
    });

    assert(true, 'Setup data sampel awal berhasil');

    // 4. Uji Barang Keluar Single (Item Ber-ID)
    const resOutSingle = await StockService.barangKeluarSingle({
      kodeId: kodeId1,
      userId: user.id,
      catatan: 'Dikeluarkan untuk perbaikan'
    });
    assert(resOutSingle.success, 'Barang keluar tunggal item ber-ID berhasil');

    // Cek item berstatus keluar
    const checkDup1 = await StockService.checkDuplicateKodeId(kodeId1);
    assert(checkDup1.exists && checkDup1.item?.status === 'keluar', 'Status item berubah menjadi KELUAR');

    // 5. Uji Barang Keluar Single (Stok Jumlah)
    const resOutJumlah = await StockService.barangKeluarSingle({
      tipeId: testTipeJumlah.id,
      boxId: boxA.id,
      jumlah: 5,
      userId: user.id,
      catatan: 'Pengurangan 5 unit stok jumlah'
    });
    assert(resOutJumlah.success, 'Barang keluar stok jumlah berhasil');

    const contentsA = await StockService.getBoxContents(boxA.id);
    assert(contentsA.total_stok_jumlah === 15, 'Sisa stok jumlah di Box A bernilai 15 (20 - 5)');

    // 6. Uji List Arsip & Filter Search
    const listArsipAll = await StockService.listArsip();
    assert(listArsipAll.some((i: any) => i.kode_id === kodeId1), 'Item yang dikeluarkan terdapat di Arsip');

    const listArsipFiltered = await StockService.listArsip({ search: kodeId1 });
    assert(listArsipFiltered.length >= 1 && listArsipFiltered[0].kode_id === kodeId1, 'Pencarian Arsip berdasarkan kode_id berhasil');

    // 7. Uji Restore - Pencegahan Duplikasi Item Aktif
    const resRestoreActive: any = await StockService.restoreItemFromArchive({
      kodeId: kodeId2, // Masih AKTIF
      targetBoxId: boxB.id,
      userId: user.id,
      confirmProductMatched: true
    });
    assert(resRestoreActive.isAlreadyActive === true, 'Sistem mencegah restore jika ID masih AKTIF di stok');

    // 8. Uji Restore - ID Tidak Ditemukan di Arsip
    const resRestoreUnknown: any = await StockService.restoreItemFromArchive({
      kodeId: 'NON-EXISTENT-SN-9999',
      targetBoxId: boxB.id,
      userId: user.id,
      confirmProductMatched: true
    });
    assert(resRestoreUnknown.isNotInArchive === true, 'Sistem mendeteksi jika ID tidak ada di Arsip/stok');

    // 9. Uji Restore - Wajib Konfirmasi Produk Sama
    const resRestoreUnconfirmed: any = await StockService.restoreItemFromArchive({
      kodeId: kodeId1,
      targetBoxId: boxB.id,
      userId: user.id,
      confirmProductMatched: false
    });
    assert(resRestoreUnconfirmed.requiresMatchConfirmation === true, 'Sistem meminta konfirmasi kesesuaian produk sebelum restore');

    // 10. Uji Restore Berhasil dari Arsip ke Box B
    const resRestoreSuccess = await StockService.restoreItemFromArchive({
      kodeId: kodeId1,
      targetBoxId: boxB.id,
      userId: user.id,
      confirmProductMatched: true,
      catatan: 'Pengembalian barang dari Arsip ke Box B'
    });
    assert(resRestoreSuccess.success === true, 'Restore item dari Arsip ke Box B berhasil');

    const checkDupRestored = await StockService.checkDuplicateKodeId(kodeId1);
    assert(checkDupRestored.item?.status === 'aktif' && checkDupRestored.item?.box_id === boxB.id, 'Status item kembali AKTIF dan dipindahkan ke Box B');

    // 11. Uji Barang Keluar Massal (Tier 2 Confirmation Token `approve`)
    const tokenRes = await ConfirmationService.requestConfirmationToken({
      userId: user.id,
      actionType: 'bulk_stock_out',
      targetId: 'bulk',
      objectNameTyped: 'approve'
    });
    assert(tokenRes.success && !!tokenRes.token, 'Token konfirmasi Tier 2 "approve" diterbitkan');

    const resBulkOut = await StockService.barangKeluarBulk({
      items: [
        { kodeId: kodeId1 },
        { kodeId: kodeId2 }
      ],
      userId: user.id,
      confirmationToken: tokenRes.token,
      catatan: 'Barang keluar massal project X'
    });

    assert(resBulkOut.success && resBulkOut.totalCount === 2, 'Barang keluar massal (Tier 2 approve) berhasil mengekspor 2 unit');

    const checkBulk1 = await StockService.checkDuplicateKodeId(kodeId1);
    const checkBulk2 = await StockService.checkDuplicateKodeId(kodeId2);
    assert(checkBulk1.item?.status === 'keluar' && checkBulk2.item?.status === 'keluar', 'Kedua item massal kini berstatus KELUAR');

    console.log(`\n🎉 TAHAP 5 TEST SUITE COMPLETED: ${passed}/${total} TESTS PASSED!`);
  } catch (err: any) {
    console.error('\n❌ TAHAP 5 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runTahap5Tests();
