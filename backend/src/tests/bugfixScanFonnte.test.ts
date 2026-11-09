import { extractSNFromBarcode, diagnoseCameraError } from '../../../frontend/src/utils/scannerUtils.js';
import { 
  convertSimplePatternToRegex, 
  generateSimplePatternFromSample, 
  validatePatternMatch, 
  normalizeSNString, 
  DEFAULT_SN_PATTERNS 
} from '../../../frontend/src/utils/snPatternUtils.js';
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

async function runTestSuite() {
  console.log('================================================================');
  console.log(' RUNNING TESTS: FieldOps Bugfix Scan Kamera, Pola SN & Fonnte');
  console.log('================================================================\n');

  await initDatabase();

  // ----------------------------------------------------------------
  // BUG 1 & UPDATE 1: Scan Kamera Barcode 1D SN vs Filter MAC / PIN
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
  // UPDATE 2: Pola SN Sederhana (#, A, ?, *), Generator & Validasi
  // ----------------------------------------------------------------
  await test('UPDATE 2: convertSimplePatternToRegex mengubah format #, A, ?, * menjadi regex presisi', () => {
    const reg1 = convertSimplePatternToRegex('#############');
    if (reg1 !== '^[0-9]{13}$') {
      throw new Error(`Hasil konversi 13 digit angka gagal: ${reg1}`);
    }

    const reg2 = convertSimplePatternToRegex('FHTT########');
    if (reg2 !== '^FHTT[0-9]{8}$') {
      throw new Error(`Hasil konversi FiberHome gagal: ${reg2}`);
    }

    const reg3 = convertSimplePatternToRegex('AA##-AA##');
    if (reg3 !== '^[A-Z]{2}[0-9]{2}\\-[A-Z]{2}[0-9]{2}$') {
      throw new Error(`Hasil konversi AA##-AA## gagal: ${reg3}`);
    }
  });

  await test('UPDATE 2: generateSimplePatternFromSample menghasilkan pola otomatis dari contoh SN', () => {
    const pat1 = generateSimplePatternFromSample('3213067005147');
    if (pat1 !== '#############') {
      throw new Error(`Generator pola TP-Link gagal: ${pat1}`);
    }

    const pat2 = generateSimplePatternFromSample('TP12-AB34');
    if (pat2 !== 'AA##-AA##') {
      throw new Error(`Generator pola TP12-AB34 gagal: ${pat2}`);
    }
  });

  await test('UPDATE 2: validatePatternMatch memvalidasi kesesuaian contoh SN dengan polanya', () => {
    const isOk1 = validatePatternMatch('3213067005147', '^[0-9]{13}$');
    if (!isOk1) throw new Error('Validasi TP-Link 13 digit angka gagal');

    const isOk2 = validatePatternMatch('321306700514', '^[0-9]{13}$');
    if (isOk2) throw new Error('Validasi SN tidak cocok seharusnya ditolak');
  });

  await test('UPDATE 2: extractSNFromBarcode mencocokkan barcode dengan pola SN aktif (TP-Link 13 Digit)', () => {
    const res = extractSNFromBarcode('3213067005147', DEFAULT_SN_PATTERNS);
    if (!res.isSN || res.cleanValue !== '3213067005147') {
      throw new Error(`Pencocokan pola SN TP-Link gagal: ${JSON.stringify(res)}`);
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
    await WhatsappAlertService.updateConfig({
      apiToken: 'my_fonnte_secret_999'
    }, testOpDev);

    await WhatsappAlertService.updateConfig({
      recipients: ['081299990000', '12036300000@g.us']
    }, { id: 'usr-wh', name: 'Siti Admin Gudang' });

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
