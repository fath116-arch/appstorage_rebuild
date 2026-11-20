/**
 * System Setup & Diagnostics Service
 * FieldOps IT Inventory
 * - Safe .env read/mask/upsert (Anti-CRLF injection, preserves comments & unrelated keys)
 * - Live MariaDB connection probe & runtime pool reload
 * - Cloudflare Tunnel token structural validation & optional public URL health probe
 * - WhatsApp Fonnte .env + DB wa_config synchronization
 * - Unified system health diagnostics for CLI (setup:check) & Web Settings Hub
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  PROJECT_ROOT_DIR,
  executeQuery,
  getDbRuntimeStatus,
  reloadDatabasePool,
  testMariaDbConnection,
  type DbConnectionTestResult
} from '../db/database';
import { WhatsappAlertService } from './whatsappAlertService';
import { getErrorMessage } from '../utils/errorUtils';

export interface MaskedSecretInfo {
  hasValue: boolean;
  masked: string;
  length: number;
}

export interface TunnelTokenInspection {
  configured: boolean;
  validFormat: boolean;
  tunnelId?: string;
  accountTagPreview?: string;
  reason: string;
}

export interface SystemMaskedSettings {
  envFileExists: boolean;
  envPathRelative: string;
  app: {
    port: string;
    nodeEnv: string;
    appTitle: string;
    secretKey: MaskedSecretInfo;
    secretKeyStrong: boolean;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: MaskedSecretInfo;
    rootPassword: MaskedSecretInfo;
    runtimeActiveMariaDb: boolean;
  };
  tunnel: {
    token: MaskedSecretInfo;
    inspection: TunnelTokenInspection;
    publicUrl: string;
  };
  whatsapp: {
    apiUrl: string;
    token: MaskedSecretInfo;
    autoAlert: boolean;
    targetPhones: string;
  };
}

export type CheckStatusLevel = 'connected' | 'warning' | 'unconfigured';

export interface SystemDiagnosticItem {
  key: 'env' | 'database' | 'whatsapp' | 'tunnel' | 'admin';
  label: string;
  status: CheckStatusLevel;
  summary: string;
  details: string;
  hint?: string;
  cliCommand?: string;
  latencyMs?: number;
}

export interface CliScriptEntry {
  command: string;
  category: 'setup' | 'maintenance' | 'runtime';
  summary: string;
  flags?: string;
}

export interface SystemCheckReport {
  overallStatus: 'ready' | 'partial' | 'incomplete';
  checkedAt: string;
  checks: SystemDiagnosticItem[];
  databaseProbe: DbConnectionTestResult;
  tunnelInspection: TunnelTokenInspection;
  publicUrlProbe?: {
    url: string;
    reachable: boolean;
    statusCode?: number;
    latencyMs?: number;
    error?: string;
  };
}

export interface DatabaseUpdateInput {
  host?: string;
  port?: number | string;
  name?: string;
  user?: string;
  password?: string;
  rootPassword?: string;
  reloadPool?: boolean;
}

export interface TunnelUpdateInput {
  token?: string;
  publicUrl?: string;
  clearToken?: boolean;
  testPublicUrl?: boolean;
}

export interface WhatsappEnvSetupInput {
  apiUrl?: string;
  apiToken?: string;
  targetPhones?: string[] | string;
  isEnabled?: boolean;
  cooldownMinutes?: number;
  runTest?: boolean;
}

const ENV_FILE_PATH = path.resolve(PROJECT_ROOT_DIR, '.env');
const ENV_EXAMPLE_PATH = path.resolve(PROJECT_ROOT_DIR, '.env.example');

function sanitizeEnvScalar(raw: string): string {
  if (/[\r\n\0]/.test(raw)) {
    throw new Error('Nilai konfigurasi tidak boleh mengandung karakter baris baru (CRLF) atau null byte.');
  }
  return raw.trim();
}

function formatEnvLineValue(value: string): string {
  if (value === '') return '';
  if (/[\s#"']/.test(value)) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return value;
}

export function maskSecret(value?: string | null): MaskedSecretInfo {
  const str = (value || '').trim();
  if (!str) {
    return { hasValue: false, masked: 'Belum diatur', length: 0 };
  }
  if (str.length <= 6) {
    return { hasValue: true, masked: '••••••', length: str.length };
  }
  return {
    hasValue: true,
    masked: `${str.slice(0, 3)}••••••••${str.slice(-3)}`,
    length: str.length
  };
}

function readEnvFileMap(): Record<string, string> {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return {};
  }
  try {
    const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
    return dotenv.parse(content);
  } catch {
    return {};
  }
}

function getEffectiveEnvValue(key: string, fileMap: Record<string, string>, fallback = ''): string {
  if (fileMap[key] !== undefined && fileMap[key] !== '') {
    return fileMap[key];
  }
  const proc = process.env[key];
  if (proc !== undefined && proc !== '') {
    return proc;
  }
  return fallback;
}

export function inspectCloudflareTunnelToken(rawToken?: string | null): TunnelTokenInspection {
  const token = (rawToken || '').trim();
  if (!token) {
    return {
      configured: false,
      validFormat: false,
      reason: 'Token CLOUDFLARE_TUNNEL_TOKEN belum diisi.'
    };
  }

  if (/\s/.test(token) || token.length < 32) {
    return {
      configured: true,
      validFormat: false,
      reason: 'Format token terlalu pendek atau mengandung spasi. Salin ulang token dari Cloudflare Zero Trust Dashboard.'
    };
  }

  try {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf-8');
    if (decoded.startsWith('{') && decoded.includes('}')) {
      const parsed = JSON.parse(decoded) as { a?: string; t?: string; s?: string };
      if (parsed && typeof parsed.t === 'string' && typeof parsed.a === 'string') {
        return {
          configured: true,
          validFormat: true,
          tunnelId: parsed.t,
          accountTagPreview: `${parsed.a.slice(0, 6)}••••`,
          reason: `Token tervalidasi (Tunnel ID: ${parsed.t}).`
        };
      }
    }
  } catch {
    // Non-JSON opaque/JWT token format fallback
  }

  const looksLikeJwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
  const looksLikeBase64Token = /^[A-Za-z0-9+/_=-]{40,}$/.test(token);
  if (looksLikeJwt || looksLikeBase64Token) {
    return {
      configured: true,
      validFormat: true,
      reason: 'Format token terstruktur valid dan siap dipakai oleh daemon cloudflared.'
    };
  }

  return {
    configured: true,
    validFormat: false,
    reason: 'Karakter token tidak sesuai standar Cloudflare Tunnel.'
  };
}

export async function probePublicHealthUrl(rawUrl: string): Promise<{
  url: string;
  reachable: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
}> {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      url: trimmed,
      reachable: false,
      error: 'URL publik harus diawali http:// atau https://'
    };
  }

  const target = trimmed.endsWith('/api/health') ? trimmed : `${trimmed}/api/health`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(target, { signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    return {
      url: target,
      reachable: res.ok,
      statusCode: res.status,
      latencyMs,
      error: res.ok ? undefined : `Endpoint merespons HTTP ${res.status}`
    };
  } catch (err: unknown) {
    return {
      url: target,
      reachable: false,
      latencyMs: Date.now() - startedAt,
      error: getErrorMessage(err, 'Gagal menjangkau URL publik tunnel.')
    };
  } finally {
    clearTimeout(timeout);
  }
}

export class SystemSetupService {
  static getEnvFilePath(): string {
    return ENV_FILE_PATH;
  }

  static ensureEnvFileExists(): boolean {
    if (fs.existsSync(ENV_FILE_PATH)) {
      return true;
    }
    if (fs.existsSync(ENV_EXAMPLE_PATH)) {
      fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_FILE_PATH);
      return true;
    }
    fs.writeFileSync(ENV_FILE_PATH, '# FieldOps IT Inventory Environment Configuration\n', 'utf-8');
    return true;
  }

  static upsertEnvVars(updates: Record<string, string>): void {
    this.ensureEnvFileExists();

    const sanitizedEntries: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(updates)) {
      if (!/^[A-Z0-9_]+$/.test(key)) {
        throw new Error(`Nama variabel lingkungan tidak valid: ${key}`);
      }
      sanitizedEntries.push([key, sanitizeEnvScalar(value)]);
    }

    const existingContent = fs.existsSync(ENV_FILE_PATH) ? fs.readFileSync(ENV_FILE_PATH, 'utf-8') : '';
    const lines = existingContent.split(/\r?\n/);
    const handledKeys = new Set<string>();

    const nextLines = lines.map((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
      if (!match) return line;
      const lineKey = match[1];
      const found = sanitizedEntries.find(([k]) => k === lineKey);
      if (!found) return line;
      handledKeys.add(lineKey);
      return `${lineKey}=${formatEnvLineValue(found[1])}`;
    });

    const missingEntries = sanitizedEntries.filter(([k]) => !handledKeys.has(k));
    if (missingEntries.length > 0) {
      if (nextLines.length > 0 && nextLines[nextLines.length - 1].trim() !== '') {
        nextLines.push('');
      }
      for (const [k, v] of missingEntries) {
        nextLines.push(`${k}=${formatEnvLineValue(v)}`);
      }
    }

    const finalText = nextLines.join('\n').replace(/\n+$/, '') + '\n';
    fs.writeFileSync(ENV_FILE_PATH, finalText, 'utf-8');

    for (const [k, v] of sanitizedEntries) {
      process.env[k] = v;
    }
  }

  static getMaskedSettings(): SystemMaskedSettings {
    const fileMap = readEnvFileMap();
    const dbRuntime = getDbRuntimeStatus();
    const secretVal = getEffectiveEnvValue('APP_SECRET_KEY', fileMap, '');
    const dbPass = getEffectiveEnvValue('DB_PASSWORD', fileMap, getEffectiveEnvValue('MARIADB_PASSWORD', fileMap, ''));
    const dbRootPass = getEffectiveEnvValue('DB_ROOT_PASSWORD', fileMap, '');
    const tunnelToken = getEffectiveEnvValue('CLOUDFLARE_TUNNEL_TOKEN', fileMap, '');
    const publicUrl = getEffectiveEnvValue('CLOUDFLARE_PUBLIC_URL', fileMap, '');
    const waToken = getEffectiveEnvValue('WHATSAPP_API_TOKEN', fileMap, '');
    const waUrl = getEffectiveEnvValue('WHATSAPP_API_URL', fileMap, 'https://api.fonnte.com/send');
    const waPhones = getEffectiveEnvValue('WHATSAPP_TARGET_PHONES', fileMap, '');
    const waAuto = getEffectiveEnvValue('WHATSAPP_AUTO_ALERT', fileMap, 'true').toLowerCase() !== 'false';

    return {
      envFileExists: fs.existsSync(ENV_FILE_PATH),
      envPathRelative: '.env',
      app: {
        port: getEffectiveEnvValue('PORT', fileMap, '3000'),
        nodeEnv: getEffectiveEnvValue('NODE_ENV', fileMap, 'development'),
        appTitle: getEffectiveEnvValue('VITE_APP_TITLE', fileMap, 'FieldOps IT Inventory'),
        secretKey: maskSecret(secretVal),
        secretKeyStrong: secretVal.length >= 16
      },
      database: {
        host: getEffectiveEnvValue('DB_HOST', fileMap, dbRuntime.host),
        port: parseInt(getEffectiveEnvValue('DB_PORT', fileMap, String(dbRuntime.port)), 10) || 3306,
        name: getEffectiveEnvValue('DB_NAME', fileMap, dbRuntime.database),
        user: getEffectiveEnvValue('DB_USER', fileMap, dbRuntime.user),
        password: maskSecret(dbPass),
        rootPassword: maskSecret(dbRootPass),
        runtimeActiveMariaDb: dbRuntime.isMariaDbActive
      },
      tunnel: {
        token: maskSecret(tunnelToken),
        inspection: inspectCloudflareTunnelToken(tunnelToken),
        publicUrl
      },
      whatsapp: {
        apiUrl: waUrl,
        token: maskSecret(waToken),
        autoAlert: waAuto,
        targetPhones: waPhones
      }
    };
  }

  static async saveAndTestDatabase(input: DatabaseUpdateInput): Promise<{
    saved: boolean;
    testResult: DbConnectionTestResult;
    runtimeActiveMariaDb: boolean;
  }> {
    const fileMap = readEnvFileMap();
    const host = sanitizeEnvScalar(input.host ?? getEffectiveEnvValue('DB_HOST', fileMap, 'localhost')) || 'localhost';
    const portNum = Math.max(1, parseInt(String(input.port ?? getEffectiveEnvValue('DB_PORT', fileMap, '3306')), 10) || 3306);
    const database = sanitizeEnvScalar(input.name ?? getEffectiveEnvValue('DB_NAME', fileMap, 'fieldops_inventory')) || 'fieldops_inventory';
    const user = sanitizeEnvScalar(input.user ?? getEffectiveEnvValue('DB_USER', fileMap, 'fieldops_user')) || 'fieldops_user';

    const updates: Record<string, string> = {
      DB_HOST: host,
      DB_PORT: String(portNum),
      DB_NAME: database,
      DB_USER: user
    };

    const existingPassword = getEffectiveEnvValue('DB_PASSWORD', fileMap, 'fieldops_secret');
    const effectivePassword = input.password && input.password.trim() !== ''
      ? sanitizeEnvScalar(input.password)
      : existingPassword;

    if (input.password && input.password.trim() !== '') {
      updates.DB_PASSWORD = effectivePassword;
    }

    if (input.rootPassword && input.rootPassword.trim() !== '') {
      updates.DB_ROOT_PASSWORD = sanitizeEnvScalar(input.rootPassword);
    }

    this.upsertEnvVars(updates);

    const testResult = await testMariaDbConnection({
      host,
      port: portNum,
      database,
      user,
      password: effectivePassword
    });

    if (testResult.connected && input.reloadPool !== false) {
      await reloadDatabasePool({
        host,
        port: portNum,
        database,
        user,
        password: effectivePassword
      });
    }

    return {
      saved: true,
      testResult,
      runtimeActiveMariaDb: getDbRuntimeStatus().isMariaDbActive
    };
  }

  static async saveAndTestTunnel(input: TunnelUpdateInput): Promise<{
    saved: boolean;
    inspection: TunnelTokenInspection;
    publicUrlProbe?: SystemCheckReport['publicUrlProbe'];
    dockerHint: string;
  }> {
    const fileMap = readEnvFileMap();
    const updates: Record<string, string> = {};

    if (input.clearToken) {
      updates.CLOUDFLARE_TUNNEL_TOKEN = '';
    } else if (input.token !== undefined && input.token.trim() !== '') {
      const cleanToken = sanitizeEnvScalar(input.token);
      const check = inspectCloudflareTunnelToken(cleanToken);
      if (!check.validFormat) {
        throw new Error(check.reason);
      }
      updates.CLOUDFLARE_TUNNEL_TOKEN = cleanToken;
    }

    if (input.publicUrl !== undefined) {
      const cleanUrl = sanitizeEnvScalar(input.publicUrl);
      if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
        throw new Error('URL publik tunnel harus diawali https:// atau http://');
      }
      updates.CLOUDFLARE_PUBLIC_URL = cleanUrl;
    }

    if (Object.keys(updates).length > 0) {
      this.upsertEnvVars(updates);
    }

    const updatedMap = readEnvFileMap();
    const effectiveToken = getEffectiveEnvValue('CLOUDFLARE_TUNNEL_TOKEN', updatedMap, '');
    const effectivePublicUrl = getEffectiveEnvValue('CLOUDFLARE_PUBLIC_URL', updatedMap, '');
    const inspection = inspectCloudflareTunnelToken(effectiveToken);

    let publicUrlProbe: SystemCheckReport['publicUrlProbe'];
    if (input.testPublicUrl && effectivePublicUrl) {
      publicUrlProbe = await probePublicHealthUrl(effectivePublicUrl);
    }

    return {
      saved: Object.keys(updates).length > 0,
      inspection,
      publicUrlProbe,
      dockerHint: 'Jika menjalankan Cloudflare Tunnel via Docker Compose, jalankan "docker compose up -d --force-recreate cloudflared" setelah token diubah agar kontainer memuat token baru.'
    };
  }

  static async saveAndTestWhatsapp(
    input: WhatsappEnvSetupInput,
    operator: { id: string; name: string }
  ): Promise<{
    saved: boolean;
    config: Awaited<ReturnType<typeof WhatsappAlertService.getConfig>>;
    testResult?: { success: boolean; message: string };
  }> {
    const fileMap = readEnvFileMap();
    const envUpdates: Record<string, string> = {};

    const cleanUrl = input.apiUrl !== undefined
      ? sanitizeEnvScalar(input.apiUrl)
      : getEffectiveEnvValue('WHATSAPP_API_URL', fileMap, 'https://api.fonnte.com/send');

    if (cleanUrl) {
      envUpdates.WHATSAPP_API_URL = cleanUrl;
    }

    if (input.apiToken !== undefined && input.apiToken.trim() !== '') {
      envUpdates.WHATSAPP_API_TOKEN = sanitizeEnvScalar(input.apiToken);
    }

    let normalizedRecipients: string[] | undefined;
    if (input.targetPhones !== undefined) {
      normalizedRecipients = WhatsappAlertService.deduplicateRecipients(input.targetPhones);
      envUpdates.WHATSAPP_TARGET_PHONES = sanitizeEnvScalar(normalizedRecipients.join(','));
    }

    if (input.isEnabled !== undefined) {
      envUpdates.WHATSAPP_AUTO_ALERT = input.isEnabled ? 'true' : 'false';
    }

    if (Object.keys(envUpdates).length > 0) {
      this.upsertEnvVars(envUpdates);
    }

    const updatedConfig = await WhatsappAlertService.updateConfig(
      {
        apiUrl: cleanUrl || undefined,
        apiToken: input.apiToken && input.apiToken.trim() !== '' ? sanitizeEnvScalar(input.apiToken) : undefined,
        recipients: normalizedRecipients,
        isEnabled: input.isEnabled,
        cooldownMinutes: input.cooldownMinutes
      },
      operator
    );

    let testResult: { success: boolean; message: string } | undefined;
    if (input.runTest) {
      try {
        const res = await WhatsappAlertService.sendTestMessage(undefined, operator);
        testResult = { success: res.success, message: res.message };
      } catch (err: unknown) {
        testResult = {
          success: false,
          message: getErrorMessage(err, 'Gagal mengirim pesan uji WhatsApp.')
        };
      }
    }

    return {
      saved: true,
      config: updatedConfig,
      testResult
    };
  }

  static async runSystemCheck(options?: { publicUrl?: string }): Promise<SystemCheckReport> {
    const fileMap = readEnvFileMap();
    const envExists = fs.existsSync(ENV_FILE_PATH);
    const secretKey = getEffectiveEnvValue('APP_SECRET_KEY', fileMap, '');
    const dbRuntime = getDbRuntimeStatus();

    const [databaseProbe, waConfig] = await Promise.all([
      testMariaDbConnection({
        host: getEffectiveEnvValue('DB_HOST', fileMap, dbRuntime.host),
        port: parseInt(getEffectiveEnvValue('DB_PORT', fileMap, String(dbRuntime.port)), 10) || 3306,
        database: getEffectiveEnvValue('DB_NAME', fileMap, dbRuntime.database),
        user: getEffectiveEnvValue('DB_USER', fileMap, dbRuntime.user),
        password: getEffectiveEnvValue('DB_PASSWORD', fileMap, getEffectiveEnvValue('MARIADB_PASSWORD', fileMap, 'fieldops_secret'))
      }),
      WhatsappAlertService.getConfig()
    ]);

    const checks: SystemDiagnosticItem[] = [];

    // 1. Environment & Secret Key
    if (!envExists) {
      checks.push({
        key: 'env',
        label: 'Konfigurasi .env & Secret Key',
        status: 'unconfigured',
        summary: 'Berkas .env belum ditemukan',
        details: 'Aplikasi berjalan dengan nilai default/fallback. Buat .env melalui CLI setup atau simpan pengaturan dari tab Setting.',
        hint: 'Salin .env.example menjadi .env atau jalankan setup:db / setup:tunnel.',
        cliCommand: 'npm run setup:db'
      });
    } else if (secretKey.length < 16) {
      checks.push({
        key: 'env',
        label: 'Konfigurasi .env & Secret Key',
        status: 'warning',
        summary: 'APP_SECRET_KEY lemah atau belum diisi',
        details: 'Berkas .env ditemukan, namun APP_SECRET_KEY kosong atau kurang dari 16 karakter.',
        hint: 'Isi APP_SECRET_KEY di berkas .env dengan string acak panjang untuk keamanan sesi produksi.',
        cliCommand: 'npm run setup:check'
      });
    } else {
      checks.push({
        key: 'env',
        label: 'Konfigurasi .env & Secret Key',
        status: 'connected',
        summary: '.env siap & APP_SECRET_KEY terkonfigurasi',
        details: `Berkas .env aktif dengan panjang kunci sesi ${secretKey.length} karakter.`
      });
    }

    // 2. Database MariaDB
    if (databaseProbe.connected && databaseProbe.hasCoreTables) {
      checks.push({
        key: 'database',
        label: 'Database MariaDB',
        status: 'connected',
        summary: `Terhubung (${databaseProbe.host}:${databaseProbe.port}/${databaseProbe.database})`,
        details: `MariaDB ${databaseProbe.serverVersion || ''} merespons dalam ${databaseProbe.latencyMs} ms dengan ${databaseProbe.tableCount} tabel lengkap.${dbRuntime.isMariaDbActive ? '' : ' Catatan: Pool runtime aktif saat ini masih mode memori; muat ulang koneksi agar memakai MariaDB.'}`,
        latencyMs: databaseProbe.latencyMs,
        cliCommand: 'npm run setup:db'
      });
    } else if (databaseProbe.connected && !databaseProbe.hasCoreTables) {
      checks.push({
        key: 'database',
        label: 'Database MariaDB',
        status: 'warning',
        summary: 'Terhubung, skema tabel inti belum lengkap',
        details: `Koneksi ke ${databaseProbe.host}:${databaseProbe.port} berhasil, namun tabel belum lengkap (${databaseProbe.missingCoreTables.join(', ')}).`,
        hint: 'Jalankan setup:db atau restart server agar migrasi otomatis berjalan.',
        latencyMs: databaseProbe.latencyMs,
        cliCommand: 'npm run setup:db'
      });
    } else {
      checks.push({
        key: 'database',
        label: 'Database MariaDB',
        status: 'unconfigured',
        summary: dbRuntime.isMariaDbActive ? 'Koneksi MariaDB gagal' : 'Berjalan di mode memori lokal (MariaDB belum terhubung)',
        details: databaseProbe.error || 'Tidak dapat melakukan ping ke server MariaDB.',
        hint: 'Periksa host/port/password MariaDB lewat Setting > Database atau CLI setup:db.',
        latencyMs: databaseProbe.latencyMs,
        cliCommand: 'npm run setup:db'
      });
    }

    // 3. Master Admin / Active Accounts
    let adminCount = 0;
    try {
      const rows = await executeQuery<{ total: number | string }>(
        "SELECT COUNT(*) AS total FROM users WHERE status = 'ACTIVE' AND role IN ('developer', 'admin', 'superadmin')"
      );
      adminCount = Number(rows?.[0]?.total || 0);
    } catch {
      adminCount = 0;
    }

    if (adminCount > 0) {
      checks.push({
        key: 'admin',
        label: 'Akun Admin / Developer',
        status: 'connected',
        summary: `${adminCount} akun Admin/Developer aktif`,
        details: 'Akun pengelola utama tersedia dan siap digunakan untuk otorisasi sistem.'
      });
    } else {
      checks.push({
        key: 'admin',
        label: 'Akun Admin / Developer',
        status: 'unconfigured',
        summary: 'Belum ada akun Admin/Developer aktif',
        details: 'Buat akun Master Admin pertama agar manajemen pengguna dan sistem dapat diakses.',
        cliCommand: 'npm run setup:admin'
      });
    }

    // 4. WhatsApp Notification Gateway
    const waToken = getEffectiveEnvValue('WHATSAPP_API_TOKEN', fileMap, '');
    const hasWaToken = Boolean(waToken || (waConfig.maskedToken && waConfig.maskedToken !== 'Belum diisi'));
    const hasRecipients = waConfig.recipients && waConfig.recipients.length > 0;

    if (hasWaToken && hasRecipients && waConfig.isEnabled) {
      checks.push({
        key: 'whatsapp',
        label: 'Notifikasi WhatsApp (Fonnte)',
        status: 'connected',
        summary: `Siap (${waConfig.recipients.length} penerima, cooldown ${waConfig.cooldownMinutes} menit)`,
        details: `Gateway: ${waConfig.apiUrl}. Status notifikasi otomatis aktif.`,
        cliCommand: 'npm run setup:wa'
      });
    } else if (hasWaToken || hasRecipients) {
      checks.push({
        key: 'whatsapp',
        label: 'Notifikasi WhatsApp (Fonnte)',
        status: 'warning',
        summary: !waConfig.isEnabled
          ? 'Konfigurasi tersimpan, namun notifikasi otomatis nonaktif'
          : !hasWaToken
          ? 'Token API Fonnte belum diisi'
          : 'Daftar nomor/grup penerima masih kosong',
        details: 'Lengkapi token Fonnte dan minimal satu nomor penerima di tab Setting > Notifikasi WA atau via CLI.',
        cliCommand: 'npm run setup:wa'
      });
    } else {
      checks.push({
        key: 'whatsapp',
        label: 'Notifikasi WhatsApp (Fonnte)',
        status: 'unconfigured',
        summary: 'Token API & penerima WhatsApp belum dikonfigurasi',
        details: 'Pengiriman alert stok menipis berjalan dalam mode simulasi log lokal sampai token Fonnte diisi.',
        cliCommand: 'npm run setup:wa'
      });
    }

    // 5. Cloudflare Tunnel
    const tunnelToken = getEffectiveEnvValue('CLOUDFLARE_TUNNEL_TOKEN', fileMap, '');
    const configuredPublicUrl = options?.publicUrl || getEffectiveEnvValue('CLOUDFLARE_PUBLIC_URL', fileMap, '');
    const tunnelInspection = inspectCloudflareTunnelToken(tunnelToken);
    let publicUrlProbe: SystemCheckReport['publicUrlProbe'];

    if (configuredPublicUrl) {
      publicUrlProbe = await probePublicHealthUrl(configuredPublicUrl);
    }

    if (!tunnelInspection.configured) {
      checks.push({
        key: 'tunnel',
        label: 'Cloudflare Tunnel (Akses Jarak Jauh)',
        status: 'unconfigured',
        summary: 'Token Cloudflare Tunnel belum diatur',
        details: 'Aplikasi tetap dapat diakses melalui LAN kantor; isi CLOUDFLARE_TUNNEL_TOKEN untuk akses HTTPS publik.',
        cliCommand: 'npm run setup:tunnel'
      });
    } else if (!tunnelInspection.validFormat) {
      checks.push({
        key: 'tunnel',
        label: 'Cloudflare Tunnel (Akses Jarak Jauh)',
        status: 'warning',
        summary: 'Format token Tunnel tidak valid',
        details: tunnelInspection.reason,
        cliCommand: 'npm run setup:tunnel'
      });
    } else if (publicUrlProbe && !publicUrlProbe.reachable) {
      checks.push({
        key: 'tunnel',
        label: 'Cloudflare Tunnel (Akses Jarak Jauh)',
        status: 'warning',
        summary: 'Token valid, namun URL publik belum merespons',
        details: `${tunnelInspection.reason} Uji ke ${publicUrlProbe.url} gagal: ${publicUrlProbe.error || 'tidak terjangkau'}.`,
        hint: 'Pastikan layanan/kontainer cloudflared aktif setelah token disimpan.',
        latencyMs: publicUrlProbe.latencyMs,
        cliCommand: 'npm run setup:tunnel'
      });
    } else {
      checks.push({
        key: 'tunnel',
        label: 'Cloudflare Tunnel (Akses Jarak Jauh)',
        status: 'connected',
        summary: publicUrlProbe?.reachable
          ? `Token valid & URL publik merespons (${publicUrlProbe.latencyMs} ms)`
          : 'Token Tunnel terkonfigurasi & tervalidasi',
        details: tunnelInspection.reason + (publicUrlProbe?.reachable ? ` URL aktif: ${publicUrlProbe.url}.` : ''),
        latencyMs: publicUrlProbe?.latencyMs
      });
    }

    const unconfiguredCount = checks.filter((c) => c.status === 'unconfigured').length;
    const warningCount = checks.filter((c) => c.status === 'warning').length;
    const overallStatus: SystemCheckReport['overallStatus'] =
      unconfiguredCount === 0 && warningCount === 0
        ? 'ready'
        : checks.some((c) => c.key === 'database' && c.status !== 'connected')
        ? 'incomplete'
        : 'partial';

    return {
      overallStatus,
      checkedAt: new Date().toISOString(),
      checks,
      databaseProbe,
      tunnelInspection,
      publicUrlProbe
    };
  }

  static getCliScriptCatalog(): CliScriptEntry[] {
    return [
      {
        command: 'npm run setup:help',
        category: 'setup',
        summary: 'Menampilkan daftar seluruh perintah setup & utilitas terminal yang tersedia (alias: npm run setup:list).'
      },
      {
        command: 'npm run setup:admin',
        category: 'setup',
        summary: 'Membuat atau mereset akun Master Admin / Developer / Admin Gudang / Teknisi dengan hash PBKDF2 100.000 iterasi.',
        flags: '-- --username developer --password <sandi> --role developer --email dev@fieldops.local'
      },
      {
        command: 'npm run setup:db',
        category: 'setup',
        summary: 'Mengatur host, port, nama database, user, dan kata sandi MariaDB ke .env lalu menguji koneksi & skema tabel secara langsung.',
        flags: '-- --host localhost --port 3306 --name fieldops_inventory --user fieldops_user --password <sandi>'
      },
      {
        command: 'npm run setup:tunnel',
        category: 'setup',
        summary: 'Mengatur token Cloudflare Tunnel (CLOUDFLARE_TUNNEL_TOKEN) & URL publik ke .env serta memvalidasi strukturnya.',
        flags: '-- --token <cf_tunnel_token> --url https://stok.domainanda.com'
      },
      {
        command: 'npm run setup:wa',
        category: 'setup',
        summary: 'Mengatur URL gateway Fonnte, token API, dan daftar penerima notifikasi WhatsApp di .env & database beserta uji kirim.',
        flags: '-- --url https://api.fonnte.com/send --token <fonnte_token> --phones 0812xxxx,0813xxxx --enabled true --test'
      },
      {
        command: 'npm run setup:check',
        category: 'setup',
        summary: 'Memeriksa status konektivitas seluruh integrasi (.env, APP_SECRET_KEY, MariaDB, Akun Admin, WhatsApp, Cloudflare Tunnel).',
        flags: '-- --url https://stok.domainanda.com --json'
      },
      {
        command: 'npm run sampah',
        category: 'maintenance',
        summary: 'Mengelola data yang masuk ke Tempat Sampah retensi 14 hari (daftar, dry-run pemulihan, pulihkan, atau purge kedaluwarsa).',
        flags: '-- --list | --pulihkan <ID> --dry-run | --pulihkan <ID> | --purge'
      },
      {
        command: 'npm run test:backup',
        category: 'maintenance',
        summary: 'Menguji integritas backup JSON inventori bebas kredensial akun beserta simulasi pemulihan data.'
      },
      {
        command: 'npm run dev',
        category: 'runtime',
        summary: 'Menjalankan server Express 5 + Vite middleware dalam mode pengembangan pada port 3000.'
      },
      {
        command: 'npm run build',
        category: 'runtime',
        summary: 'Membuild bundle produksi frontend Vite ke direktori dist/.'
      },
      {
        command: 'npm run lint',
        category: 'runtime',
        summary: 'Menjalankan pemeriksaan tipe TypeScript menyeluruh (tsc --noEmit).'
      },
      {
        command: 'npm run start',
        category: 'runtime',
        summary: 'Menjalankan server produksi Node.js (NODE_ENV=production) pada port 3000.'
      }
    ];
  }
}
