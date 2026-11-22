/**
 * System Setup & Diagnostics Service
 * FieldOps IT Inventory
 * - Safe .env read/mask/upsert (Anti-CRLF injection, preserves comments & unrelated keys)
 * - Live MariaDB connection probe & runtime pool reload
 * - Cloudflare Tunnel token structural validation & optional public URL health probe
 * - WhatsApp Fonnte .env + DB wa_config synchronization
 * - Unified system health diagnostics for CLI (setup:check) & Web Settings Hub
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  BACKEND_ENV_FILE_PATH,
  PROJECT_ROOT_DIR,
  ROOT_ENV_FILE_PATH,
  executeQuery,
  getDbRuntimeStatus,
  reloadDatabasePool,
  testMariaDbConnection,
  type DbConnectionTestResult
} from '../db/database';
import { AuthService, normalizeUserRole } from './authService';
import { WhatsappAlertService } from './whatsappAlertService';
import { getErrorMessage } from '../utils/errorUtils';
import { toMysqlUtcSeconds } from '../utils/timezone';

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
  backendFallbackEnvExists: boolean;
  envPathRelative: string;
  envSourceSummary: string;
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

export interface LoginDiagnosticStep {
  key: 'runtime_db' | 'user_lookup' | 'account_status' | 'password_verify' | 'session_tables' | 'activity_log';
  label: string;
  passed: boolean;
  detail: string;
}

export interface LoginDiagnosticResult {
  username: string;
  overallSuccess: boolean;
  runtimeMode: 'mariadb' | 'memory';
  userSummary?: {
    id: string;
    username: string;
    name: string;
    role: string;
    status: string;
    hasPasswordHash: boolean;
    hasSalt: boolean;
  };
  steps: LoginDiagnosticStep[];
  recommendation?: string;
  testedAt: string;
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

const ENV_FILE_PATH = ROOT_ENV_FILE_PATH;
const ENV_FALLBACK_PATH = BACKEND_ENV_FILE_PATH;
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

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return dotenv.parse(content);
  } catch {
    return {};
  }
}

export interface EffectiveEnvMaps {
  rootMap: Record<string, string>;
  backendMap: Record<string, string>;
  rootExists: boolean;
  backendExists: boolean;
}

function readEnvFileMaps(): EffectiveEnvMaps {
  const rootExists = fs.existsSync(ENV_FILE_PATH);
  const backendExists = fs.existsSync(ENV_FALLBACK_PATH);
  return {
    rootMap: parseEnvFile(ENV_FILE_PATH),
    backendMap: parseEnvFile(ENV_FALLBACK_PATH),
    rootExists,
    backendExists
  };
}

function getEffectiveEnvValue(key: string, maps: EffectiveEnvMaps, fallback = ''): string {
  if (maps.rootMap[key] !== undefined && maps.rootMap[key] !== '') {
    return maps.rootMap[key];
  }
  const proc = process.env[key];
  if (proc !== undefined && proc !== '') {
    return proc;
  }
  if (maps.backendMap[key] !== undefined && maps.backendMap[key] !== '') {
    return maps.backendMap[key];
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

  static getBackendFallbackEnvPath(): string {
    return ENV_FALLBACK_PATH;
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
    const maps = readEnvFileMaps();
    const dbRuntime = getDbRuntimeStatus();
    const secretVal = getEffectiveEnvValue('APP_SECRET_KEY', maps, '');
    const dbPass = getEffectiveEnvValue('DB_PASSWORD', maps, getEffectiveEnvValue('MARIADB_PASSWORD', maps, ''));
    const dbRootPass = getEffectiveEnvValue('DB_ROOT_PASSWORD', maps, '');
    const tunnelToken = getEffectiveEnvValue('CLOUDFLARE_TUNNEL_TOKEN', maps, '');
    const publicUrl = getEffectiveEnvValue('CLOUDFLARE_PUBLIC_URL', maps, '');
    const waToken = getEffectiveEnvValue('WHATSAPP_API_TOKEN', maps, '');
    const waUrl = getEffectiveEnvValue('WHATSAPP_API_URL', maps, 'https://api.fonnte.com/send');
    const waPhones = getEffectiveEnvValue('WHATSAPP_TARGET_PHONES', maps, '');
    const waAuto = getEffectiveEnvValue('WHATSAPP_AUTO_ALERT', maps, 'true').toLowerCase() !== 'false';

    const envSourceSummary = maps.rootExists && maps.backendExists
      ? 'Utama: /.env (root) · Fallback baca aktif: backend/.env'
      : maps.rootExists
      ? 'Utama: /.env (root)'
      : maps.backendExists
      ? 'Fallback baca: backend/.env (/.env root belum dibuat)'
      : 'Belum ada berkas .env di root maupun backend/';

    return {
      envFileExists: maps.rootExists,
      backendFallbackEnvExists: maps.backendExists,
      envPathRelative: '.env',
      envSourceSummary,
      app: {
        port: getEffectiveEnvValue('PORT', maps, '3000'),
        nodeEnv: getEffectiveEnvValue('NODE_ENV', maps, 'development'),
        appTitle: getEffectiveEnvValue('VITE_APP_TITLE', maps, 'FieldOps IT Inventory'),
        secretKey: maskSecret(secretVal),
        secretKeyStrong: secretVal.length >= 16
      },
      database: {
        host: getEffectiveEnvValue('DB_HOST', maps, dbRuntime.host),
        port: parseInt(getEffectiveEnvValue('DB_PORT', maps, String(dbRuntime.port)), 10) || 3306,
        name: getEffectiveEnvValue('DB_NAME', maps, dbRuntime.database),
        user: getEffectiveEnvValue('DB_USER', maps, dbRuntime.user),
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
    const maps = readEnvFileMaps();
    const host = sanitizeEnvScalar(input.host ?? getEffectiveEnvValue('DB_HOST', maps, 'localhost')) || 'localhost';
    const portNum = Math.max(1, parseInt(String(input.port ?? getEffectiveEnvValue('DB_PORT', maps, '3306')), 10) || 3306);
    const database = sanitizeEnvScalar(input.name ?? getEffectiveEnvValue('DB_NAME', maps, 'fieldops_inventory')) || 'fieldops_inventory';
    const user = sanitizeEnvScalar(input.user ?? getEffectiveEnvValue('DB_USER', maps, 'fieldops_user')) || 'fieldops_user';

    const updates: Record<string, string> = {
      DB_HOST: host,
      DB_PORT: String(portNum),
      DB_NAME: database,
      DB_USER: user
    };

    const existingPassword = getEffectiveEnvValue('DB_PASSWORD', maps, 'fieldops_secret');
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

    const updatedMaps = readEnvFileMaps();
    const effectiveToken = getEffectiveEnvValue('CLOUDFLARE_TUNNEL_TOKEN', updatedMaps, '');
    const effectivePublicUrl = getEffectiveEnvValue('CLOUDFLARE_PUBLIC_URL', updatedMaps, '');
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
    const maps = readEnvFileMaps();
    const envUpdates: Record<string, string> = {};

    const cleanUrl = input.apiUrl !== undefined
      ? sanitizeEnvScalar(input.apiUrl)
      : getEffectiveEnvValue('WHATSAPP_API_URL', maps, 'https://api.fonnte.com/send');

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
    const maps = readEnvFileMaps();
    const envExists = maps.rootExists;
    const backendEnvExists = maps.backendExists;
    const secretKey = getEffectiveEnvValue('APP_SECRET_KEY', maps, '');
    const dbRuntime = getDbRuntimeStatus();

    const [databaseProbe, waConfig] = await Promise.all([
      testMariaDbConnection({
        host: getEffectiveEnvValue('DB_HOST', maps, dbRuntime.host),
        port: parseInt(getEffectiveEnvValue('DB_PORT', maps, String(dbRuntime.port)), 10) || 3306,
        database: getEffectiveEnvValue('DB_NAME', maps, dbRuntime.database),
        user: getEffectiveEnvValue('DB_USER', maps, dbRuntime.user),
        password: getEffectiveEnvValue('DB_PASSWORD', maps, getEffectiveEnvValue('MARIADB_PASSWORD', maps, 'fieldops_secret'))
      }),
      WhatsappAlertService.getConfig()
    ]);

    const checks: SystemDiagnosticItem[] = [];

    // 1. Environment & Secret Key
    if (!envExists && !backendEnvExists) {
      checks.push({
        key: 'env',
        label: 'Konfigurasi .env & Secret Key',
        status: 'unconfigured',
        summary: 'Berkas .env belum ditemukan di root maupun backend/',
        details: 'Aplikasi berjalan dengan nilai default/fallback. Buat .env di root melalui CLI setup atau simpan pengaturan dari tab Setting.',
        hint: 'Salin .env.example menjadi .env di root atau jalankan setup:db / setup:tunnel.',
        cliCommand: 'npm run setup:db'
      });
    } else if (!envExists && backendEnvExists) {
      checks.push({
        key: 'env',
        label: 'Konfigurasi .env & Secret Key',
        status: 'warning',
        summary: 'Menggunakan fallback backend/.env (.env di root belum dibuat)',
        details: 'File backend/.env terbaca sebagai fallback, namun sumber utama Docker & setup berada di .env root.',
        hint: 'Simpan pengaturan lewat Setting atau jalankan setup:db agar .env utama tercipta di root proyek.',
        cliCommand: 'npm run setup:db'
      });
    } else if (secretKey.length < 16) {
      checks.push({
        key: 'env',
        label: 'Konfigurasi .env & Secret Key',
        status: 'warning',
        summary: 'APP_SECRET_KEY lemah atau belum diisi',
        details: `Berkas .env root ditemukan${backendEnvExists ? ' (disertai fallback backend/.env)' : ''}, namun APP_SECRET_KEY kosong atau kurang dari 16 karakter.`,
        hint: 'Isi APP_SECRET_KEY di berkas .env root dengan string acak panjang untuk keamanan sesi produksi.',
        cliCommand: 'npm run setup:check'
      });
    } else {
      checks.push({
        key: 'env',
        label: 'Konfigurasi .env & Secret Key',
        status: 'connected',
        summary: backendEnvExists ? '.env root aktif (fallback backend/.env terdeteksi)' : '.env root siap & APP_SECRET_KEY terkonfigurasi',
        details: `Berkas utama /.env aktif dengan panjang kunci sesi ${secretKey.length} karakter.${backendEnvExists ? ' Catatan: file backend/.env masih ada sebagai fallback untuk kunci yang kosong di root.' : ''}`
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
    const waToken = getEffectiveEnvValue('WHATSAPP_API_TOKEN', maps, '');
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
    const tunnelToken = getEffectiveEnvValue('CLOUDFLARE_TUNNEL_TOKEN', maps, '');
    const configuredPublicUrl = options?.publicUrl || getEffectiveEnvValue('CLOUDFLARE_PUBLIC_URL', maps, '');
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

  static async runLoginDiagnostic(input: {
    username: string;
    password?: string;
    testSessionWrite?: boolean;
  }): Promise<LoginDiagnosticResult> {
    const cleanUsername = String(input.username || '').trim();
    const cleanPassword = typeof input.password === 'string' ? input.password.trim() : '';
    const dbRuntime = getDbRuntimeStatus();
    const runtimeMode: 'mariadb' | 'memory' = dbRuntime.isMariaDbActive ? 'mariadb' : 'memory';
    const steps: LoginDiagnosticStep[] = [];

    steps.push({
      key: 'runtime_db',
      label: 'Target Database Runtime',
      passed: true,
      detail: dbRuntime.isMariaDbActive
        ? `Terhubung ke MariaDB (${dbRuntime.host}:${dbRuntime.port}/${dbRuntime.database}).`
        : 'Berjalan dalam mode memori lokal (MariaDB belum aktif saat server dimulai).'
    });

    interface DiagUserRow {
      id: string;
      username: string;
      name: string;
      email: string;
      role: string;
      status: string;
      password_hash?: string | null;
      salt?: string | null;
    }

    let matchedUser: DiagUserRow | undefined;
    try {
      let rows = await executeQuery<DiagUserRow>(
        'SELECT id, username, name, email, role, status, password_hash, salt FROM users WHERE LOWER(TRIM(username)) = LOWER(?)',
        [cleanUsername]
      );
      if (!rows || rows.length === 0) {
        rows = await executeQuery<DiagUserRow>(
          'SELECT id, username, name, email, role, status, password_hash, salt FROM users WHERE username = ?',
          [cleanUsername]
        );
      }
      matchedUser = rows?.[0];
    } catch (err: unknown) {
      steps.push({
        key: 'user_lookup',
        label: 'Pencarian Akun di Tabel users',
        passed: false,
        detail: `Gagal membaca tabel users: ${getErrorMessage(err)}`
      });
      return {
        username: cleanUsername,
        overallSuccess: false,
        runtimeMode,
        steps,
        recommendation: 'Pastikan migrasi skema tabel users telah berjalan di MariaDB aktif.',
        testedAt: new Date().toISOString()
      };
    }

    if (!matchedUser) {
      steps.push({
        key: 'user_lookup',
        label: 'Pencarian Akun di Tabel users',
        passed: false,
        detail: `Akun dengan username "${cleanUsername}" tidak ditemukan di database ${runtimeMode === 'mariadb' ? 'MariaDB' : 'Memori Lokal'}.`
      });
      return {
        username: cleanUsername,
        overallSuccess: false,
        runtimeMode,
        steps,
        recommendation: dbRuntime.isMariaDbActive
          ? 'Buat akun admin di MariaDB aktif dengan "npm run setup:admin" (pastikan MariaDB sudah terhubung saat skrip dijalankan).'
          : 'MariaDB belum aktif; periksa konfigurasi database lalu jalankan "npm run setup:admin".',
        testedAt: new Date().toISOString()
      };
    }

    const userSummary = {
      id: matchedUser.id,
      username: matchedUser.username,
      name: matchedUser.name,
      role: normalizeUserRole(matchedUser.role),
      status: matchedUser.status,
      hasPasswordHash: Boolean(matchedUser.password_hash && String(matchedUser.password_hash).trim().length > 0),
      hasSalt: Boolean(matchedUser.salt && String(matchedUser.salt).trim().length > 0)
    };

    steps.push({
      key: 'user_lookup',
      label: 'Pencarian Akun di Tabel users',
      passed: true,
      detail: `Akun ditemukan (${matchedUser.username}, peran: ${userSummary.role}, ID: ${matchedUser.id}).`
    });

    const isActive = matchedUser.status === 'ACTIVE';
    steps.push({
      key: 'account_status',
      label: 'Pemeriksaan Status Akun',
      passed: isActive,
      detail: isActive
        ? 'Status akun ACTIVE (diizinkan login).'
        : `Status akun saat ini adalah "${matchedUser.status}". Hanya akun ACTIVE yang dapat masuk.`
    });

    let passwordPassed = false;
    let passwordDetail = '';
    if (cleanPassword.length > 0) {
      passwordPassed = AuthService.verifyPassword(cleanPassword, matchedUser.salt, matchedUser.password_hash);
      passwordDetail = passwordPassed
        ? userSummary.hasSalt
          ? 'Kata sandi cocok dengan hash PBKDF2 SHA-256 (100.000 iterasi).'
          : 'Kata sandi cocok dengan nilai tersimpan di database.'
        : 'Kata sandi tidak cocok dengan password_hash / salt yang tersimpan di database.';
    } else {
      passwordPassed = userSummary.hasPasswordHash;
      passwordDetail = userSummary.hasPasswordHash
        ? `Kata sandi tidak dimasukkan (mode cek struktur). Kolom password_hash terisi & salt ${userSummary.hasSalt ? 'tersedia' : 'kosong'}.`
        : 'Kolom password_hash di database kosong.';
    }

    steps.push({
      key: 'password_verify',
      label: cleanPassword.length > 0 ? 'Verifikasi Kata Sandi (PBKDF2)' : 'Struktur Hash Kata Sandi',
      passed: passwordPassed,
      detail: passwordDetail
    });

    let sessionWriteOk = false;
    let sessionDetail = '';
    if (input.testSessionWrite !== false) {
      const diagSessionId = `diag-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const diagSesiId = `diag-ses-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const expirySql = toMysqlUtcSeconds(new Date(Date.now() + 3600 * 1000));
      const dummyHash = crypto.createHash('sha256').update(diagSesiId).digest('hex');

      try {
        await executeQuery(
          'INSERT INTO sessions (session_id, user_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
          [diagSessionId, matchedUser.id, '127.0.0.1', 'FieldOps-Diagnostic', expirySql]
        );
        await executeQuery(
          `INSERT INTO sesi (id, user_id, refresh_hash, device_id_hash, user_agent, ip, dibuat_pada, aktivitas_terakhir, kedaluwarsa_mutlak)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
          [diagSesiId, matchedUser.id, dummyHash, dummyHash, 'FieldOps-Diagnostic', '127.0.0.1', expirySql]
        );
        sessionWriteOk = true;
        sessionDetail = `Penulisan & pembersihan probe pada tabel sessions & sesi berhasil (format UTC: ${expirySql}).`;
      } catch (err: unknown) {
        sessionWriteOk = false;
        sessionDetail = `Gagal menulis probe sesi ke tabel sessions/sesi: ${getErrorMessage(err)}`;
      } finally {
        await executeQuery('DELETE FROM sessions WHERE session_id = ?', [diagSessionId]).catch(() => {});
        await executeQuery('DELETE FROM sesi WHERE id = ?', [diagSesiId]).catch(() => {});
      }
    } else {
      try {
        await executeQuery('SELECT session_id FROM sessions LIMIT 1');
        await executeQuery('SELECT id FROM sesi LIMIT 1');
        sessionWriteOk = true;
        sessionDetail = 'Tabel sessions dan sesi tersedia dan dapat dibaca.';
      } catch (err: unknown) {
        sessionWriteOk = false;
        sessionDetail = `Tabel sesi bermasalah: ${getErrorMessage(err)}`;
      }
    }

    steps.push({
      key: 'session_tables',
      label: 'Kesiapan Tabel Sesi (sessions & sesi)',
      passed: sessionWriteOk,
      detail: sessionDetail
    });

    let auditOk = false;
    let auditDetail = '';
    try {
      await executeQuery('SELECT id_aktivitas, actor_id, occurred_at FROM transaksi LIMIT 1');
      auditOk = true;
      auditDetail = 'Tabel transaksi (ledger audit login) lengkap dan siap digunakan.';
    } catch (err: unknown) {
      auditOk = false;
      auditDetail = `Peringatan kolom transaksi: ${getErrorMessage(err)} (login tetap dilindungi agar tidak gagal akibat log).`;
    }

    steps.push({
      key: 'activity_log',
      label: 'Kesiapan Ledger Audit Login (transaksi)',
      passed: auditOk,
      detail: auditDetail
    });

    const overallSuccess =
      isActive &&
      passwordPassed &&
      sessionWriteOk;

    let recommendation: string | undefined;
    if (!isActive) {
      recommendation = `Ubah status akun "${matchedUser.username}" menjadi ACTIVE melalui Setting > Manajemen Akun atau "npm run setup:admin".`;
    } else if (!passwordPassed) {
      recommendation = `Reset kata sandi akun "${matchedUser.username}" lewat "npm run setup:admin -- --username ${matchedUser.username} --force" atau menu Reset Kata Sandi.`;
    } else if (!sessionWriteOk) {
      recommendation = 'Periksa kembali migrasi tabel sessions/sesi di MariaDB dan pastikan tipe kolom TIMESTAMP/DATETIME sesuai skema terbaru.';
    } else if (!auditOk) {
      recommendation = 'Jalankan restart server agar migrasi kolom terbaru pada tabel transaksi tuntas; login utama tetap dapat berjalan.';
    }

    return {
      username: cleanUsername,
      overallSuccess,
      runtimeMode,
      userSummary,
      steps,
      recommendation,
      testedAt: new Date().toISOString()
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
        command: 'npm run setup:test-login',
        category: 'setup',
        summary: 'Menguji kredensial akun, status aktif, verifikasi hash PBKDF2, dan kesiapan penulisan tabel sessions/sesi secara bertahap.',
        flags: '-- --username developer --password <sandi>'
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
