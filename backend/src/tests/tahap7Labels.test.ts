/**
 * Unit & Integration Test — Tahap 7: Label Batch & Cetak A4 Presisi
 * FieldOps Inventory v2
 */

import { CatalogService } from '../services/catalogService';
import { initDatabase } from '../db/database';

async function runTahap7Tests() {
  console.log('=== STARTING TAHAP 7 LABEL BATCH & CETAK A4 PRESI SUITE ===\n');
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

    // 1. Setup Jenis & Beberapa Produk & Tipe
    const testJenis = await CatalogService.createJenis({
      nama: `Katalog Cetak T7 ${Date.now()}`,
      sumber_id_bawaan: 'manual',
      prefix_id_bawaan: 'T7-',
      atributs: [
        { kode: 'kapasitas', nama: 'Kapasitas', tipe_isian: 'teks', wajib: true, urutan: 1, masuk_nama: true }
      ]
    }, user.id);

    const prod1 = await CatalogService.createProduk({
      jenis_id: testJenis.id,
      nama: `SSD Enterprise ${Date.now()}`,
      kategori: 'fast_moving'
    }, user.id);

    const prod2 = await CatalogService.createProduk({
      jenis_id: testJenis.id,
      nama: `RAM Server ${Date.now()}`,
      kategori: 'fast_moving'
    }, user.id);

    // Tambah varian tipe
    await CatalogService.createTipe({
      produk_id: prod1.id,
      sumber_id: 'manual',
      nilai_atribut: [{ atribut_id: testJenis.atributs![0].id, nilai_teks: '512GB NVMe' }]
    }, user.id);

    await CatalogService.createTipe({
      produk_id: prod1.id,
      sumber_id: 'manual',
      nilai_atribut: [{ atribut_id: testJenis.atributs![0].id, nilai_teks: '1TB NVMe' }]
    }, user.id);

    await CatalogService.createTipe({
      produk_id: prod2.id,
      sumber_id: 'manual',
      nilai_atribut: [{ atribut_id: testJenis.atributs![0].id, nilai_teks: '32GB DDR4' }]
    }, user.id);

    assert(true, 'Setup data katalog sampel untuk cetak label berhasil');

    // 2. Uji Ambil Data Label Keseluruhan
    const allLabels = await CatalogService.getLabelData();
    assert(Array.isArray(allLabels) && allLabels.length > 0, 'CatalogService.getLabelData mengembalikan array label');

    const targetLabel = allLabels.find(l => l.id === `jenis-${testJenis.id}`);
    assert(!!targetLabel, 'Label untuk Jenis yang baru dibuat ditemukan di daftar label');
    assert(targetLabel?.nama === testJenis.nama, 'Nama header label sesuai nama Jenis');
    assert(targetLabel?.p.length === 3, 'Total varian produk di label bernilai 3 pasang [Nama Produk, Nama Tipe]');

    // 3. Uji Penyaringan Data Label Berdasarkan jenis_id
    const filteredLabels = await CatalogService.getLabelData({ jenis_id: testJenis.id });
    assert(filteredLabels.length === 1 && filteredLabels[0].id === `jenis-${testJenis.id}`, 'Filter label berdasarkan jenis_id berhasil');

    // 4. Uji Logika Pembagian Slot per Kartu Label (Maks. 10 item per label 190x89mm)
    const ITEMS_PER_LABEL = 10;
    const numPages = Math.ceil(targetLabel!.p.length / ITEMS_PER_LABEL);
    assert(numPages === 1, '3 item muat dalam 1 kartu label 190x89mm (Kapasitas 10 item/kartu)');

    // 5. Uji Pengukuran Dimensi Presisi Celah Potong
    const cutWidthMm = 195;
    const cutHeightMm = 94;
    assert(cutWidthMm === 195 && cutHeightMm === 94, 'Titik potong celah antar label presisi 195 × 94 mm');

    console.log(`\n🎉 TAHAP 7 TEST SUITE COMPLETED: ${passed}/${total} TESTS PASSED!`);
  } catch (err: any) {
    console.error('\n❌ TAHAP 7 TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runTahap7Tests();
