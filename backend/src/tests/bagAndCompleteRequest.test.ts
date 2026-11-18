/**
 * Test Suite: Multi-Tas Kerja Lapangan + Request Paket Tas + Status Selesai (Terpakai Pelanggan)
 */

import { initDatabase, executeQuery } from '../db/database';
import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { BagService } from '../services/bagService';
import { RequestService } from '../services/requestService';

async function runTests() {
  console.log('================================================================');
  console.log('  PENGUJIAN MULTI-TAS KERJA & SELESAI TERPAKAI PELANGGAN');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  await initDatabase();

  const adminUser = { id: 'usr-admin-demo', name: 'Admin Demo', role: 'admin' };
  const warehouseUser = { id: 'usr-wh-demo', name: 'Warehouse Demo', role: 'warehouse_admin' };
  const techUser = { id: 'usr-tek-demo', name: 'Teknisi Lapangan', role: 'technician' };
  const otherTechUser = { id: 'usr-tek-2', name: 'Teknisi Dua', role: 'technician' };
  const suffix = Date.now().toString().slice(-6);

  try {
    // ------------------------------------------------------------------
    // 1. Setup Kategori, Produk Alat & Barang Habis Pakai, Box, dan Stok
    // ------------------------------------------------------------------
    const jenisTest = await CatalogService.createJenis({
      nama: `Uji Tas & Modem ${suffix}`,
      sumber_id_bawaan: 'tanpa_id',
      atributs: [
        {
          kode: 'varian',
          nama: 'Varian',
          tipe_isian: 'pilihan',
          wajib: true,
          urutan: 1,
          masuk_nama: true,
          opsi: ['Standar', 'Pro']
        }
      ]
    }, adminUser.id);

    const attrVarian = jenisTest.atributs![0];
    const opsiStandar = attrVarian.opsi![0];
    const opsiPro = attrVarian.opsi![1];

    const prodAlat = await CatalogService.createProduk({
      jenis_id: jenisTest.id,
      nama: `Cleaver Optik ${suffix}`,
      kategori: 'recycle',
      kategori_barang: 'Alat'
    }, adminUser.id);

    const tipeAlat = await CatalogService.createTipe({
      produk_id: prodAlat.id,
      sumber_id: 'tanpa_id',
      nilai_atribut: [{ atribut_id: attrVarian.id, opsi_id: opsiStandar.id }]
    }, adminUser.id);

    const prodAlat2 = await CatalogService.createProduk({
      jenis_id: jenisTest.id,
      nama: `OTDR Mini ${suffix}`,
      kategori: 'recycle',
      kategori_barang: 'Alat'
    }, adminUser.id);

    const tipeAlat2 = await CatalogService.createTipe({
      produk_id: prodAlat2.id,
      sumber_id: 'tanpa_id',
      nilai_atribut: [{ atribut_id: attrVarian.id, opsi_id: opsiPro.id }]
    }, adminUser.id);

    const prodModem = await CatalogService.createProduk({
      jenis_id: jenisTest.id,
      nama: `Modem ONT Dualband ${suffix}`,
      kategori: 'fast_moving',
      kategori_barang: 'Barang Habis Pakai'
    }, adminUser.id);

    const tipeModem = await CatalogService.createTipe({
      produk_id: prodModem.id,
      sumber_id: 'manual',
      nilai_atribut: [{ atribut_id: attrVarian.id, opsi_id: opsiStandar.id }]
    }, adminUser.id);

    const box = await StockService.createBox(`BXT-${suffix}`, 'Rak Tas Uji', adminUser.id);

    // Input stok: 2 Cleaver, 1 OTDR, 2 Modem SN
    await StockService.inputStokJumlah({ tipe_id: tipeAlat.id, box_id: box.id, jumlah: 2, user_id: adminUser.id });
    await StockService.inputStokJumlah({ tipe_id: tipeAlat2.id, box_id: box.id, jumlah: 1, user_id: adminUser.id });

    const modemSn1 = `ONT-A-${suffix}`;
    const modemSn2 = `ONT-B-${suffix}`;
    await StockService.inputStokItemSingle({ tipe_id: tipeModem.id, box_id: box.id, kode_id: modemSn1, user_id: adminUser.id });
    await StockService.inputStokItemSingle({ tipe_id: tipeModem.id, box_id: box.id, kode_id: modemSn2, user_id: adminUser.id });

    // ------------------------------------------------------------------
    // 2. Uji Multi-Tas Lapangan CRUD (BagService)
    // ------------------------------------------------------------------
    const bag1 = await BagService.createBag({
      namaTas: `Tas Aktivasi 1 ${suffix}`,
      keterangan: 'Set peralatan aktivasi pelanggan baru',
      items: [
        { tipe_id: tipeAlat.id, jumlah: 1 },
        { tipe_id: tipeAlat2.id, jumlah: 1 }
      ],
      userId: warehouseUser.id,
      userName: warehouseUser.name
    });

    const bag2 = await BagService.createBag({
      namaTas: `Tas Maintenance 2 ${suffix}`,
      keterangan: 'Cadangan kantor',
      items: [{ tipe_id: tipeAlat.id, jumlah: 1 }],
      userId: warehouseUser.id,
      userName: warehouseUser.name
    });

    assert(bag1.items.length === 2 && bag1.total_unit === 2, 'BagService.createBag membuat tas pertama dengan 2 alat');
    assert(bag2.nama_tas === `Tas Maintenance 2 ${suffix}`, 'BagService.createBag mendukung pembuatan lebih dari satu tas kantor');

    // Tolak duplikasi nama tas
    let dupBagBlocked = false;
    try {
      await BagService.createBag({
        namaTas: bag1.nama_tas,
        items: [{ tipe_id: tipeAlat.id, jumlah: 1 }],
        userId: warehouseUser.id,
        userName: warehouseUser.name
      });
    } catch {
      dupBagBlocked = true;
    }
    assert(dupBagBlocked, 'BagService.createBag menolak nama tas yang duplikat');

    // Pastikan listBags memperkaya stok live dan GET checklist biasa tidak tercampur BAG_TEMPLATE
    const allBags = await BagService.listBags();
    const loadedBag1 = allBags.find((b) => b.id === bag1.id);
    assert(
      Boolean(loadedBag1 && loadedBag1.items[0].stok_tersedia === 2 && loadedBag1.items[1].stok_tersedia === 1),
      'BagService.listBags memperkaya stok tersedia secara real-time dari Katalog'
    );

    const regularChecklists = await executeQuery<{ id: string }>(
      `SELECT id FROM checklists WHERE inspection_type != 'BAG_TEMPLATE'`
    );
    assert(
      !regularChecklists.some((c) => c.id === bag1.id || c.id === bag2.id),
      'Riwayat checklist inspeksi biasa terisolasi dari template tas (BAG_TEMPLATE)'
    );

    // Update Tas 2 lalu hapus Tas 2
    const updatedBag2 = await BagService.updateBag(bag2.id, {
      namaTas: `Tas Splicing Cadangan ${suffix}`,
      keterangan: 'Berisi 3 cleaver (lebih dari stok untuk uji validasi)',
      items: [
        { tipe_id: tipeAlat.id, jumlah: 3 },
        { tipe_id: tipeAlat2.id, jumlah: 1 }
      ],
      userId: warehouseUser.id,
      userName: warehouseUser.name
    });
    assert(updatedBag2.total_unit === 4, 'BagService.updateBag berhasil mengubah nama & daftar alat tas');

    // Uji Request Paket Tas dengan stok kurang -> ditolak tanpa membuat request parsial
    const beforeCount = (await RequestService.listRequests()).length;
    let bagShortageBlocked = false;
    try {
      await RequestService.createBagRequest({
        bagId: updatedBag2.id,
        pemohonId: techUser.id,
        alasan: 'Tiket #INC-999 uji stok kurang'
      });
    } catch {
      bagShortageBlocked = true;
    }
    const afterCount = (await RequestService.listRequests()).length;
    assert(bagShortageBlocked && afterCount === beforeCount, 'createBagRequest menolak paket tas bila ada alat stok kurang & tidak membuat request parsial');

    const delBag2 = await BagService.deleteBag(bag2.id, warehouseUser.id, warehouseUser.name);
    assert(delBag2.success === true, 'BagService.deleteBag berhasil menghapus tas kerja');

    // ------------------------------------------------------------------
    // 3. Uji Request Paket Tas dengan Stok Cukup -> Approve -> Pickup
    // ------------------------------------------------------------------
    const bagReqResult = await RequestService.createBagRequest({
      bagId: bag1.id,
      pemohonId: techUser.id,
      alasan: `Tiket #INC-${suffix}`
    });
    assert(
      bagReqResult.requests.length === 2 &&
      bagReqResult.requests.every((r) => r.bag_name === bag1.nama_tas && r.status === 'diajukan'),
      'RequestService.createBagRequest membuat permohonan seluruh alat dalam tas dengan tag [Tas: ...] & bag_name'
    );

    // Approve & pickup item pertama (Alat)
    const reqToolId = bagReqResult.requests[0].id;
    await RequestService.approveRequest({ requestId: reqToolId, penyetujuId: warehouseUser.id });
    await RequestService.pickupRequest({ requestId: reqToolId, recordedById: warehouseUser.id, recordedByRole: warehouseUser.role });

    // Tolak completeRequest untuk kategori Alat (Alat wajib kembali!)
    let alatCompleteBlocked = false;
    try {
      await RequestService.completeRequest({
        requestId: reqToolId,
        userId: techUser.id,
        userName: techUser.name,
        userRole: techUser.role,
        customerName: 'Pelanggan Uji',
        usageNotes: 'Mencoba menandai selesai alat'
      });
    } catch {
      alatCompleteBlocked = true;
    }
    assert(alatCompleteBlocked, 'completeRequest menolak kategori Alat karena Alat wajib dikembalikan');

    // ------------------------------------------------------------------
    // 4. Uji Siklus Lengkap Status SELESAI untuk Barang Habis Pakai
    // ------------------------------------------------------------------
    const reqModemTech = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'ambil',
      tipeId: tipeModem.id,
      kodeId: modemSn1,
      alasan: `Pasang baru pelanggan #CID-101`
    });
    await RequestService.approveRequest({ requestId: reqModemTech.id, penyetujuId: warehouseUser.id });
    await RequestService.pickupRequest({ requestId: reqModemTech.id, recordedById: warehouseUser.id, recordedByRole: warehouseUser.role });

    const reqModemWh = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'ambil',
      tipeId: tipeModem.id,
      kodeId: modemSn2,
      alasan: `Pasang baru pelanggan #CID-102`
    });
    await RequestService.approveRequest({ requestId: reqModemWh.id, penyetujuId: warehouseUser.id });
    await RequestService.pickupRequest({ requestId: reqModemWh.id, recordedById: warehouseUser.id, recordedByRole: warehouseUser.role });

    // Tolak teknisi lain yang bukan pemilik
    let otherTechBlocked = false;
    try {
      await RequestService.completeRequest({
        requestId: reqModemTech.id,
        userId: otherTechUser.id,
        userName: otherTechUser.name,
        userRole: otherTechUser.role,
        customerName: 'CID-101',
        usageNotes: 'Percobaan pihak lain'
      });
    } catch {
      otherTechBlocked = true;
    }
    assert(otherTechBlocked, 'completeRequest menolak teknisi lain yang bukan pemohon/pemegang barang');

    // Tolak jika customer / notes kosong
    let missingFieldsBlocked = false;
    try {
      await RequestService.completeRequest({
        requestId: reqModemTech.id,
        userId: techUser.id,
        userName: techUser.name,
        userRole: techUser.role,
        customerName: ' ',
        usageNotes: 'ok'
      });
    } catch {
      missingFieldsBlocked = true;
    }
    assert(missingFieldsBlocked, 'completeRequest mewajibkan Nama/ID Pelanggan & Catatan Pemasangan');

    // Ajukan pengembalian untuk modem 2 sementara -> harus memblokir completeRequest
    const pendingRetModem2 = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'kembalikan',
      originRequestId: reqModemWh.id,
      returnCondition: 'Baru',
      returnBoxId: box.id,
      returnNotes: 'Batal pasang sementara'
    });
    let conflictReturnBlocked = false;
    try {
      await RequestService.completeRequest({
        requestId: reqModemWh.id,
        userId: warehouseUser.id,
        userName: warehouseUser.name,
        userRole: warehouseUser.role,
        customerName: 'CID-102',
        usageNotes: 'Konflik dengan return aktif'
      });
    } catch {
      conflictReturnBlocked = true;
    }
    assert(conflictReturnBlocked, 'completeRequest ditolak jika barang sedang memiliki pengajuan pengembalian terbuka');

    // Batalkan pengajuan kembalikan tadi agar modem 2 bersih kembali ke status diambil
    await RequestService.cancelRequest({ requestId: pendingRetModem2.id, userId: techUser.id, userRole: techUser.role });

    // 4a. Teknisi pemilik langsung menandai Selesai Modem 1
    const stockBeforeComplete = await StockService.getStock(tipeModem.id);
    const completeByTech = await RequestService.completeRequest({
      requestId: reqModemTech.id,
      userId: techUser.id,
      userName: techUser.name,
      userRole: techUser.role,
      customerName: 'Bapak Budi / CID-101',
      usageNotes: 'Terpasang di ruang tamu, redaman -18.5 dBm normal'
    });
    assert(completeByTech.success === true, 'Teknisi pemilik dapat langsung menandai Barang Habis Pakai sebagai SELESAI');

    // 4b. Pengelola gudang menandai Selesai Modem 2
    const completeByWh = await RequestService.completeRequest({
      requestId: reqModemWh.id,
      userId: warehouseUser.id,
      userName: warehouseUser.name,
      userRole: warehouseUser.role,
      customerName: 'Ibu Sari / CID-102',
      usageNotes: 'Aktivasi FTTH Cluster Melati Blok B4'
    });
    assert(completeByWh.success === true, 'Pengelola gudang juga dapat menandai Barang Habis Pakai sebagai SELESAI');

    const reqModem1After = await RequestService.getRequestById(reqModemTech.id);
    const heldAfter = await RequestService.listHeldByTechnicians({ actorId: techUser.id });
    const stockAfterComplete = await StockService.getStock(tipeModem.id);
    const item1After = await StockService.checkDuplicateKodeId(modemSn1);
    const timeline1 = await RequestService.getRequestTimeline(reqModemTech.id);
    const completeLog = timeline1.find((t) => t.aksi === 'selesai_request');

    assert(
      reqModem1After?.status === 'selesai' &&
      reqModem1After?.return_condition === 'Terpakai' &&
      Boolean(reqModem1After?.return_notes?.includes('Bapak Budi / CID-101')),
      'Status request berubah menjadi SELESAI dengan metadata Pelanggan & Pemasangan'
    );
    assert(
      !heldAfter.some((h) => h.id === reqModemTech.id || h.id === reqModemWh.id),
      'Barang yang sudah Selesai otomatis keluar dari daftar Barang di Tangan Teknisi'
    );
    assert(
      stockAfterComplete === stockBeforeComplete && item1After.item?.status === 'keluar',
      'Menandai Selesai tidak memotong stok ganda maupun mengembalikan item keluar ke aktif'
    );
    assert(
      Boolean(completeLog && completeLog.recipient_destination === 'Bapak Budi / CID-101'),
      'ActivityLog mencatat aksi selesai_request beserta tujuan pelanggan pada timeline request'
    );

    // Tolak double-complete
    let doubleCompleteBlocked = false;
    try {
      await RequestService.completeRequest({
        requestId: reqModemTech.id,
        userId: warehouseUser.id,
        userName: warehouseUser.name,
        userRole: warehouseUser.role,
        customerName: 'Bapak Budi',
        usageNotes: 'Ulangi selesai'
      });
    } catch {
      doubleCompleteBlocked = true;
    }
    assert(doubleCompleteBlocked, 'completeRequest menolak penyelesaian ganda pada request yang sudah SELESAI');
  } catch (err) {
    console.error('❌ Exception during test:', err);
    failed++;
  }

  console.log('================================================================');
  console.log(`  HASIL TEST MULTI-TAS & SELESAI: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
