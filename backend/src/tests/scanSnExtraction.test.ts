import { extractSNByRule } from '../../../frontend/src/utils/scannerUtils.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const ZTE_GPON_REGEX = '^ZTEGD[0-9A-Fa-f]{7}$';

console.log('================================================================');
console.log(' RUNNING UNIT TESTS: SCAN_SN Strict Extraction (extractSNByRule)');
console.log('================================================================\n');

test('1. "ZTEGD1234567" lolos validasi regex ketat ZTE GPON', () => {
  const res = extractSNByRule('ZTEGD1234567', ZTE_GPON_REGEX);
  assertEqual(res, 'ZTEGD1234567');
});

test('2. "ZTEGD1234567 AABBCCDDEEFF" mengekstrak token SN GPON saja tanpa MAC', () => {
  const res = extractSNByRule('ZTEGD1234567 AABBCCDDEEFF', ZTE_GPON_REGEX);
  assertEqual(res, 'ZTEGD1234567');
});

test('3. "AABBCCDDEEFF" saja -> null (dengan regex maupun regex kosong)', () => {
  assertEqual(extractSNByRule('AABBCCDDEEFF', ZTE_GPON_REGEX), null, 'Dengan regex');
  assertEqual(extractSNByRule('AABBCCDDEEFF', ''), null, 'Regex kosong (12 hex MAC dibuang)');
  assertEqual(extractSNByRule('AA:BB:CC:DD:EE:FF', ''), null, 'Regex kosong (XX:XX:XX:XX:XX:XX MAC dibuang)');
});

test('4. D-SN saja -> null (dengan regex maupun regex kosong)', () => {
  assertEqual(extractSNByRule('D-SN123456', ZTE_GPON_REGEX), null, 'D-SN dengan regex');
  assertEqual(extractSNByRule('D-SN: 12345678', ZTE_GPON_REGEX), null, 'D-SN berprefix dengan regex');
  assertEqual(extractSNByRule('D-SN123456', ''), null, 'D-SN saat regex kosong');
  assertEqual(extractSNByRule('D-SN: 12345678', ''), null, 'D-SN berprefix saat regex kosong');
});

test('5. Huruf kecil "ztegd1234567" cocok dan dinormalisasi ke "ZTEGD1234567"', () => {
  const res = extractSNByRule('ztegd1234567', ZTE_GPON_REGEX);
  assertEqual(res, 'ZTEGD1234567');
});

test('6. Kandidat array terpisah (multi-barcode & newline) mengambil SN valid pertama', () => {
  const res = extractSNByRule(['AA:BB:CC:DD:EE:FF', 'D-SN: 99887766', 'SN: ztegd1a2b3c4'], ZTE_GPON_REGEX);
  assertEqual(res, 'ZTEGD1A2B3C4');
});

console.log('\n================================================================');
const passedCount = results.filter((r) => r.passed).length;
const failedCount = results.filter((r) => !r.passed).length;
console.log(` HASIL UNIT TEST SCAN_SN: ${passedCount}/${results.length} PASS (${failedCount} GAGAL)`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
