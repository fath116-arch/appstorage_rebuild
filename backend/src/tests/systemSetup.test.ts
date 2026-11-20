/**
 * Test Suite: SystemSetupService, CLI Catalog, Secret Masking, Tunnel Validation, & RBAC
 */

import fs from 'fs';
import path from 'path';
import { initDatabase } from '../db/database';
import {
  SystemSetupService,
  inspectCloudflareTunnelToken,
  maskSecret
} from '../services/systemSetupService';
import { isAdminOrDev, isWarehouseManager } from '../utils/permissions';

async function runTests() {
  console.log('================================================================');
  console.log('  PENGUJIAN SYSTEM SETUP SERVICE, MASKING, TUNNEL, & RBAC');
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

  // 1. Secret masking checks
  assert(maskSecret('').hasValue === false, 'Empty secret returns hasValue=false');
  assert(maskSecret('short').masked === '••••••', 'Short secret is fully masked');
  const maskedLong = maskSecret('my_super_secret_token_value_123');
  assert(
    maskedLong.hasValue &&
      maskedLong.masked.startsWith('my_') &&
      maskedLong.masked.endsWith('123') &&
      !maskedLong.masked.includes('super_secret'),
    'Long secret exposes only 3-char prefix/suffix and hides body'
  );

  // 2. Cloudflare Tunnel token inspection
  assert(!inspectCloudflareTunnelToken('').configured, 'Blank tunnel token reports unconfigured');
  assert(!inspectCloudflareTunnelToken('too short').validFormat, 'Short/spaced tunnel token is rejected');

  const sampleJsonToken = Buffer.from(
    JSON.stringify({
      a: 'acct1234567890abcdef',
      t: '9b6e0d2e-1234-4abc-8def-1234567890ab',
      s: 'secret'
    })
  ).toString('base64');
  const parsedTunnel = inspectCloudflareTunnelToken(sampleJsonToken);
  assert(
    parsedTunnel.validFormat &&
      parsedTunnel.tunnelId === '9b6e0d2e-1234-4abc-8def-1234567890ab' &&
      parsedTunnel.accountTagPreview === 'acct12••••',
    'Valid Cloudflare Zero Trust JSON base64 token decodes Tunnel ID cleanly'
  );

  const sampleJwtToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0dW5uZWwiOiJkZW1vIn0.signatureTokenValueHere123456';
  assert(
    inspectCloudflareTunnelToken(sampleJwtToken).validFormat,
    'Valid JWT-shaped tunnel token passes format check'
  );

  // 3. CLI script catalog completeness
  const catalog = SystemSetupService.getCliScriptCatalog();
  const commands = new Set(catalog.map((c) => c.command));
  assert(commands.has('npm run setup:help'), 'Catalog includes setup:help');
  assert(commands.has('npm run setup:admin'), 'Catalog includes setup:admin');
  assert(commands.has('npm run setup:db'), 'Catalog includes setup:db');
  assert(commands.has('npm run setup:tunnel'), 'Catalog includes setup:tunnel');
  assert(commands.has('npm run setup:wa'), 'Catalog includes setup:wa');
  assert(commands.has('npm run setup:check'), 'Catalog includes setup:check');
  assert(commands.has('npm run sampah'), 'Catalog includes sampah');
  assert(commands.has('npm run test:backup'), 'Catalog includes test:backup');

  // 4. Masked settings & runSystemCheck never return raw secret strings
  const maskedSettings = SystemSetupService.getMaskedSettings();
  assert(typeof maskedSettings.database.host === 'string', 'Masked settings exposes DB host');
  assert(typeof maskedSettings.whatsapp.apiUrl === 'string', 'Masked settings exposes WA API URL');
  assert('masked' in maskedSettings.database.password, 'DB password is wrapped as MaskedSecretInfo');
  assert('masked' in maskedSettings.tunnel.token, 'Tunnel token is wrapped as MaskedSecretInfo');

  const checkReport = await SystemSetupService.runSystemCheck();
  assert(Array.isArray(checkReport.checks) && checkReport.checks.length === 5, 'System check returns 5 diagnostic items');
  assert(
    checkReport.checks.every((c) => ['connected', 'warning', 'unconfigured'].includes(c.status)),
    'Every diagnostic check uses valid status enum'
  );

  // 5. Security: anti-CRLF / invalid key guard on upsertEnvVars (without touching .env on disk!)
  const envExistedBefore = fs.existsSync(SystemSetupService.getEnvFilePath());
  let invalidKeyRejected = false;
  try {
    SystemSetupService.upsertEnvVars({ 'bad-key': '123' });
  } catch {
    invalidKeyRejected = true;
  }
  assert(invalidKeyRejected, 'upsertEnvVars rejects invalid key names');

  // Only test CRLF rejection if .env already exists OR test cleanly and unlink if created
  const envFile = SystemSetupService.getEnvFilePath();
  const prevContent = envExistedBefore ? fs.readFileSync(envFile, 'utf-8') : null;
  let crlfRejected = false;
  try {
    SystemSetupService.upsertEnvVars({ CLOUDFLARE_PUBLIC_URL: 'https://test.local\nEVIL_KEY=1' });
  } catch {
    crlfRejected = true;
  }
  if (!envExistedBefore && fs.existsSync(envFile)) {
    fs.unlinkSync(envFile);
  } else if (envExistedBefore && prevContent !== null) {
    fs.writeFileSync(envFile, prevContent, 'utf-8');
  }
  assert(crlfRejected, 'upsertEnvVars rejects CRLF newline injection');

  // 6. RBAC alignment for Setting tab split
  assert(isAdminOrDev('developer') && isAdminOrDev('admin'), 'Developer & Admin pass isAdminOrDev');
  assert(!isAdminOrDev('warehouse_admin') && !isAdminOrDev('technician'), 'Warehouse Admin & Technician do not pass isAdminOrDev');
  assert(isWarehouseManager('warehouse_admin'), 'Warehouse Admin passes isWarehouseManager (Setting selective + SN Patterns)');
  assert(!isWarehouseManager('technician'), 'Technician is blocked from isWarehouseManager');

  // 7. Documentation existence check
  const skripDocPath = path.resolve(process.cwd(), 'docs/SKRIP_CLI.md');
  assert(fs.existsSync(skripDocPath), 'docs/SKRIP_CLI.md documentation file exists');

  console.log(`\nHasil: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal error in systemSetup.test.ts:', err);
  process.exit(1);
});
