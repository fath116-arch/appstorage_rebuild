import { extractSNFromBarcode, diagnoseCameraError } from '../../../frontend/src/utils/scannerUtils.js';
import { WhatsappAlertService } from '../services/whatsappAlertService';
import { initDatabase } from '../db/database';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
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

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' RUNNING TESTS: FieldOps Bugfix Scan Kamera & Role Fonnte Token');
  console.log('================================================================\n');

  await initDatabase();

  // ----------------------------------------------------------------
  // BUG 1: Scan Kamera Barcode 1D SN vs Filter MAC / PIN
  // ----------------------------------------------------------------
  await test('BUG 1: extractSNFromBarcode mengekstrak SN bersih dari label router (S/N: 220C123456789)', () => {
    const res = extractSNFromBarcode('S/N: 220C123456789');
    if (!res.isSN || res.cleanValue !== '220C123456789' || res.rawType !== 'SN') {
      throw new Error(`Ekstraksi SN gagal: ${JSON.stringify(res)}`);
    }
  });

  await test('BUG 1: extractSNFromBarcode mengekstrak SN ber-prefix SERIAL: TP20261108001', () => {
    const res = extractSNFromBarcode('SERIAL: TP20261108001');
    if (!res.isSN || res.cleanValue !== 'TP20261108001') {
      throw new Error(`Ekstraksi SERIAL gagal: ${JSON.stringify(res)}`);
    }
  });

  await test('BUG 1: extractSNFromBarcode mengabaikan barcode MAC Address (MAC: FC-EC-DA-11-22-33)', () => {
    const res = extractSNFromBarcode('MAC: FC-EC-DA-11-22-33');
    if (res.isSN || res.rawType !== 'MAC') {
      throw new Error(`Penyaringan MAC gagal: ${JSON.stringify(res)}`);
    }
  });

  await test('BUG 1: extractSNFromBarcode mengabaikan barcode PIN Wireless (PIN: 12345678)', () => {
    const res = extractSNFromBarcode('PIN: 12345678');
    if (res.isSN || res.rawType !== 'PIN') {
      throw new Error(`Penyaringan PIN gagal: ${JSON.stringify(res)}`);
    }
  });

  await test('BUG 1: diagnoseCameraError memberikan diagnosa error camera/HTTPS yang presisi', () => {
    const deniedDiag = diagnoseCameraError({ name: 'NotAllowedError' });
    if (deniedDiag.type !== 'denied' || !deniedDiag.message.includes('ditolak')) {
      throw new Error('Diagnosa NotAllowedError gagal');
    }

    const notFoundDiag = diagnoseCameraError({ name: 'NotFoundError' });
    if (notFoundDiag.type !== 'not_found' || !notFoundDiag.message.includes('tidak ditemukan')) {
      throw new Error('Diagnosa NotFoundError gagal');
    }
  });

  // ----------------------------------------------------------------
  // BUG 2: Proteksi Token Fonnte & Hak Akses Admin Gudang vs Admin/Dev
  // ----------------------------------------------------------------
  const testOpDev = { id: 'usr-dev', name: 'Developer Test' };

  await test('BUG 2: Fonnte API Token tidak bocor dalam bentuk mentah pada getConfig()', async () => {
    await WhatsappAlertService.updateConfig({
      apiToken: 'super_secret_fonnte_token_12345678'
    }, testOpDev);

    const cfg = await WhatsappAlertService.getConfig();
    if (cfg.apiToken === 'super_secret_fonnte_token_12345678') {
      throw new Error('getConfig() mengembalikan token mentah yang berisiko terkespos.');
    }
    if (!cfg.maskedToken || !cfg.maskedToken.includes('••••••••')) {
      throw new Error('maskedToken tidak sesuai format tersamar.');
    }
  });

  await test('BUG 2: Admin Gudang dapat mengubah penerima notifikasi tanpa menghapus/merusak token Fonnte di DB', async () => {
    // 1. Admin/Developer set token Fonnte
    await WhatsappAlertService.updateConfig({
      apiToken: 'my_fonnte_secret_999'
    }, testOpDev);

    // 2. Admin Gudang ubah penerima (tanpa mengirim apiToken)
    await WhatsappAlertService.updateConfig({
      recipients: ['081299990000', '12036300000@g.us']
    }, { id: 'usr-wh', name: 'Siti Admin Gudang' });

    // 3. Verifikasi token Fonnte tetap tersimpan aman di server (maskedToken tidak menjadi 'Belum diisi')
    const cfg = await WhatsappAlertService.getConfig();
    if (!cfg.maskedToken || cfg.maskedToken === 'Belum diisi') {
      throw new Error(`Token Fonnte terhapus atau berubah: ${cfg.maskedToken}`);
    }
    if (cfg.recipients.length !== 2) {
      throw new Error('Daftar penerima gagal diperbarui oleh Admin Gudang.');
    }
  });

  console.log('\n================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(` HASIL PENGUJIAN BUGFIX SCAN & FONNTE: ${passedCount}/${results.length} PASS (${failedCount} GAGAL)`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
