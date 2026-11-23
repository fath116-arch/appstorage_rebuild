/**
 * Test Suite: Pengajuan Pembelian Barang ('beli'), Notif WA Selektif,
 *             Batas 4 Slot Penerima WA dengan Saklar ON/OFF,
 *             & Konfigurasi Dinamis Lembar Pengesahan Laporan
 */

import { initDatabase } from '../db/database';
import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { RequestService } from '../services/requestService';
import { NotificationService } from '../services/notificationService';
import { WhatsappAlertService, MAX_WA_RECIPIENT_SLOTS } from '../services/whatsappAlertService';
import { SettingService } from '../services/settingService';

async function runTests() {
  console.log('================================================================');
  console.log('  PENGUJIAN PEMBELIAN BARANG, WA 4 SLOT ON/OFF & PENGESAHAN');
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
  const techUser = { id: 'usr-tek-demo', name: 'Teknisi Lapangan', role: 'technician' };
  const suffix = Date.now().toString().slice(-6);

  // Spy / intercept NotificationService methods to verify selective WA behavior
  const origNotifyPurchase = NotificationService.notifyPurchaseRequest.bind(NotificationService);
  const origNotifyNewRequest = NotificationService.notifyNewRequest.bind(NotificationService);

  let purchaseNotifCalls: Array<{ requestId: string; itemName: string; estimatedPrice?: number | null }> = [];
  let newRequestNotifCalls: Array<{ requestId: string }> = [];

  NotificationService.notifyPurchaseRequest = async (input) => {
    purchaseNotifCalls.push({
      requestId: input.requestId,
      itemName: input.itemName,
      estimatedPrice: input.estimatedPrice,
    });
    return origNotifyPurchase(input);
  };

  NotificationService.notifyNewRequest = async (input) => {
    newRequestNotifCalls.push({ requestId: input.requestId });
    return origNotifyNewRequest(input);
  };

  try {
    // ------------------------------------------------------------------
    // 1. Batas Maksimal 4 Slot Penerima WA & Saklar ON/OFF Individual
    // ------------------------------------------------------------------
    console.log('\n--- 1. Batas 4 Slot Penerima WA & Saklar ON/OFF ---');

    let rejectedOver4 = false;
    try {
      await WhatsappAlertService.updateConfig(
        {
          recipientSlots: [
            { slot: 1, label: 'Slot 1', number: '08110001', enabled: true },
            { slot: 2, label: 'Slot 2', number: '08110002', enabled: true },
            { slot: 3, label: 'Slot 3', number: '08110003', enabled: true },
            { slot: 4, label: 'Slot 4', number: '08110004', enabled: true },
            { slot: 5, label: 'Slot 5', number: '08110005', enabled: true },
          ],
        },
        { id: adminUser.id, name: adminUser.name }
      );
    } catch (err: any) {
      rejectedOver4 = String(err?.message || '').includes(String(MAX_WA_RECIPIENT_SLOTS));
    }
    assert(rejectedOver4, 'Menolak konfigurasi > 4 slot nomor penerima WhatsApp');

    const updatedWa = await WhatsappAlertService.updateConfig(
      {
        isEnabled: true,
        recipientSlots: [
          { slot: 1, label: 'Purchasing', number: '0812000001', enabled: true },
          { slot: 2, label: 'Kepala Gudang', number: '0812000002', enabled: false },
          { slot: 3, label: 'Grup IT', number: '12036300003@g.us', enabled: true },
          { slot: 4, label: 'Cadangan', number: '0812000004', enabled: false },
        ],
      },
      { id: adminUser.id, name: adminUser.name }
    );

    assert(updatedWa.recipientSlots.length === 4, 'Konfigurasi menyimpan tepat 4 slot penerima');
    assert(
      updatedWa.recipients.length === 2 &&
        updatedWa.recipients.includes('0812000001') &&
        updatedWa.recipients.includes('12036300003@g.us'),
      'Hanya slot dengan saklar ON yang masuk ke recipients aktif (Slot 1 & Slot 3)'
    );

    const resolvedTargets = await NotificationService.getTargetPhoneNumbers();
    assert(
      resolvedTargets.length === 2 &&
        !resolvedTargets.includes('0812000002') &&
        !resolvedTargets.includes('0812000004'),
      'getTargetPhoneNumbers() mengecualikan nomor yang saklarnya OFF'
    );

    // Nonaktifkan seluruh 4 slot -> tidak ada penerima aktif (jangan fallback env jika slot terisi)
    await WhatsappAlertService.updateConfig(
      {
        recipientSlots: [
          { slot: 1, label: 'Purchasing', number: '0812000001', enabled: false },
          { slot: 2, label: 'Kepala Gudang', number: '0812000002', enabled: false },
          { slot: 3, label: 'Grup IT', number: '12036300003@g.us', enabled: false },
          { slot: 4, label: 'Cadangan', number: '0812000004', enabled: false },
        ],
      },
      { id: adminUser.id, name: adminUser.name }
    );
    const noActiveTargets = await NotificationService.getTargetPhoneNumbers();
    assert(noActiveTargets.length === 0, 'Jika ke-4 slot bersaklar OFF, getTargetPhoneNumbers() mengembalikan array kosong');

    // Aktifkan kembali 1 slot untuk uji notifikasi pembelian
    await WhatsappAlertService.updateConfig(
      {
        isEnabled: true,
        recipientSlots: [
          { slot: 1, label: 'Purchasing', number: '0812000001', enabled: true },
          { slot: 2, label: '', number: '', enabled: false },
          { slot: 3, label: '', number: '', enabled: false },
          { slot: 4, label: '', number: '', enabled: false },
        ],
      },
      { id: adminUser.id, name: adminUser.name }
    );

    // ------------------------------------------------------------------
    // 2. Pengajuan Pembelian ('beli') vs Ambil/Kembalikan (WA Selektif)
    // ------------------------------------------------------------------
    console.log('\n--- 2. Request Pengajuan Pembelian & WA Selektif ---');

    const jenisTest = await CatalogService.createJenis({
      nama: `Uji Beli ${suffix}`,
      sumber_id_bawaan: 'tanpa_id',
      atributs: [
        {
          kode: 'model',
          nama: 'Model',
          tipe_isian: 'pilihan',
          wajib: true,
          urutan: 1,
          masuk_nama: true,
          opsi: ['Standar'],
        },
      ],
    }, adminUser.id);

    const attrModel = jenisTest.atributs![0];
    const opsiStandar = attrModel.opsi![0];
    const prod = await CatalogService.createProduk({
      jenis_id: jenisTest.id,
      nama: `Kabel Patchcord ${suffix}`,
      kategori: 'fast_moving',
      kategori_barang: 'Barang Habis Pakai',
    }, adminUser.id);

    const tipe = await CatalogService.createTipe({
      produk_id: prod.id,
      sumber_id: 'tanpa_id',
      nilai_atribut: [{ atribut_id: attrModel.id, opsi_id: opsiStandar.id }],
    }, adminUser.id);

    const box = await StockService.createBox(`BXB-${suffix}`, 'Rak Uji Beli', adminUser.id);
    await StockService.inputStokJumlah({
      tipe_id: tipe.id,
      box_id: box.id,
      jumlah: 5,
      user_id: adminUser.id,
      catatan: 'Stok awal uji',
    });

    // Reset spy counters
    purchaseNotifCalls = [];
    newRequestNotifCalls = [];

    // 2a. Ambil barang -> TIDAK BOLEH memicu notifikasi WA
    const ambilReq = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'ambil',
      tipeId: tipe.id,
      boxId: box.id,
      jumlah: 1,
      alasan: 'Kebutuhan instalasi pelanggan',
    });
    assert(ambilReq.request_type === 'ambil', 'Request ambil berhasil dibuat');
    assert(
      purchaseNotifCalls.length === 0 && newRequestNotifCalls.length === 0,
      'Permohonan Ambil Barang TIDAK mengirim notifikasi WhatsApp'
    );

    // Proses ambil hingga diambil lalu ajukan kembalikan -> TIDAK BOLEH kirim WA
    await RequestService.approveRequest({
      requestId: ambilReq.id,
      penyetujuId: adminUser.id,
      penyetujuRole: adminUser.role,
      targetBoxId: box.id,
    });
    await RequestService.pickupRequest({
      requestId: ambilReq.id,
      recordedById: adminUser.id,
      recordedByRole: adminUser.role,
    });

    const returnReq = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'kembalikan',
      originRequestId: ambilReq.id,
      returnCondition: 'Baik',
      returnBoxId: box.id,
      alasan: 'Sisa pekerjaan, kembali ke gudang',
    });
    assert(returnReq.request_type === 'kembalikan', 'Request kembalikan berhasil dibuat');
    assert(
      purchaseNotifCalls.length === 0 && newRequestNotifCalls.length === 0,
      'Pengajuan Pengembalian Barang TIDAK mengirim notifikasi WhatsApp'
    );

    // 2b. Pengajuan Pembelian dari Katalog (tanpa estimasi harga - opsional)
    const purchaseCatalogReq = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'beli',
      tipeId: tipe.id,
      jumlah: 10,
      alasan: 'Stok patchcord menipis untuk proyek bulan depan',
    });
    assert(purchaseCatalogReq.request_type === 'beli', 'Request pembelian dari katalog tersimpan dengan tipe beli');
    assert(purchaseCatalogReq.purchase_estimated_price === null, 'Estimasi harga opsional dapat dikosongkan (null)');
    assert(purchaseNotifCalls.length === 1, 'Pengajuan pembelian katalog memicu notifikasi WA tepat 1 kali');

    // 2c. Pengajuan Pembelian Barang Baru (Non-Katalog, tipe_id = null, dengan estimasi harga)
    const purchaseNewReq = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'beli',
      purchaseItemName: `MikroTik RB5009UG+S+IN Uji ${suffix}`,
      jumlah: 2,
      purchaseEstimatedPrice: 3850000,
      alasan: 'Upgrade router distribusi POP baru',
    });
    assert(
      Boolean(
        purchaseNewReq.request_type === 'beli' &&
          purchaseNewReq.tipe_id === null &&
          purchaseNewReq.purchase_item_name?.includes('MikroTik RB5009')
      ),
      'Request pembelian barang baru non-katalog tersimpan tanpa tipe_id'
    );
    assert(
      Number(purchaseNewReq.purchase_estimated_price) === 3850000,
      'Estimasi harga opsional tersimpan akurat bila diisi'
    );
    assert(purchaseNotifCalls.length === 2, 'Pengajuan pembelian barang baru juga memicu notifikasi WA');

    // 2d. Approve & Complete pengajuan pembelian (tidak boleh mengubah stok gudang)
    const stockBeforeApprove = await CatalogService.getTipeById(tipe.id);
    const availBefore = Number(stockBeforeApprove?.stok_tersedia ?? 0);

    await RequestService.approveRequest({
      requestId: purchaseNewReq.id,
      penyetujuId: adminUser.id,
      penyetujuRole: adminUser.role,
    });
    const approvedPurchase = await RequestService.getRequestById(purchaseNewReq.id);
    assert(approvedPurchase?.status === 'disetujui', 'Pengajuan pembelian berhasil disetujui admin/gudang');

    let pickupBlocked = false;
    try {
      await RequestService.pickupRequest({
        requestId: purchaseNewReq.id,
        recordedById: adminUser.id,
        recordedByRole: adminUser.role,
      });
    } catch {
      pickupBlocked = true;
    }
    assert(pickupBlocked, 'Pengajuan pembelian tidak bisa diproses lewat pickup gudang biasa');

    await RequestService.completeRequest({
      requestId: purchaseNewReq.id,
      userId: adminUser.id,
      userName: adminUser.name,
      userRole: adminUser.role,
      usageNotes: 'Sudah dibeli via PO-TEST-001',
    });
    const completedPurchase = await RequestService.getRequestById(purchaseNewReq.id);
    assert(completedPurchase?.status === 'selesai', 'Pengajuan pembelian dapat ditandai selesai (Sudah Dibeli)');

    const stockAfterApprove = await CatalogService.getTipeById(tipe.id);
    assert(
      Number(stockAfterApprove?.stok_tersedia ?? 0) === availBefore,
      'Alur persetujuan pembelian tidak memotong/mereservasi stok fisik gudang'
    );

    // ------------------------------------------------------------------
    // 3. Konfigurasi Kop & Lembar Pengesahan Dinamis (REPORT_APPROVAL_CONFIG)
    // ------------------------------------------------------------------
    console.log('\n--- 3. Konfigurasi Dinamis Lembar Pengesahan Laporan ---');

    const customReportConfig = {
      companyName: 'PT. JARINGAN NUSANTARA MANDIRI',
      divisionName: 'Divisi Operasional NOC & Field Engineering',
      companyAddress: 'Jl. Merdeka Selatan No. 88, Bandung',
      signers: [
        { roleLabel: 'Dibuat Oleh', name: 'Staff Gudang', title: 'Logistics Officer', useCurrentUser: true },
        { roleLabel: 'Diperiksa Oleh', name: 'Koordinator Lapangan', title: 'Field Lead', useCurrentUser: false },
        { roleLabel: 'Disetujui Oleh', name: 'Kepala Operasional', title: 'Head of Ops', useCurrentUser: false },
      ],
    };

    await SettingService.set(
      'REPORT_APPROVAL_CONFIG',
      JSON.stringify(customReportConfig),
      'Test custom approval config'
    );
    const savedReportCfg = await SettingService.getJSON<typeof customReportConfig>('REPORT_APPROVAL_CONFIG');
    assert(
      savedReportCfg?.companyName === 'PT. JARINGAN NUSANTARA MANDIRI' &&
        savedReportCfg?.signers?.length === 3 &&
        savedReportCfg.signers[2].name === 'Kepala Operasional',
      'Konfigurasi Kop & Penandatangan Lembar Pengesahan tersimpan dan terbaca konsisten'
    );
  } finally {
    NotificationService.notifyPurchaseRequest = origNotifyPurchase;
    NotificationService.notifyNewRequest = origNotifyNewRequest;
  }

  console.log('\n================================================================');
  console.log(`  HASIL: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
