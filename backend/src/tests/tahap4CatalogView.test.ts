/**
 * Unit & Integration Test — Tahap 4: Antarmuka Katalog Toko Online & Filter
 * FieldOps Inventory v2
 */

import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { AuthService } from '../services/authService';
import { executeQuery } from '../db/database';

import { initDatabase } from '../db/database';

async function runTahap4Tests() {
  console.log('=== STARTING TAHAP 4 CATALOG VIEW & FILTER SUITE ===\n');
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
    // 0. Mock user for test
    const user = { id: 'usr-admin-demo', username: 'admin', role: 'admin' };

    // 1. Buat Jenis sampel
    const testJenis = await CatalogService.createJenis({
      nama: `Jenis Toko T4 ${Date.now()}`,
      sumber_id_bawaan: 'manual',
      prefix_id_bawaan: 'T4-',
      atributs: [
        { kode: 'tegangan', nama: 'Tegangan', tipe_isian: 'angka', satuan: 'V', wajib: true, urutan: 1, masuk_nama: true },
        { kode: 'port', nama: 'Port', tipe_isian: 'pilihan', opsi: ['RJ45', 'SFP'], wajib: true, urutan: 2, masuk_nama: true }
      ]
    }, user.id);
    assert(!!testJenis.id, 'Jenis untuk pengujian Tahap 4 berhasil dibuat');

    // 2. Buat 2 Produk (1 Fast Moving, 1 Recycle)
    const prodFast = await CatalogService.createProduk({
      jenis_id: testJenis.id,
      nama: `Router Fast ${Date.now()}`,
      kategori: 'fast_moving',
      catatan: 'Produk Fast Moving'
    }, user.id);

    const prodRecycle = await CatalogService.createProduk({
      jenis_id: testJenis.id,
      nama: `Modem Recycle ${Date.now()}`,
      kategori: 'recycle',
      catatan: 'Produk Recycle'
    }, user.id);

    assert(prodFast.kategori === 'fast_moving', 'Kategori Fast Moving tersimpan dengan benar');
    assert(prodRecycle.kategori === 'recycle', 'Kategori Recycle tersimpan dengan benar');

    // 3. Tambah Tipe ke Router Fast
    const tipe1 = await CatalogService.createTipe({
      produk_id: prodFast.id,
      sumber_id: 'manual',
      nilai_atribut: [
        { atribut_id: testJenis.atributs![0].id, nilai_angka: 12 },
        { atribut_id: testJenis.atributs![1].id, opsi_id: testJenis.atributs![1].opsi![0].id }
      ]
    }, user.id);

    const tipe2 = await CatalogService.createTipe({
      produk_id: prodFast.id,
      sumber_id: 'tanpa_id',
      nilai_atribut: [
        { atribut_id: testJenis.atributs![0].id, nilai_angka: 24 },
        { atribut_id: testJenis.atributs![1].id, opsi_id: testJenis.atributs![1].opsi![1].id }
      ]
    }, user.id);

    assert(!!tipe1.id && !!tipe2.id, 'Tipe varian produk berhasil ditambahkan');

    // 4. Buat Box & Input Stok
    const boxA = await StockService.createBox(`BOX-T4-A-${Date.now().toString().slice(-4)}`, 'Box A', user.id);
    const boxB = await StockService.createBox(`BOX-T4-B-${Date.now().toString().slice(-4)}`, 'Box B', user.id);

    // Input item ber-ID ke tipe1
    await StockService.inputStokItemSingle({
      tipe_id: tipe1.id,
      box_id: boxA.id,
      kode_id: `SN-T4-1001-${Date.now()}`,
      user_id: user.id
    });
    await StockService.inputStokItemSingle({
      tipe_id: tipe1.id,
      box_id: boxB.id,
      kode_id: `SN-T4-1002-${Date.now()}`,
      user_id: user.id
    });

    // Input stok jumlah ke tipe2
    await StockService.inputStokJumlah({
      tipe_id: tipe2.id,
      box_id: boxA.id,
      jumlah: 15,
      user_id: user.id
    });

    // 5. Uji Kueri List Produk dengan Total Stok Segala Tipe
    const prods = await CatalogService.listProduk({ jenis_id: testJenis.id });
    const foundFast = prods.find(p => p.id === prodFast.id);

    assert(!!foundFast, 'Produk ditemukan dalam daftar katalog');
    assert(Number(foundFast?.total_stok) === 17, `Total stok produk (2 item ber-ID + 15 stok jumlah) bernilai 17 (actual: ${foundFast?.total_stok})`);

    // 6. Uji Filter Kategori
    const fastOnly = await CatalogService.listProduk({ jenis_id: testJenis.id, kategori: 'fast_moving' });
    assert(fastOnly.length === 1 && fastOnly[0].id === prodFast.id, 'Filter kategori fast_moving hanya mengembalikan produk fast_moving');

    const recycleOnly = await CatalogService.listProduk({ jenis_id: testJenis.id, kategori: 'recycle' });
    assert(recycleOnly.length === 1 && recycleOnly[0].id === prodRecycle.id, 'Filter kategori recycle hanya mengembalikan produk recycle');

    // 7. Uji Filter Search Nama
    const searchRes = await CatalogService.listProduk({ search: 'Router Fast' });
    assert(searchRes.length >= 1 && searchRes.some(p => p.id === prodFast.id), 'Filter pencarian nama produk berhasil');

    // 8. Uji Detail per Tipe (stok_total, sebaran_box, riwayat_terakhir)
    const tipesDetail = await CatalogService.listTipeByProduk(prodFast.id);
    const tipe1Detail = tipesDetail.find(t => t.id === tipe1.id);

    assert(Number(tipe1Detail?.stok_total) === 2, 'Stok total tipe 1 bernilai 2');
    assert(tipe1Detail?.sebaran_box?.length === 2, 'Sebaran box tipe 1 berada di 2 box (BOX A & BOX B)');
    assert((tipe1Detail?.riwayat_terakhir?.length || 0) >= 2, 'Riwayat mutasi terakhir tipe 1 mencatat transaksi input stok');

    // 9. Uji Get Items Breakdown per Tipe
    const itemsBreakdown = await StockService.getItemsByTipe(tipe1.id);
    assert(itemsBreakdown.items.length === 2, 'Rincian item fisik ber-ID tipe 1 mengembalikan 2 unit');
    assert(itemsBreakdown.items[0].kode_id.startsWith('SN-T4-'), 'Kode ID item fisik sesuai');

    console.log(`\n🎉 TAHAP 4 TEST SUITE COMPLETED: ${passed}/${total} TESTS PASSED!`);
  } catch (err: any) {
    console.error('\n❌ TAHAP 4 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runTahap4Tests();
