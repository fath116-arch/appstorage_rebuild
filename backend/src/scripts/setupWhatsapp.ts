/**
 * Setup WhatsApp Notification (Fonnte) Script
 * Jalankan: npm run setup:wa
 */

import { initDatabase } from '../db/database';
import { SystemSetupService } from '../services/systemSetupService';
import { WhatsappAlertService } from '../services/whatsappAlertService';
import { getErrorMessage } from '../utils/errorUtils';
import { loadLocalEnv, parseCliArgs, printBanner, promptSecret, promptText, promptYesNo } from './setupUtils';

async function main() {
  loadLocalEnv();
  const { flags } = parseCliArgs();

  if (flags.help) {
    printBanner('KONFIGURASI NOTIFIKASI WHATSAPP (FONNTE)');
    console.log('Penggunaan:');
    console.log('  npm run setup:wa                  (Mode interaktif)');
    console.log('  npm run setup:wa -- --url https://api.fonnte.com/send --token <TOKEN> --phones 0812xxxx,0813xxxx --enabled true --test\n');
    console.log('Opsi:');
    console.log('  --url <endpoint>      URL Gateway Fonnte (default: https://api.fonnte.com/send)');
    console.log('  --token <api_token>   API Token Fonnte');
    console.log('  --phones <daftar>     Daftar nomor/grup penerima dipisah koma');
    console.log('  --enabled <true|false> Aktifkan notifikasi otomatis (default: true)');
    console.log('  --test                Kirim pesan uji coba langsung setelah menyimpan\n');
    process.exit(0);
  }

  printBanner('KONFIGURASI NOTIFIKASI WHATSAPP', 'Sinkronisasi Gateway Fonnte ke .env & Database');
  await initDatabase();

  const currentEnv = SystemSetupService.getMaskedSettings();
  const currentDbWa = await WhatsappAlertService.getConfig();

  const hasFlags = Boolean(flags.url || flags.token || flags.phones || flags.enabled !== undefined || flags.test);

  const apiUrl = typeof flags.url === 'string'
    ? flags.url
    : hasFlags
    ? (currentDbWa.apiUrl || currentEnv.whatsapp.apiUrl)
    : await promptText('URL Gateway Fonnte', currentDbWa.apiUrl || currentEnv.whatsapp.apiUrl || 'https://api.fonnte.com/send');

  const apiToken = typeof flags.token === 'string'
    ? flags.token
    : hasFlags
    ? ''
    : await promptSecret('Token API Fonnte (WHATSAPP_API_TOKEN)', currentEnv.whatsapp.token.hasValue);

  const defaultPhones = currentDbWa.recipients.length > 0
    ? currentDbWa.recipients.join(',')
    : currentEnv.whatsapp.targetPhones;

  const targetPhones = typeof flags.phones === 'string'
    ? flags.phones
    : hasFlags
    ? defaultPhones
    : await promptText('Nomor / ID Grup Penerima (pisahkan dengan koma)', defaultPhones);

  const isEnabled = flags.enabled !== undefined
    ? String(flags.enabled).toLowerCase() !== 'false'
    : hasFlags
    ? currentDbWa.isEnabled
    : await promptYesNo('Aktifkan pengiriman alert stok menipis otomatis?', currentDbWa.isEnabled);

  const runTest = Boolean(flags.test) || (!hasFlags && await promptYesNo('Kirim pesan uji koneksi WhatsApp sekarang?', false));

  const res = await SystemSetupService.saveAndTestWhatsapp(
    {
      apiUrl,
      apiToken: apiToken || undefined,
      targetPhones,
      isEnabled,
      runTest
    },
    { id: 'cli-setup-wa', name: 'CLI Setup WhatsApp' }
  );

  console.log('\n✅ Konfigurasi WhatsApp berhasil disimpan ke .env & tabel wa_config!');
  console.log(`   URL Gateway  : ${res.config.apiUrl}`);
  console.log(`   Token API    : ${res.config.maskedToken}`);
  console.log(`   Penerima     : ${res.config.recipients.join(', ') || '(belum ada)'}`);
  console.log(`   Status Aktif : ${res.config.isEnabled ? 'AKTIF' : 'NONAKTIF'}`);

  if (res.testResult) {
    console.log(`   Uji Koneksi  : ${res.testResult.success ? '✅ ' : '⚠️ '}${res.testResult.message}`);
  }
  console.log('');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('❌ Gagal menjalankan setup:wa:', getErrorMessage(err));
  process.exit(1);
});
