/**
 * Test Suite: Hapus & Modifikasi Katalog (Kategori, Atribut, Produk, Box)
 *             + Request Pengembalian Barang ("Kembalikan") dengan 3 Kondisi Terpetakan
 */

import { initDatabase } from '../db/database';
import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { RequestService } from '../services/requestService';

async function runTests() {
  console.log('================================================================');
  console.log('  PENGUJIAN HAPUS/EDIT KATALOG & REQUEST PENGEMBALIAN BARANG');
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

  const adminUser = { id: 'usr-admin-demo', role: 'admin' };
  const warehouseUser = { id: 'usr-wh-demo', role: 'warehouse_admin' };
  const techUser = { id: 'usr-tek-demo', role: 'technician' };
  const otherTechUser = { id: 'usr-tek-2', role: 'technician' };
  const suffix = Date.now().toString().slice(-6);

  try {
    // ------------------------------------------------------------------
    // 1. Setup Kategori + Atribut + Produk + Tipe + Box
    // ------------------------------------------------------------------
    const jenisA = await CatalogService.createJenis({
      nama: `Alat Ukur ${suffix}`,
      sumber_id_bawaan: 'manual',
      prefix_id_bawaan: 'ALU',
      atributs: [
        {
          kode: 'merk',
          nama: 'Merk',
          tipe_isian: 'pilihan',
          wajib: true,
          urutan: 1,
          masuk_nama: true,
          opsi: ['Fluke', 'Hioki']
        },
        {
          kode: 'cadangan',
          nama: 'Atribut Cadangan',
          tipe_isian: 'teks',
          wajib: false,
          urutan: 2,
          masuk_nama: false
        }
      ]
    }, adminUser.id);

    const jenisB = await CatalogService.createJenis({
      nama: `Kategori Lain ${suffix}`,
      sumber_id_bawaan: 'tanpa_id',
      atributs: []
    }, adminUser.id);

    const attrMerk = jenisA.atributs!.find(a => a.kode === 'merk')!;
    const attrCadangan = jenisA.atributs!.find(a => a.kode === 'cadangan')!;
    const opsiFluke = attrMerk.opsi!.find(o => o.nilai === 'Fluke')!;
    const opsiHioki = attrMerk.opsi!.find(o => o.nilai === 'Hioki')!;

    // ------------------------------------------------------------------
    // 2. Uji Edit Kategori (updateJenis) & Tolak Duplikat
    // ------------------------------------------------------------------
    const updatedJenisA = await CatalogService.updateJenis(jenisA.id, {
      nama: `Alat Ukur Optik ${suffix}`,
      sumber_id_bawaan: 'scan_sn',
      prefix_id_bawaan: 'OPT'
    }, adminUser.id);
    assert(
      updatedJenisA.nama === `Alat Ukur Optik ${suffix}` &&
      updatedJenisA.sumber_id_bawaan === 'scan_sn' &&
      updatedJenisA.prefix_id_bawaan === 'OPT',
      'updateJenis berhasil memperbarui nama dan aturan bawaan kategori'
    );

    let dupJenisError = false;
    try {
      await CatalogService.updateJenis(jenisA.id, { nama: jenisB.nama }, adminUser.id);
    } catch {
      dupJenisError = true;
    }
    assert(dupJenisError, 'updateJenis menolak nama duplikat dengan kategori aktif lain');

    // ------------------------------------------------------------------
    // 3. Buat Produk & Tipe yang menggunakan Atribut Merk & Opsi Fluke
    // ------------------------------------------------------------------
    const prod = await CatalogService.createProduk({
      jenis_id: jenisA.id,
      nama: `OTDR Pro ${suffix}`,
      kategori: 'recycle',
      kategori_barang: 'Alat'
    }, adminUser.id);

    const tipeFluke = await CatalogService.createTipe({
      produk_id: prod.id,
      sumber_id: 'manual',
      nilai_atribut: [{ atribut_id: attrMerk.id, opsi_id: opsiFluke.id }]
    }, adminUser.id);

    // ------------------------------------------------------------------
    // 4. Uji Edit Atribut (updateAtribut) & Proteksi Atribut/Opsi Aktif
    // ------------------------------------------------------------------
    // Ubah tipe_isian atribut yang sudah dipakai tipe aktif -> DITOLAK
    let lockTipeIsianError = false;
    try {
      await CatalogService.updateAtribut(attrMerk.id, {
        kode: 'merk',
        nama: 'Merk Alat',
        tipe_isian: 'teks'
      }, adminUser.id);
    } catch {
      lockTipeIsianError = true;
    }
    assert(lockTipeIsianError, 'updateAtribut menolak perubahan tipe_isian saat dipakai varian tipe aktif');

    // Hapus opsi 'Fluke' yang sedang dipakai -> DITOLAK
    let deleteUsedOptError = false;
    try {
      await CatalogService.updateAtribut(attrMerk.id, {
        kode: 'merk',
        nama: 'Merk Alat',
        tipe_isian: 'pilihan',
        opsi: [{ id: opsiHioki.id, nilai: 'Hioki' }]
      }, adminUser.id);
    } catch {
      deleteUsedOptError = true;
    }
    assert(deleteUsedOptError, 'updateAtribut menolak penghapusan opsi yang masih dipakai varian tipe aktif');

    // Rename atribut + tambah opsi baru + hapus opsi yang TIDAK dipakai ('Hioki') -> BERHASIL
    const updatedMerk = await CatalogService.updateAtribut(attrMerk.id, {
      kode: 'merk_alat',
      nama: 'Merk Resmi',
      tipe_isian: 'pilihan',
      wajib: true,
      masuk_nama: true,
      opsi: [
        { id: opsiFluke.id, nilai: 'Fluke Networks' },
        { nilai: 'EXFO' }
      ]
    }, adminUser.id);
    assert(
      updatedMerk.kode === 'merk_alat' &&
      updatedMerk.nama === 'Merk Resmi' &&
      Boolean(updatedMerk.opsi?.some(o => o.nilai === 'Fluke Networks')) &&
      Boolean(updatedMerk.opsi?.some(o => o.nilai === 'EXFO')) &&
      !updatedMerk.opsi?.some(o => o.nilai === 'Hioki'),
      'updateAtribut berhasil mengubah nama/kode, rename opsi, menambah opsi baru, dan menghapus opsi tidak terpakai'
    );

    // ------------------------------------------------------------------
    // 5. Uji Hapus Atribut (Proteksi Aktif vs Bebas)
    // ------------------------------------------------------------------
    const canDelMerk = await CatalogService.canDeleteAtribut(attrMerk.id);
    assert(canDelMerk.canDelete === false, 'canDeleteAtribut menolak hapus atribut yang masih dipakai varian tipe aktif');

    const delMerkFail = await CatalogService.deleteAtribut(attrMerk.id, adminUser.id);
    assert(delMerkFail.success === false, 'deleteAtribut mengembalikan success=false jika masih dipakai');

    const delCadanganOk = await CatalogService.deleteAtribut(attrCadangan.id, adminUser.id);
    assert(delCadanganOk.success === true, 'deleteAtribut berhasil menghapus atribut yang tidak dipakai varian tipe aktif');

    // ------------------------------------------------------------------
    // 6. Setup Box & Stok untuk Menguji Proteksi Hapus Box & Produk + Request Return
    // ------------------------------------------------------------------
    const box1 = await StockService.createBox(`BX1-${suffix}`, 'Rak Uji 1', adminUser.id);
    const box2 = await StockService.createBox(`BX2-${suffix}`, 'Rak Uji 2', adminUser.id);
    const kodeTool = `TOOL-SN-${suffix}`;

    await StockService.inputStokItemSingle({
      tipe_id: tipeFluke.id,
      box_id: box1.id,
      kode_id: kodeTool,
      user_id: adminUser.id
    });

    // Hapus Box 1 yang masih berisi stok -> DITOLAK
    const canDelBox1 = await StockService.canDeleteBox(box1.id);
    assert(canDelBox1.canDelete === false, 'canDeleteBox menolak penghapusan box yang masih memiliki stok aktif');
    const delBox1Fail = await StockService.deleteBox(box1.id, adminUser.id);
    assert(delBox1Fail.success === false, 'deleteBox menolak penghapusan box berisi');

    // Hapus Produk yang masih memiliki stok aktif -> DITOLAK
    const canDelProdBusy = await CatalogService.canDeleteProduk(prod.id);
    assert(canDelProdBusy.canDelete === false, 'canDeleteProduk menolak penghapusan produk dengan stok aktif');
    const delProdFail = await CatalogService.deleteProduk(prod.id, adminUser.id);
    assert(delProdFail.success === false, 'deleteProduk menolak penghapusan produk dengan stok aktif');

    // ------------------------------------------------------------------
    // 7. Uji Alur Request Ambil -> Pickup -> Ajukan Kembalikan -> Verifikasi Gudang
    // ------------------------------------------------------------------
    const reqAmbil = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'ambil',
      tipeId: tipeFluke.id,
      kodeId: kodeTool,
      alasan: 'Splicing backbone cluster timur'
    });

    await RequestService.approveRequest({
      requestId: reqAmbil.id,
      penyetujuId: warehouseUser.id
    });

    await RequestService.pickupRequest({
      requestId: reqAmbil.id,
      recordedById: warehouseUser.id,
      recordedByRole: warehouseUser.role,
      catatan: 'Diambil teknisi'
    });

    // Tolak pengajuan kembalikan oleh teknisi lain
    let wrongActorReturnError = false;
    try {
      await RequestService.createRequest({
        pemohonId: otherTechUser.id,
        requestType: 'kembalikan',
        originRequestId: reqAmbil.id,
        returnCondition: 'Baik',
        returnBoxId: box2.id
      });
    } catch {
      wrongActorReturnError = true;
    }
    assert(wrongActorReturnError, 'Pengajuan kembalikan ditolak jika origin dimiliki teknisi lain');

    // Ajukan pengembalian dengan kondisi terpetakan ('Baik' <- Normal, 'Baru' <- Belum Terpakai, 'Rusak' <- Rusak)
    const reqKembalikan = await RequestService.createRequest({
      pemohonId: techUser.id,
      requestType: 'kembalikan',
      originRequestId: reqAmbil.id,
      returnCondition: 'Rusak',
      returnBoxId: box2.id,
      returnNotes: 'Port laser buram setelah terjatuh di lapangan'
    });

    assert(
      reqKembalikan.status === 'diajukan' &&
      reqKembalikan.request_type === 'kembalikan' &&
      reqKembalikan.origin_request_id === reqAmbil.id &&
      reqKembalikan.return_condition === 'Rusak',
      'Pengajuan request kembalikan berhasil dibuat dengan status diajukan & origin_request_id terhubung'
    );

    // Cek held list menandai has_pending_return = true
    const heldList = await RequestService.listHeldByTechnicians({ actorId: techUser.id });
    const heldOrigin = heldList.find(h => h.id === reqAmbil.id);
    assert(heldOrigin?.has_pending_return === true, 'Barang di tangan teknisi ditandai has_pending_return=true saat ada request kembalikan aktif');

    // Cegah pengajuan kembalikan duplikat untuk barang yang sama
    let dupReturnError = false;
    try {
      await RequestService.createRequest({
        pemohonId: techUser.id,
        requestType: 'kembalikan',
        originRequestId: reqAmbil.id,
        returnCondition: 'Baru',
        returnBoxId: box2.id
      });
    } catch {
      dupReturnError = true;
    }
    assert(dupReturnError, 'Pengajuan kembalikan ganda untuk barang yang sedang menunggu verifikasi ditolak');

    // Cegah approveRequest (alur ambil) pada request bertipe kembalikan
    let approveReturnBlocked = false;
    try {
      await RequestService.approveRequest({
        requestId: reqKembalikan.id,
        penyetujuId: warehouseUser.id
      });
    } catch {
      approveReturnBlocked = true;
    }
    assert(approveReturnBlocked, 'approveRequest (alur ambil) menolak request bertipe kembalikan');

    // Gudang memverifikasi dan menerima pengembalian via returnRequest(reqKembalikan.id)
    const verifyRes = await RequestService.returnRequest({
      requestId: reqKembalikan.id,
      recordedById: warehouseUser.id,
      recordedByRole: warehouseUser.role,
      returnCondition: 'Rusak',
      returnBoxId: box2.id,
      returnNotes: 'Diverifikasi gudang, masuk antrian servis'
    });
    assert(verifyRes.success === true, 'Verifikasi & terima pengembalian oleh gudang berhasil');

    const retAfter = await RequestService.getRequestById(reqKembalikan.id);
    const originAfter = await RequestService.getRequestById(reqAmbil.id);
    const itemAfter = await StockService.checkDuplicateKodeId(kodeTool);
    assert(
      retAfter?.status === 'dikembalikan' && originAfter?.status === 'dikembalikan',
      'Status request pengembalian DAN request pengambilan asal keduanya berubah menjadi DIKEMBALIKAN'
    );
    assert(
      itemAfter.item?.status === 'aktif' &&
      itemAfter.item?.kondisi === 'Rusak' &&
      itemAfter.item?.box_id === box2.id,
      'Item fisik kembali AKTIF dengan kondisi terverifikasi (Rusak) di Box tujuan baru (BX2)'
    );

    // ------------------------------------------------------------------
    // 8. Uji Hapus Box Kosong, Hapus Produk Kosong, & Hapus Kategori Kosong
    // ------------------------------------------------------------------
    const delBox1Empty = await StockService.deleteBox(box1.id, adminUser.id);
    assert(delBox1Empty.success === true, 'deleteBox berhasil menghapus Box 1 setelah tidak ada stok & request terbuka');

    // Perbarui kondisi alat dari Rusak ke Baik lalu keluarkan dari Box 2 agar Box & Produk kosong dan bisa dihapus
    await StockService.updateKondisiItem({
      itemId: itemAfter.item!.id,
      kondisi: 'Baik',
      catatanKondisi: 'Selesai perbaikan kalibrasi',
      userId: adminUser.id
    });
    await StockService.barangKeluarSingle({
      itemId: itemAfter.item!.id,
      userId: adminUser.id,
      catatan: 'Dipindahkan ke stok proyek luar'
    });
    const delBox2Empty = await StockService.deleteBox(box2.id, adminUser.id);
    assert(delBox2Empty.success === true, 'deleteBox berhasil menghapus Box 2 setelah item dikeluarkan');

    const delProdOk = await CatalogService.deleteProduk(prod.id, adminUser.id);
    assert(delProdOk.success === true, 'deleteProduk berhasil memindahkan produk tanpa stok/request aktif ke Sampah');

    const delJenisAfter = await CatalogService.deleteJenis(jenisA.id, adminUser.id);
    assert(delJenisAfter.success === true, 'deleteJenis berhasil menghapus kategori setelah tidak ada produk aktif');

    const delJenisBOk = await CatalogService.deleteJenis(jenisB.id, adminUser.id);
    assert(delJenisBOk.success === true, 'deleteJenis berhasil menghapus kategori kosong lain');
  } catch (err) {
    console.error('❌ Exception during test:', err);
    failed++;
  }

  console.log('================================================================');
  console.log(`  HASIL TEST BARU: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
