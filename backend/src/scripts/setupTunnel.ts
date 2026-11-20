/**
 * Setup Cloudflare Tunnel Script
 * Jalankan: npm run setup:tunnel
 */

import { SystemSetupService } from '../services/systemSetupService';
import { getErrorMessage } from '../utils/errorUtils';
import { loadLocalEnv, parseCliArgs, printBanner, promptSecret, promptText, promptYesNo } from './setupUtils';

async function main() {
  loadLocalEnv();
  const { flags } = parseCliArgs();

  if (flags.help) {
    printBanner('KONFIGURASI CLOUDFLARE TUNNEL');
    console.log('Penggunaan:');
    console.log('  npm run setup:tunnel              (Mode interaktif)');
    console.log('  npm run setup:tunnel -- --token <TOKEN> --url https://stok.domain.com\n');
    console.log('Opsi:');
    console.log('  --token <token>   Token Cloudflare Tunnel dari Zero Trust Dashboard');
    console.log('  --url <https://>  URL publik tunnel untuk pengujian jangkauan (opsional)');
    console.log('  --clear           Menghapus CLOUDFLARE_TUNNEL_TOKEN dari berkas .env\n');
    process.exit(0);
  }

  printBanner('KONFIGURASI CLOUDFLARE TUNNEL', 'Akses HTTPS Jarak Jauh Tanpa Buka Port Router');
  const current = SystemSetupService.getMaskedSettings();

  if (flags.clear) {
    await SystemSetupService.saveAndTestTunnel({ clearToken: true });
    console.log('✅ Token CLOUDFLARE_TUNNEL_TOKEN berhasil dihapus dari .env.\n');
    process.exit(0);
  }

  const hasFlags = Boolean(flags.token || flags.url);
  const token = typeof flags.token === 'string'
    ? flags.token
    : hasFlags
    ? ''
    : await promptSecret('Masukkan CLOUDFLARE_TUNNEL_TOKEN', current.tunnel.token.hasValue);

  const publicUrl = typeof flags.url === 'string'
    ? flags.url
    : hasFlags
    ? current.tunnel.publicUrl
    : await promptText('URL Publik Tunnel (opsional, contoh https://stok.kantor.id)', current.tunnel.publicUrl);

  const testPublicUrl = Boolean(publicUrl) && (hasFlags || await promptYesNo('Uji jangkauan endpoint /api/health pada URL publik sekarang?', true));

  const res = await SystemSetupService.saveAndTestTunnel({
    token: token || undefined,
    publicUrl,
    testPublicUrl
  });

  console.log('\nHasil Konfigurasi Cloudflare Tunnel:');
  console.log(`  Status Berkas .env : ${res.saved ? 'Diperbarui' : 'Tidak ada perubahan'}`);
  console.log(`  Validasi Token     : ${res.inspection.validFormat ? '✅ VALID' : '⚠️ ' + res.inspection.reason}`);
  if (res.inspection.tunnelId) {
    console.log(`  Tunnel ID          : ${res.inspection.tunnelId}`);
  }
  if (res.publicUrlProbe) {
    console.log(
      `  Uji URL Publik     : ${
        res.publicUrlProbe.reachable
          ? `✅ TERJANGKAU (${res.publicUrlProbe.url}, ${res.publicUrlProbe.latencyMs} ms)`
          : `⚠️ BELUM TERJANGKAU (${res.publicUrlProbe.error})`
      }`
    );
  }
  console.log(`\nℹ️  Catatan Docker: ${res.dockerHint}\n`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('❌ Gagal menjalankan setup:tunnel:', getErrorMessage(err));
  process.exit(1);
});
