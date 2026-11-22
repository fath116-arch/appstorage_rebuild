/**
 * System Setup & Diagnostics API Client
 * Connects to /api/setup/* endpoints (Developer & Admin only)
 */

import { apiFetch, requestJson } from './httpClient';

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

export interface DbConnectionTestResult {
  connected: boolean;
  latencyMs: number;
  host: string;
  port: number;
  database: string;
  user: string;
  serverVersion?: string;
  tableCount: number;
  missingCoreTables: string[];
  hasCoreTables: boolean;
  error?: string;
}

export interface PublicUrlProbe {
  url: string;
  reachable: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
}

export interface SystemCheckReport {
  overallStatus: 'ready' | 'partial' | 'incomplete';
  checkedAt: string;
  checks: SystemDiagnosticItem[];
  databaseProbe: DbConnectionTestResult;
  tunnelInspection: TunnelTokenInspection;
  publicUrlProbe?: PublicUrlProbe;
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

export interface SetupStatusResponse {
  success: boolean;
  settings: SystemMaskedSettings;
  report: SystemCheckReport;
  cliScripts: CliScriptEntry[];
}

export const setupApi = {
  getStatus: () =>
    apiFetch<SetupStatusResponse>('/api/setup/status', {}, 'Gagal memuat status konfigurasi sistem.'),

  runCheck: (publicUrl?: string) =>
    apiFetch<{ success: boolean; settings: SystemMaskedSettings; report: SystemCheckReport }>(
      '/api/setup/check',
      {
        method: 'POST',
        body: JSON.stringify({ publicUrl })
      },
      'Gagal menjalankan pemeriksaan koneksi sistem.'
    ),

  saveAndTestDatabase: (payload: {
    host: string;
    port: number | string;
    name: string;
    user: string;
    password?: string;
    rootPassword?: string;
    reloadPool?: boolean;
  }) =>
    requestJson<{
      success: boolean;
      message: string;
      result?: {
        saved: boolean;
        testResult: DbConnectionTestResult;
        runtimeActiveMariaDb: boolean;
      };
      settings?: SystemMaskedSettings;
    }>('/api/setup/database', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  saveAndTestTunnel: (payload: {
    token?: string;
    publicUrl?: string;
    clearToken?: boolean;
    testPublicUrl?: boolean;
  }) =>
    apiFetch<{
      success: boolean;
      message: string;
      result: {
        saved: boolean;
        inspection: TunnelTokenInspection;
        publicUrlProbe?: PublicUrlProbe;
        dockerHint: string;
      };
      settings: SystemMaskedSettings;
    }>(
      '/api/setup/tunnel',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      'Gagal memperbarui konfigurasi Cloudflare Tunnel.'
    ),

  saveAndTestWhatsapp: (payload: {
    apiUrl?: string;
    apiToken?: string;
    targetPhones?: string[] | string;
    isEnabled?: boolean;
    cooldownMinutes?: number;
    runTest?: boolean;
  }) =>
    apiFetch<{
      success: boolean;
      message: string;
      result: {
        saved: boolean;
        testResult?: { success: boolean; message: string };
      };
      settings: SystemMaskedSettings;
    }>(
      '/api/setup/whatsapp',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      'Gagal memperbarui konfigurasi WhatsApp Gateway.'
    ),

  testLogin: (payload: { username: string; password?: string }) =>
    apiFetch<{
      success: boolean;
      diagnostic: LoginDiagnosticResult;
    }>(
      '/api/setup/test-login',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      'Gagal menjalankan diagnostik tes login akun.'
    )
};
