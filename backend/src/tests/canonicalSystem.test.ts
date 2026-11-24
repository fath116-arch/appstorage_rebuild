/**
 * Canonical Single-Model & Accountability Verification Suite
 * FieldOps IT — Covers:
 *  1. WIB weekly boundaries & 00:00–06:59 WIB boundary mapping
 *  2. on_behalf RBAC & mandatory reason enforcement
 *  3. occurred_at validation (no future, 7d warehouse_admin limit, unlimited admin/dev)
 *  4. Output guards (Rusak, Dipesan without requestId, valid active item)
 *  5. Immutable ledger correction entry (correction_of_id)
 *  6. Catalog -> Input -> Multi-item Output Cart -> Weekly Feed consistency
 */

import { initDatabase } from '../db/database';
import { CatalogService } from '../services/catalogService';
import { StockService } from '../services/stockService';
import { ActivityLogService } from '../services/activityLogService';
import { RequestService } from '../services/requestService';
import {
  getWibDateKey,
  getWibWeekRange,
  validateOccurredAt
} from '../utils/timezone';

async function runCanonicalTests() {
  console.log('================================================================');
  console.log('  FIELDOPS IT - PENGUJIAN KANONIK TUNGGAL (WIB, RBAC, LEDGER)');
  console.log('================================================================\n');

  await initDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${label}`);
      failed++;
    }
  }

  try {
    // --------------------------------------------------------------------------
    // 1. WIB Weekly Bounds & Midnight (00:00-06:59 WIB) Mapping
    // --------------------------------------------------------------------------
    console.log('[1] Batas Minggu WIB (Senin 00:00 WIB - Minggu 23:59:59.999 WIB):');

    // Monday 00:30 WIB on 2027-01-04 = 2027-01-03T17:30:00.000Z (previous UTC day!)
    const mondayEarlyWib = new Date('2027-01-03T17:30:00.000Z');
    assert(getWibDateKey(mondayEarlyWib) === '2027-01-04', '00:30 WIB pada Senin pagi tetap terpetakan ke tanggal WIB hari Senin (2027-01-04)');

    const weekMondayEarly = getWibWeekRange(0, mondayEarlyWib);
    assert(
      weekMondayEarly.startDateWib === '2027-01-04' &&
      weekMondayEarly.endDateWib === '2027-01-10' &&
      weekMondayEarly.startUtcIso === '2027-01-03T17:00:00.000Z',
      'Senin 00:30 WIB masuk minggu 2027-01-04..2027-01-10 dengan startUtc = Minggu 17:00 UTC'
    );

    // Sunday 23:30 WIB on 2027-01-10 = 2027-01-10T16:30:00.000Z
    const sundayLateWib = new Date('2027-01-10T16:30:00.000Z');
    assert(getWibDateKey(sundayLateWib) === '2027-01-10', '23:30 WIB pada Minggu malam masuk tanggal WIB 2027-01-10');
    const weekSundayLate = getWibWeekRange(0, sundayLateWib);
    assert(
      weekSundayLate.startDateWib === '2027-01-04' && weekSundayLate.endDateWib === '2027-01-10',
      'Minggu 23:30 WIB tetap berada di minggu yang sama dengan Senin 00:30 WIB'
    );

    // Month/year crossover check: Friday 2027-01-01 00:30 WIB = 2026-12-31T17:30:00.000Z
    const newYearWib = new Date('2026-12-31T17:30:00.000Z');
    assert(getWibDateKey(newYearWib) === '2027-01-01', 'Pergantian tahun UTC 31 Des 17:30 = 1 Jan 00:30 WIB');
    const crossYearWeek = getWibWeekRange(0, newYearWib);
    assert(
      crossYearWeek.startDateWib === '2026-12-28' && crossYearWeek.endDateWib === '2027-01-03',
      'Minggu lintas tahun 2026-2027 dihitung tepat (28 Des 2026 - 3 Jan 2027 WIB)'
    );

    // --------------------------------------------------------------------------
    // 2. occurred_at Validation
    // --------------------------------------------------------------------------
    console.log('\n[2] Validasi Waktu Kejadian (occurred_at):');
    const nowRef = new Date('2027-03-15T10:00:00.000Z');
    const futureCheck = validateOccurredAt({
      occurredAt: new Date(nowRef.getTime() + 10 * 60 * 1000).toISOString(),
      role: 'admin',
      now: nowRef
    });
    assert(futureCheck.valid === false, 'Waktu kejadian di masa depan ditolak untuk seluruh peran');

    const tenDaysAgo = new Date(nowRef.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const techBackdate = validateOccurredAt({ occurredAt: tenDaysAgo, role: 'technician', now: nowRef });
    assert(techBackdate.valid === false, 'Backdate > 7 hari ditolak untuk technician');

    const whBackdate = validateOccurredAt({ occurredAt: tenDaysAgo, role: 'warehouse_admin', now: nowRef });
    assert(whBackdate.valid === true && whBackdate.isBackdated === true, 'Alias legacy warehouse_admin dinormalisasi ke admin dan diizinkan backdate > 7 hari');

    const adminBackdate = validateOccurredAt({ occurredAt: tenDaysAgo, role: 'admin', now: nowRef });
    assert(adminBackdate.valid === true && adminBackdate.isBackdated === true, 'Backdate > 7 hari diizinkan untuk admin');

    const devBackdate = validateOccurredAt({ occurredAt: tenDaysAgo, role: 'developer', now: nowRef });
    assert(devBackdate.valid === true && devBackdate.isBackdated === true, 'Backdate > 7 hari diizinkan untuk developer');

    // --------------------------------------------------------------------------
    // 3. on_behalf RBAC & Mandatory Reason
    // --------------------------------------------------------------------------
    console.log('\n[3] Validasi Akuntabilitas on_behalf:');
    let techOnBehalfErr = false;
    try {
      await ActivityLogService.recordActivity({
        aksi: 'buat_request',
        pelaku_id: 'usr-tek-demo',
        actor_id: 'usr-admin-demo',
        recorded_by_id: 'usr-tek-demo',
        recorded_by_role: 'technician',
        on_behalf_reason: 'Coba atas nama orang lain',
        catatan: 'Harus ditolak'
      });
    } catch {
      techOnBehalfErr = true;
    }
    assert(techOnBehalfErr, 'Teknisi ditolak saat mencoba mencatat atas nama pengguna lain');

    let missingReasonErr = false;
    try {
      await ActivityLogService.recordActivity({
        aksi: 'buat_request',
        pelaku_id: 'usr-tek-demo',
        actor_id: 'usr-tek-demo',
        recorded_by_id: 'usr-wh-demo',
        recorded_by_role: 'warehouse_admin',
        on_behalf_reason: 'ok', // < 3 karakter
        catatan: 'Harus ditolak'
      });
    } catch {
      missingReasonErr = true;
    }
    assert(missingReasonErr, 'Pengelola tanpa on_behalf_reason (>= 3 karakter) ditolak');

    const validOnBehalf = await ActivityLogService.recordActivity({
      aksi: 'sistem_log',
      pelaku_id: 'usr-tek-demo',
      actor_id: 'usr-tek-demo',
      recorded_by_id: 'usr-wh-demo',
      recorded_by_role: 'warehouse_admin',
      on_behalf_reason: 'Teknisi tidak membawa perangkat saat serah terima',
      catatan: 'Validasi pencatatan atas nama'
    });
    const feedOnBehalf = await ActivityLogService.getTransactionsFeed({ limit: 50 });
    const matchedBehalf = feedOnBehalf.find(t => t.id === validOnBehalf.transaksiId);
    assert(
      !!matchedBehalf && matchedBehalf.is_on_behalf === true && matchedBehalf.actor_id === 'usr-tek-demo' && matchedBehalf.recorded_by_id === 'usr-wh-demo',
      'Pengelola dengan alasan valid berhasil mencatat is_on_behalf = true beserta actor & recorded_by terpisah'
    );

    // --------------------------------------------------------------------------
    // 4. Canonical Catalog -> Input -> Output Cart Guards -> Weekly Feed -> Correction
    // --------------------------------------------------------------------------
    console.log('\n[4] Alur Tunggal Katalog -> Input -> Guard Output -> Koreksi Audit:');
    const suffix = Date.now().toString().slice(-5);
    const jenis = await CatalogService.createJenis({
      nama: `Jenis Kanonik ${suffix}`,
      sumber_id_bawaan: 'scan_sn',
      prefix_id_bawaan: 'ONT',
      atributs: [{ kode: 'port', nama: 'Port', tipe_isian: 'teks', wajib: true, urutan: 1, masuk_nama: true }]
    }, 'usr-admin-demo');

    const produk = await CatalogService.createProduk({
      jenis_id: jenis.id,
      nama: `ONT Dualband ${suffix}`,
      kategori: 'fast_moving',
      kategori_barang: 'Alat',
      tipe_stok: 'unit'
    }, 'usr-admin-demo');

    const tipe = await CatalogService.createTipe({
      produk_id: produk.id,
      sumber_id: 'scan_sn',
      pola_id: '^ZTEGD[0-9A-F]{7}$',
      nilai_atribut: [{ atribut_id: jenis.atributs![0].id, nilai_teks: '4P' }]
    }, 'usr-admin-demo');

    const box = await StockService.createBox(`BOX-CAN-${suffix}`, 'Rak Kanonik', 'usr-admin-demo');
    const snGood = `ZTEGD${suffix}12`;
    const snDamaged = `ZTEGD${suffix}34`;
    const snReserved = `ZTEGD${suffix}56`;

    await StockService.inputStokItemBulk({
      tipe_id: tipe.id,
      box_id: box.id,
      kode_ids: [snGood, snDamaged, snReserved],
      user_id: 'usr-admin-demo',
      catatan: 'Stok masuk awal uji kanonik'
    });

    // Tandai 1 item sebagai Rusak via SQL (kompatibel MariaDB & memory adapter)
    const dupDamaged = await StockService.checkDuplicateKodeId(snDamaged);
    const { executeQuery } = await import('../db/database');
    await executeQuery('UPDATE item SET kondisi = ?, catatan_kondisi = ? WHERE id = ?', ['Rusak', 'Unit uji rusak', dupDamaged.item!.id]);

    // Guard Output 1: Item Rusak ditolak
    let rusakBlocked = false;
    try {
      await StockService.barangKeluarSingle({
        kodeId: snDamaged,
        userId: 'usr-wh-demo',
        recordedById: 'usr-wh-demo',
        recordedByRole: 'warehouse_admin'
      });
    } catch {
      rusakBlocked = true;
    }
    assert(rusakBlocked, 'Barang Keluar menolak item berkondisi Rusak');

    // Guard Output 2: Item Dipesan tanpa requestId ditolak
    const reqRes = await RequestService.createRequest({
      pemohonId: 'usr-tek-demo',
      tipeId: tipe.id,
      kodeId: snReserved,
      alasan: 'Pasang baru pelanggan'
    });
    await RequestService.approveRequest({ requestId: reqRes.id, penyetujuId: 'usr-wh-demo' });

    let dipesanBlocked = false;
    try {
      await StockService.barangKeluarSingle({
        kodeId: snReserved,
        userId: 'usr-wh-demo',
        recordedById: 'usr-wh-demo',
        recordedByRole: 'warehouse_admin'
      });
    } catch {
      dipesanBlocked = true;
    }
    assert(dipesanBlocked, 'Barang Keluar menolak item berstatus dipesan tanpa request_id yang cocok');

    // Valid Output via Cart + On-behalf + Weekly Feed check
    const bulkOut = await StockService.barangKeluarBulk({
      items: [{ kodeId: snGood }],
      userId: 'usr-wh-demo',
      actorId: 'usr-tek-demo',
      recordedById: 'usr-wh-demo',
      recordedByRole: 'warehouse_admin',
      onBehalfReason: 'Pengambilan cepat teknisi di loket gudang',
      recipientDestination: 'Pelanggan Blok M',
      catatan: 'Keluar via keranjang kanonik'
    });
    assert(bulkOut.success === true, 'Barang Keluar Keranjang atas nama teknisi berhasil');

    const itemAfterOut = await StockService.checkDuplicateKodeId(snGood);
    assert(itemAfterOut.item?.status === 'keluar', 'Item aktif berubah status menjadi keluar setelah transaksi OUT');

    // Append-Only Audit Correction
    const corrRes = await ActivityLogService.createCorrectionEntry({
      targetTransactionId: bulkOut.transaksiId,
      recordedById: 'usr-admin-demo',
      recordedByName: 'Admin Utama',
      recordedByRole: 'admin',
      alasanKoreksi: 'Pelanggan sebenarnya Blok N bukan Blok M'
    });

    const feedAfter = await ActivityLogService.getTransactionsFeed({ limit: 50 });
    const origEntry = feedAfter.find(t => t.id === bulkOut.transaksiId);
    const corrEntry = feedAfter.find(t => t.id === corrRes.transaksiId);
    assert(
      !!origEntry && origEntry.recipient_destination === 'Pelanggan Blok M' && !!corrEntry && corrEntry.correction_of_id === bulkOut.transaksiId,
      'Koreksi audit bersifat append-only (catatan asli utuh, entri baru merujuk correction_of_id)'
    );

    const weekNow = getWibWeekRange(0, new Date());
    const weeklyFeed = await ActivityLogService.getTransactionsFeed({
      dateFrom: weekNow.startUtcIso,
      dateTo: weekNow.endUtcIso,
      limit: 200
    });
    assert(
      weeklyFeed.some(t => t.id === bulkOut.transaksiId),
      'Transaksi keluar baru langsung muncul di feed Laporan Mingguan WIB tanpa refresh'
    );

  } catch (err: any) {
    console.error('Fatal error in canonicalSystem.test.ts:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`  HASIL TEST KANONIK: ${passed} LULUS, ${failed} GAGAL`);
  console.log('================================================================\n');
  process.exit(failed === 0 ? 0 : 1);
}

runCanonicalTests();
