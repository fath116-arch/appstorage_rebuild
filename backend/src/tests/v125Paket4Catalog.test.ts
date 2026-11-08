/**
 * Test Suite: FieldOps v1.2.5 Paket 4 (Katalog dan Produk: Storage Box, Tipe Stok, Kategori Barang, Kondisi Item)
 * Lokasi: backend/src/tests/v125Paket4Catalog.test.ts
 */

import { executeQuery, initDatabase, memoryStore } from '../db/database';
import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { RequestService } from '../services/requestService';
import crypto from 'crypto';

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
  console.log(' RUNNING TESTS: FieldOps v1.2.5 Paket 4 (Katalog & Kondisi)');
  console.log('================================================================\n');

  // 1. Setup Database & Migrations
  await test('Migrasi 08_v125_paket4_schema.sql dijalankan tanpa error', async () => {
    await initDatabase();
  });

  const testUserId = `user-tester-${Date.now()}`;

  // Buat User & Box pengujian
  await executeQuery(
    `INSERT INTO users (id, username, name, email, role, department, password_hash, salt, status)
     VALUES (?, ?, ?, ?, 'admin', 'IT', 'dummyhash', 'dummysalt', 'ACTIVE')`,
    [testUserId, `admin_${Date.now()}`, 'Admin Test', `adm_${Date.now()}@test.com`]
  );

  const testBox = await StockService.createBox('BOX-PKT4', 'Box Pengujian Paket 4', testUserId);
  const testBoxId = testBox.id;

  // Buat Jenis & Atribut pengujian
  const jenis = await CatalogService.createJenis({
    nama: `Jenis P4 ${Date.now()}`,
    sumber_id_bawaan: 'manual',
    atributs: [
      {
        kode: 'warna',
        nama: 'Warna',
        tipe_isian: 'pilihan',
        opsi: ['Hitam', 'Putih', 'Biru'],
        masuk_nama: true,
        wajib: true,
        urutan: 1
      }
    ]
  }, testUserId);

  // 2. Test Nilai Default Produk Lama
  await test('Produk lama memiliki nilai default kategori_barang dan tipe_stok', async () => {
    // Simulasi insert produk lama tanpa kolom baru
    const legacyProdRes = await executeQuery<any>(
      `INSERT INTO produk (jenis_id, nama, kategori, catatan, aktif, dibuat_oleh)
       VALUES (?, ?, 'fast_moving', 'Legacy product', 1, ?)`,
      [jenis.id, 'Produk Lama Suku Cadang', testUserId]
    );

    const legacyId = (legacyProdRes as any).insertId || (legacyProdRes as any).id;
    const prod = await CatalogService.getProdukById(legacyId);
    if (!prod) throw new Error('Legacy product not found');

    if (prod.kategori_barang !== 'Barang Habis Pakai') {
      throw new Error(`Expected default 'Barang Habis Pakai', got '${prod.kategori_barang}'`);
    }
    if (prod.tipe_stok !== 'unit') {
      throw new Error(`Expected default 'unit', got '${prod.tipe_stok}'`);
    }
  });

  // 3. Test Buat Produk Baru dengan Kategori Barang 'Alat' dan Tipe Stok 'roll'
  let newProdId: number = 0;
  await test('Pembuatan produk baru dengan kategori_barang Alat dan tipe_stok roll', async () => {
    const prod = await CatalogService.createProduk({
      jenis_id: jenis.id,
      nama: 'Tang Crimping RJ45 Pro',
      kategori: 'fast_moving',
      kategori_barang: 'Alat',
      tipe_stok: 'roll',
      catatan: 'Toolkit teknisi lapangan'
    }, testUserId);

    newProdId = prod.id;
    if (prod.kategori_barang !== 'Alat') {
      throw new Error(`Expected kategori_barang 'Alat', got '${prod.kategori_barang}'`);
    }
    if (prod.tipe_stok !== 'roll') {
      throw new Error(`Expected tipe_stok 'roll', got '${prod.tipe_stok}'`);
    }
  });

  // 4. Test Filter Katalog berdasarkan Kategori Barang
  await test('CatalogService.listProduk dapat memfilter berdasarkan kategori_barang', async () => {
    const prodsAlat = await CatalogService.listProduk({ kategori_barang: 'Alat' });
    const exists = prodsAlat.some(p => p.id === newProdId);
    if (!exists) {
      throw new Error('Produk dengan kategori_barang Alat tidak muncul di hasil filter');
    }

    const prodsHabisPakai = await CatalogService.listProduk({ kategori_barang: 'Barang Habis Pakai' });
    const shouldNotExist = prodsHabisPakai.some(p => p.id === newProdId);
    if (shouldNotExist) {
      throw new Error('Produk kategori_barang Alat keliru muncul di filter Barang Habis Pakai');
    }
  });

  // 5. Test Tipe Stok Suggestions
  await test('CatalogService.getTipeStokSuggestions mengembalikan daftar saran unik', async () => {
    const suggestions = await CatalogService.getTipeStokSuggestions();
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('Suggestions harus berupa array non-kosong');
    }
    if (!suggestions.includes('roll')) {
      throw new Error("Suggestions harus memuat 'roll' yang baru saja digunakan");
    }
  });

  // 6. Test Input Item dengan Kondisi
  let tipeId: number = 0;
  let itemBaikId: string = '';
  let itemRusakId: string = '';

  await test('Input item fisik dengan kondisi Baru dan Baik', async () => {
    const warnaAttr = jenis.atributs!.find(a => a.kode.toLowerCase() === 'warna')!;
    const opsiHitam = warnaAttr.opsi!.find(o => o.nilai === 'Hitam')!;

    const tipe = await CatalogService.createTipe({
      produk_id: newProdId,
      sumber_id: 'manual',
      nilai_atribut: [
        {
          atribut_id: warnaAttr.id,
          opsi_id: opsiHitam.id
        }
      ]
    }, testUserId);
    tipeId = tipe.id;

    // Input item 1: Kondisi Baru
    const kodeItem1 = `SN-PKT4-01-${Date.now()}`;
    const res1 = await StockService.inputStokItemSingle({
      tipe_id: tipeId,
      box_id: testBoxId,
      kode_id: kodeItem1,
      user_id: testUserId,
      kondisi: 'Baru',
      catatan_kondisi: 'Segel pabrik'
    });
    itemBaikId = kodeItem1;

    // Input item 2: Kondisi Baik
    const kodeItem2 = `SN-PKT4-02-${Date.now()}`;
    const res2 = await StockService.inputStokItemSingle({
      tipe_id: tipeId,
      box_id: testBoxId,
      kode_id: kodeItem2,
      user_id: testUserId,
      kondisi: 'Baik'
    });
    itemRusakId = kodeItem2;

    const check1 = await StockService.checkDuplicateKodeId(kodeItem1);
    if (!check1.exists || check1.item.kondisi !== 'Baru') {
      throw new Error(`Kondisi item 1 harus 'Baru', didapat: ${check1.item?.kondisi}`);
    }
  });

  // 7. Test Ubah Kondisi Item & Pencatatan Audit Log
  await test('StockService.updateKondisiItem memperbarui kondisi ke Rusak dan mencatat audit log', async () => {
    const updateRes = await StockService.updateKondisiItem({
      itemId: itemRusakId,
      kondisi: 'Rusak',
      catatanKondisi: 'Gagang patah saat uji beban',
      userId: testUserId
    });

    if (!updateRes.success || updateRes.item.kondisi !== 'Rusak') {
      throw new Error(`Gagal mengubah kondisi ke Rusak: ${JSON.stringify(updateRes)}`);
    }

    const check = await StockService.checkDuplicateKodeId(itemRusakId);
    if (check.item.kondisi !== 'Rusak') {
      throw new Error(`Kondisi database belum diperbarui ke Rusak`);
    }
    if (check.item.catatan_kondisi !== 'Gagang patah saat uji beban') {
      throw new Error(`Catatan kondisi tidak tersimpan`);
    }
  });

  // 8. Test Item Rusak Tidak Dihitung Sebagai Stok Tersedia
  await test('Item berstatus Rusak tidak dihitung sebagai stok tersedia', async () => {
    const tipeDetail = await CatalogService.getTipeById(tipeId);
    if (!tipeDetail) throw new Error('Tipe tidak ditemukan');

    // Total ada 2 item, tapi 1 Rusak -> stok_total = 2, stok_tersedia = 1, stok_rusak = 1
    if (tipeDetail.stok_total !== 2) {
      throw new Error(`Expected stok_total = 2, got ${tipeDetail.stok_total}`);
    }
    if (tipeDetail.stok_tersedia !== 1) {
      throw new Error(`Expected stok_tersedia = 1 (exclude Rusak), got ${tipeDetail.stok_tersedia}`);
    }
    if (tipeDetail.stok_rusak !== 1) {
      throw new Error(`Expected stok_rusak = 1, got ${tipeDetail.stok_rusak}`);
    }
  });

  // 9. Test Request Teknisi Menolak Item Rusak
  await test('RequestService.createRequest menolak jika kode_id yang diminta berkondisi Rusak', async () => {
    let errorThrown = false;
    try {
      await RequestService.createRequest({
        pemohonId: testUserId,
        tipeId: tipeId,
        kodeId: itemRusakId, // Item yang berstatus Rusak!
        jumlah: 1,
        alasan: 'Uji request item rusak'
      });
    } catch (err: any) {
      errorThrown = true;
      if (!err.message.includes('kondisi Rusak')) {
        throw new Error(`Pesan error tidak sesuai: ${err.message}`);
      }
    }

    if (!errorThrown) {
      throw new Error('createRequest seharusnya menolak item dengan kondisi Rusak');
    }
  });

  // 10. Test Request Teknisi Berhasil Memilih Item Baik / Non-Rusak
  let validRequestId: string = '';
  await test('RequestService.createRequest berhasil jika kode_id yang dipilih bukan Rusak', async () => {
    const req = await RequestService.createRequest({
      pemohonId: testUserId,
      tipeId: tipeId,
      kodeId: itemBaikId, // Item berstatus Baru
      jumlah: 1,
      alasan: 'Permohonan teknisi untuk item dalam kondisi baik'
    });

    if (!req || req.status !== 'menunggu') {
      throw new Error('Gagal membuat request valid');
    }
    validRequestId = req.id;
  });

  // 11. Test Persetujuan Request & Auto-deduct Memastikan Non-Rusak
  await test('RequestService.approveRequest berhasil menyetujui request item non-rusak', async () => {
    const approvalRes = await RequestService.approveRequest({
      requestId: validRequestId,
      penyetujuId: testUserId
    });

    if (!approvalRes.success) {
      throw new Error(`Approval gagal: ${JSON.stringify(approvalRes)}`);
    }

    const check = await StockService.checkDuplicateKodeId(itemBaikId);
    if (check.item.status !== 'keluar') {
      throw new Error(`Item ${itemBaikId} harusnya berstatus 'keluar' setelah disetujui`);
    }
  });

  // 12. Test Restore Item dari Arsip dengan Input Kondisi Baru
  await test('StockService.restoreItemFromArchive menerima kondisi dan catatan_kondisi saat dikembalikan ke stok aktif', async () => {
    const restoreRes = await StockService.restoreItemFromArchive({
      kodeId: itemBaikId,
      targetBoxId: testBoxId,
      userId: testUserId,
      confirmProductMatched: true,
      kondisi: 'Baik',
      catatanKondisi: 'Telah diperiksa kembali setelah selesai pekerjaan'
    });

    if (!restoreRes.success) {
      throw new Error(`Restore gagal: ${JSON.stringify(restoreRes)}`);
    }

    const check = await StockService.checkDuplicateKodeId(itemBaikId);
    if (check.item.status !== 'aktif') {
      throw new Error(`Item ${itemBaikId} harusnya kembali berstatus 'aktif'`);
    }
    if (check.item.kondisi !== 'Baik') {
      throw new Error(`Item ${itemBaikId} kondisi harusnya 'Baik', didapat: ${check.item.kondisi}`);
    }
    if (!check.item.catatan_kondisi?.includes('diperiksa kembali')) {
      throw new Error(`Catatan kondisi saat restore tidak tersimpan`);
    }
  });

  // 13. Test Isi Storage Box Mendukung Campuran Berbagai Produk & Menampilkan Kondisi
  await test('StockService.getBoxContents menampilkan campuran produk beserta kondisi itemnya', async () => {
    const contents = await StockService.getBoxContents(testBoxId);
    if (!contents || !contents.contents) {
      throw new Error('Gagal mengambil isi box');
    }

    let foundItem = false;
    for (const [prodName, tipes] of Object.entries(contents.contents)) {
      for (const [tName, tObj] of Object.entries(tipes as any)) {
        for (const it of (tObj as any).items) {
          if (it.kode_id === itemRusakId) {
            foundItem = true;
            if (it.kondisi !== 'Rusak') {
              throw new Error(`Kondisi item di isi box harus 'Rusak', didapat: ${it.kondisi}`);
            }
          }
        }
      }
    }

    if (!foundItem) {
      throw new Error(`Item ${itemRusakId} tidak ditemukan di isi box`);
    }
  });

  console.log('\n================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(` TOTAL TESTS: ${results.length} | PASS: ${passedCount} | FAIL: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
