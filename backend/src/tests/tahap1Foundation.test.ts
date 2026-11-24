/**
 * Tahap 1 Foundation & Security Validation Test Suite
 * FieldOps Inventory v2 - Menjamin seluruh kriteria SECURITY_GUIDE.md Bagian 5 lulus
 */

import { initDatabase } from '../db/database';
import { AuthService } from '../services/authService';
import { SessionService } from '../services/sessionService';
import { SettingService } from '../services/settingService';
import { ConfirmationService } from '../services/confirmationService';
import { ActivityLogService } from '../services/activityLogService';
import { TrashService } from '../services/trashService';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  FIELDOPS IT V2 - PENGUJIAN OTOMATIS TAHAP 1 (FONDASI & KEAMANAN)');
  console.log('================================================================\n');

  await initDatabase();

  // Test 1: Format ID Aktivitas (AKT-YYYYMMDD-NNNN)
  console.log('[1] Pengujian ID Aktivitas Mutasi:');
  const idAkt1 = await ActivityLogService.generateActivityId();
  assert(/^AKT-\d{8}-\d{4}$/.test(idAkt1), `Format ID Aktivitas sesuai AKT-YYYYMMDD-NNNN (Dihasilkan: ${idAkt1})`);

  const { idAktivitas } = await ActivityLogService.recordActivity({
    aksi: 'uji_sistem',
    pelaku_id: 'usr-dev-01',
    catatan: 'Pengujian pencatatan log transaksi fondasi v2',
    details: [
      {
        nama_snapshot: 'MikroTik RB750Gr3',
        jumlah: 1,
        status_sebelum: 'tersedia',
        status_sesudah: 'uji'
      }
    ]
  });
  assert(idAktivitas.startsWith('AKT-'), `Pencatatan aktivitas menghasilkan ID mutasi (${idAktivitas})`);

  // Test 2: Pengaturan Dinamis Bebas Hardcode
  console.log('\n[2] Pengujian Pengaturan Dinamis (Tabel pengaturan):');
  const accessTtl = await SettingService.getInt('ACCESS_TOKEN_TTL_DETIK');
  assert(accessTtl === 2592000, `ACCESS_TOKEN_TTL_DETIK terbaca dari konfigurasi: ${accessTtl} detik (30 hari)`);

  const retensiHari = await SettingService.getInt('RETENSI_SAMPAH_HARI');
  assert(retensiHari === 14, `RETENSI_SAMPAH_HARI terbaca dari konfigurasi: ${retensiHari} hari`);

  // Test 3: Sesi Server-Authoritative & Penegakan Kuota MAX_SESI_PER_AKUN
  console.log('\n[3] Pengujian Sesi Server & Pembatasan Kuota (MAX_SESI_PER_AKUN):');
  const userDev = {
    id: 'usr-dev-01',
    username: 'developer',
    name: 'Lead System Developer',
    email: 'developer@fieldops.local',
    role: 'developer' as const,
    department: 'Engineering',
    phone: '0811-0000-1111',
    status: 'ACTIVE'
  };

  // Uji penegakan kuota = 1 secara dinamis lalu kembalikan ke bawaan (50)
  await SettingService.set('MAX_SESI_PER_AKUN', '1');
  try {
    // Login 1 (Komputer)
    const sess1 = await SessionService.createSession(userDev, '192.168.1.10', 'Mozilla/Desktop');
    const checkSess1 = await SessionService.validateSession(sess1.accessToken, sess1.deviceId);
    assert(checkSess1.valid === true, 'Sesi 1 berhasil dibuat dan valid di server');

    // Login 2 (Ponsel) -> Sesi 1 harus otomatis dicabut saat MAX_SESI_PER_AKUN = 1!
    const sess2 = await SessionService.createSession(userDev, '10.0.0.5', 'Mobile/Safari');
    const checkSess1AfterLogin2 = await SessionService.validateSession(sess1.accessToken, sess1.deviceId);
    assert(checkSess1AfterLogin2.valid === false, 'Login kedua berhasil mencabut sesi pertama otomatis (MAX_SESI_PER_AKUN)');

    const checkSess2 = await SessionService.validateSession(sess2.accessToken, sess2.deviceId);
    assert(checkSess2.valid === true, 'Sesi 2 aktif sebagai sesi tunggal pengguna');

    // Test 4: Rotasi Refresh Token & Anti-Replay Detection
    console.log('\n[4] Pengujian Rotasi Refresh Token & Deteksi Penyalinan Token (Anti-Replay):');
    const rotate1 = await SessionService.rotateRefreshToken(sess2.refreshToken, sess2.deviceId, '10.0.0.5', 'Mobile/Safari');
    assert(rotate1.success === true, 'Rotasi refresh token berhasil menghasilkan access token dan refresh token baru');

    // Upaya memakai ulang refresh token lama yang sudah dirotasi -> Harap ditolak!
    const replayAttempt = await SessionService.rotateRefreshToken(sess2.refreshToken, sess2.deviceId, '10.0.0.99', 'HackerTool');
    assert(replayAttempt.success === false, 'Penggunaan ulang refresh token lama ditolak (Anti-Replay aktif)');
  } finally {
    await SettingService.set('MAX_SESI_PER_AKUN', '50');
  }

  // Test 5: Penegakan Konfirmasi Bertingkat (Tier 2 & 3 Server Enforcement)
  console.log('\n[5] Pengujian Konfirmasi Sensitif Bertingkat (Tier 0-3):');
  const tierReqApprove = await ConfirmationService.getActionTier('request_approve');
  assert(tierReqApprove === 2, `request_approve berstatus Tingkat 2 (Ketik "approve")`);

  const tierDeleteProd = await ConfirmationService.getActionTier('delete_product');
  assert(tierDeleteProd === 3, `delete_product berstatus Tingkat 3 (Ketik nama objek + reauth)`);

  // Uji Tier 2 salah ketik
  const reqWrongTier2 = await ConfirmationService.requestConfirmationToken({
    userId: userDev.id,
    actionType: 'request_approve',
    targetId: 'req-101',
    objectNameTyped: 'yes'
  });
  assert(reqWrongTier2.success === false, 'Tier 2 gagal jika teks yang diketik bukan "approve"');

  // Uji Tier 2 benar ketik "approve"
  const reqRightTier2 = await ConfirmationService.requestConfirmationToken({
    userId: userDev.id,
    actionType: 'request_approve',
    targetId: 'req-101',
    objectNameTyped: 'approve'
  });
  assert(reqRightTier2.success === true && !!reqRightTier2.token, 'Tier 2 berhasil menerbitkan token konfirmasi 120s saat ketik "approve"');

  // Uji konsumsi token di server
  const consume1 = await ConfirmationService.consumeConfirmationToken(reqRightTier2.token, userDev.id, 'request_approve', 'req-101');
  assert(consume1.valid === true, 'Token konfirmasi berhasil dikonsumsi di sisi server');

  // Uji token replay (pemakaian kedua)
  const consume2 = await ConfirmationService.consumeConfirmationToken(reqRightTier2.token, userDev.id, 'request_approve', 'req-101');
  assert(consume2.valid === false, 'Pemakaian ulang token konfirmasi yang sudah digunakan ditolak server (Anti-Replay)');

  // Test 6: Tempat Sampah Hapus Permanen (14-Day Retention) & Pemulihan
  console.log('\n[6] Pengujian Sampah Hapus Permanen 14 Hari & Pemulihan:');
  const dummyItemSnapshot = {
    id: `item-test-${Date.now()}`,
    sku: `TEST-SKU-${Date.now()}`,
    name: 'Kabel UTP Cadangan Pengujian',
    category_id: 'cat-cables',
    quantity: 5,
    unit: 'roll',
    location: 'Gudang Uji'
  };

  const { trashId } = await TrashService.moveToTrash({
    jenis_objek: 'item',
    objek_id: dummyItemSnapshot.id,
    snapshot: dummyItemSnapshot,
    dihapus_oleh: userDev.id,
    catatan: 'Pengujian hapus permanen lapis 2'
  });
  assert(trashId.startsWith('trash-'), `Data berhasil dipindahkan ke sampah_hapus (ID: ${trashId})`);

  const trashList = await TrashService.listTrash();
  const foundTrash = trashList.find(t => t.id === trashId);
  assert(!!foundTrash, `Entri sampah ditemukan di daftar tunggu dengan sisa ${foundTrash?.sisa_hari} hari`);

  // Uji Dry-Run Pemulihan
  const dryRunRestore = await TrashService.restoreTrash(trashId, true);
  assert(dryRunRestore.success === true, 'Uji coba pemulihan (Dry-Run) berhasil tanpa konflik data');

  // Uji Pemulihan Penuh
  const fullRestore = await TrashService.restoreTrash(trashId, false);
  assert(fullRestore.success === true, 'Pemulihan data utuh ke sistem aktif berhasil via TrashService');

  // Selesai
  console.log('\n================================================================');
  if (testsFailed === 0) {
    console.log(`🎉 SELURUH PENGUJIAN TAHAP 1 LULUS 100%! (${testsPassed} tes sukses)`);
  } else {
    console.error(`⚠️ PENGUJIAN SELESAI DENGAN ${testsFailed} KEGAGALAN (${testsPassed} sukses)`);
  }
  console.log('================================================================\n');

  process.exit(testsFailed === 0 ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
