/**
 * WhatsApp Alert Service (FieldOps IT v1.2.5 Paket 6)
 * - Ambang Berjenjang (Hierarchical Thresholds: Tipe > Produk > Global)
 * - Daftar Pantauan (Watchlist) & Peringatan Dini
 * - Filter Stok Rusak (Item Rusak tidak dihitung sebagai stok tersedia)
 * - Pembatasan Jeda 15 Menit di Backend & Penggabungan Pesan Ringkasan
 * - Anti-Duplikat Berbasis Status
 * - Penerima Bebas Duplikat (Grup / Nomor)
 * - Ekstensibilitas Estimasi Sisa Hari
 */

import { executeQuery, memoryStore } from '../db/database';
import { FonnteProvider, WaGatewayProviderType } from '../integrations/whatsapp/fonnte';
import { WhatsAppProvider } from '../integrations/whatsapp/provider';
import { formatConsolidatedStockAlertMessage, formatTestConnectionMessage } from '../integrations/whatsapp/templates';
import { getErrorMessage } from '../utils/errorUtils';
import { formatWibTimeHHmm } from '../utils/timezone';

export const MAX_WA_RECIPIENT_SLOTS = 4;

export type WaGatewayId = 'gateway1' | 'gateway2';
export type WaGatewayMode = 'failover' | 'parallel';

export interface WaGatewayConfig {
  id: WaGatewayId;
  label: string;
  enabled: boolean;
  provider: WaGatewayProviderType;
  apiUrl: string;
  apiToken: string;
  maskedToken?: string;
}

export interface WaRecipientSlot {
  slot: number;
  label: string;
  number: string;
  enabled: boolean;
}

export interface WaConfigData {
  id: string;
  isEnabled: boolean;
  cooldownMinutes: number; // Minimal 1, default 15, DILARANG 0
  lastSentAt: string | null;
  activeHoursStart: string | null; // Contoh: "08:00"
  activeHoursEnd: string | null;   // Contoh: "17:00"
  alertOnOutOfStock: boolean;
  alertOnLowStock: boolean;
  alertOnEarlyWarning: boolean;
  globalLowStockThreshold: number;
  globalEarlyWarningThreshold: number;
  recipients: string[]; // Nomor/grup aktif (maks 4, diturunkan dari slot ON)
  recipientSlots: WaRecipientSlot[]; // Tepat 4 slot dengan saklar ON/OFF
  apiUrl: string;
  apiToken: string;
  maskedToken?: string;
  gatewayMode: WaGatewayMode;
  gateways: {
    gateway1: WaGatewayConfig;
    gateway2: WaGatewayConfig;
  };
  hasGatewayAccess?: boolean;
}

export interface ThresholdResolution {
  lowStockThreshold: number;
  lowStockSource: 'dari tipe' | 'dari produk' | 'dari global';
  earlyWarningThreshold: number;
  earlyWarningSource: 'dari tipe' | 'dari produk' | 'dari global';
  isWatchlist: boolean;
}

export interface WaDeliveryLogRecord {
  id: string;
  sent_at: string;
  trigger_type: string;
  recipients: string;
  message_snippet: string;
  summary_counts?: string;
  fonnte_status: 'SUCCESS' | 'FAILED' | 'SIMULATED' | 'COOLDOWN_QUEUED';
  fonnte_response?: string;
  operator_id?: string;
}

export type StockAlertStatus = 'NORMAL' | 'PERINGATAN_DINI' | 'MENIPIS' | 'HABIS';

export interface ThresholdMatrixEntry {
  produkId: number;
  produkNama: string;
  kategoriBarang: string;
  tipeId: number;
  tipeNama: string;
  kodeTipe: string;
  availableStock: number;
  lowStockThreshold: number;
  lowStockSource: 'dari tipe' | 'dari produk' | 'dari global';
  earlyWarningThreshold: number;
  earlyWarningSource: 'dari tipe' | 'dari produk' | 'dari global';
  isWatchlist: boolean;
  currentStatus: StockAlertStatus;
}

interface WaConfigRow {
  id?: string;
  is_enabled?: number | boolean;
  cooldown_minutes?: number | string;
  last_sent_at?: string | Date | null;
  active_hours_start?: string | null;
  active_hours_end?: string | null;
  alert_on_out_of_stock?: number | boolean;
  alert_on_low_stock?: number | boolean;
  alert_on_early_warning?: number | boolean;
  global_low_stock_threshold?: number | string;
  global_early_warning_threshold?: number | string;
  recipients_json?: string;
  recipient_slots_json?: string | null;
  api_url?: string;
  api_token?: string;
  gateways_json?: string | null;
  gateway_mode?: string | null;
}

interface WaThresholdRow {
  id: string;
  level: 'produk' | 'tipe';
  produk_id: number | null;
  tipe_id: number | null;
  low_stock_threshold: number | null;
  early_warning_threshold: number | null;
  is_watchlist: boolean | number;
}

interface ProdukSummaryRow {
  id: number;
  nama: string;
  kategori_barang?: string;
  tipe_stok?: string;
}

interface TipeSummaryRow {
  id: number;
  nama_tipe: string;
  prefix_id?: string | null;
  kode_tipe?: string;
  mode_stok?: 'per_id' | 'jumlah';
}

interface CountRow {
  count?: number | string;
  total?: number | string;
  rusak?: number | string;
}

function buildDefaultGateways(primaryUrl?: string, primaryToken?: string): {
  gateway1: WaGatewayConfig;
  gateway2: WaGatewayConfig;
} {
  const gw1Url = (primaryUrl || process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send').trim();
  const gw1Token = (primaryToken !== undefined ? primaryToken : process.env.WHATSAPP_API_TOKEN || '').trim();
  const gw2Url = (process.env.WHATSAPP_GATEWAY2_URL || 'https://api.fonnte.com/send').trim();
  const gw2Token = (process.env.WHATSAPP_GATEWAY2_TOKEN || '').trim();
  return {
    gateway1: {
      id: 'gateway1',
      label: 'Gateway 1 (Utama)',
      enabled: true,
      provider: 'fonnte',
      apiUrl: gw1Url,
      apiToken: gw1Token
    },
    gateway2: {
      id: 'gateway2',
      label: 'Gateway 2 (Cadangan)',
      enabled: Boolean(gw2Token),
      provider: 'fonnte',
      apiUrl: gw2Url,
      apiToken: gw2Token
    }
  };
}

// Memory fallback store for standalone testing
let localWaConfig: WaConfigData = {
  id: 'main',
  isEnabled: true,
  cooldownMinutes: 15,
  lastSentAt: null,
  activeHoursStart: null,
  activeHoursEnd: null,
  alertOnOutOfStock: true,
  alertOnLowStock: true,
  alertOnEarlyWarning: true,
  globalLowStockThreshold: 3,
  globalEarlyWarningThreshold: 5,
  recipients: ['081290008888'],
  recipientSlots: [
    { slot: 1, label: 'Penerima Utama', number: '081290008888', enabled: true },
    { slot: 2, label: '', number: '', enabled: false },
    { slot: 3, label: '', number: '', enabled: false },
    { slot: 4, label: '', number: '', enabled: false }
  ],
  apiUrl: process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send',
  apiToken: process.env.WHATSAPP_API_TOKEN || '',
  gatewayMode: 'failover',
  gateways: buildDefaultGateways()
};

const localThresholds = new Map<string, WaThresholdRow>();
const localAlertStatuses = new Map<string, { current: string; lastSent: string | null; pending: boolean }>();
const localLogs: WaDeliveryLogRecord[] = [];

function maskToken(token?: string): string {
  return token ? `${token.slice(0, 4)}••••••••` : 'Belum diisi';
}

function normalizeProviderType(val?: string | null): WaGatewayProviderType {
  if (val === 'wablas' || val === 'webhook') return val;
  return 'fonnte';
}

function normalizeGatewayMode(val?: string | null): WaGatewayMode {
  return val === 'parallel' ? 'parallel' : 'failover';
}

function normalizeGateways(
  rawGateways?: Partial<Record<WaGatewayId, Partial<WaGatewayConfig>>> | null,
  legacyUrl?: string,
  legacyToken?: string
): { gateway1: WaGatewayConfig; gateway2: WaGatewayConfig } {
  const defaults = buildDefaultGateways(legacyUrl, legacyToken);
  const raw1 = rawGateways?.gateway1 || {};
  const raw2 = rawGateways?.gateway2 || {};

  const gw1: WaGatewayConfig = {
    id: 'gateway1',
    label: typeof raw1.label === 'string' && raw1.label.trim() ? raw1.label.trim().slice(0, 60) : defaults.gateway1.label,
    enabled: raw1.enabled !== undefined ? Boolean(raw1.enabled) : defaults.gateway1.enabled,
    provider: normalizeProviderType(raw1.provider),
    apiUrl: typeof raw1.apiUrl === 'string' && raw1.apiUrl.trim() ? raw1.apiUrl.trim() : defaults.gateway1.apiUrl,
    apiToken: typeof raw1.apiToken === 'string' ? raw1.apiToken.trim() : defaults.gateway1.apiToken
  };

  const gw2: WaGatewayConfig = {
    id: 'gateway2',
    label: typeof raw2.label === 'string' && raw2.label.trim() ? raw2.label.trim().slice(0, 60) : defaults.gateway2.label,
    enabled: raw2.enabled !== undefined ? Boolean(raw2.enabled) : defaults.gateway2.enabled,
    provider: normalizeProviderType(raw2.provider),
    apiUrl: typeof raw2.apiUrl === 'string' && raw2.apiUrl.trim() ? raw2.apiUrl.trim() : defaults.gateway2.apiUrl,
    apiToken: typeof raw2.apiToken === 'string' ? raw2.apiToken.trim() : defaults.gateway2.apiToken
  };

  return { gateway1: gw1, gateway2: gw2 };
}

function sanitizeConfigForClient(config: WaConfigData, isDeveloper: boolean = true): WaConfigData {
  const gw1 = config.gateways?.gateway1 || buildDefaultGateways(config.apiUrl, config.apiToken).gateway1;
  const gw2 = config.gateways?.gateway2 || buildDefaultGateways(config.apiUrl, config.apiToken).gateway2;

  if (!isDeveloper) {
    return {
      ...config,
      apiUrl: '',
      apiToken: '',
      maskedToken: 'Khusus Developer',
      hasGatewayAccess: false,
      gateways: {
        gateway1: {
          id: 'gateway1',
          label: gw1.label,
          enabled: gw1.enabled,
          provider: gw1.provider,
          apiUrl: '',
          apiToken: '',
          maskedToken: 'Khusus Developer'
        },
        gateway2: {
          id: 'gateway2',
          label: gw2.label,
          enabled: gw2.enabled,
          provider: gw2.provider,
          apiUrl: '',
          apiToken: '',
          maskedToken: 'Khusus Developer'
        }
      }
    };
  }

  return {
    ...config,
    apiToken: '',
    maskedToken: maskToken(gw1.apiToken || config.apiToken),
    hasGatewayAccess: true,
    gateways: {
      gateway1: {
        ...gw1,
        apiToken: '',
        maskedToken: maskToken(gw1.apiToken)
      },
      gateway2: {
        ...gw2,
        apiToken: '',
        maskedToken: maskToken(gw2.apiToken)
      }
    }
  };
}

export class WhatsappAlertService {
  /**
   * 1. Sanitasi & Deduplikasi Daftar Penerima (Grup / Nomor)
   */
  static deduplicateRecipients(recipients: string | string[]): string[] {
    let list: string[] = [];
    if (Array.isArray(recipients)) {
      list = recipients;
    } else if (typeof recipients === 'string') {
      list = recipients.split(/[,;\n]/);
    }

    const uniqueSet = new Set<string>();
    for (const item of list) {
      const clean = item.trim();
      if (clean.length > 0) {
        uniqueSet.add(clean);
      }
    }

    return Array.from(uniqueSet);
  }

  /**
   * Normalisasi 4 slot penerima tetap dengan saklar ON/OFF per nomor
   */
  static normalizeRecipientSlots(
    rawSlots?: Array<Partial<WaRecipientSlot>> | null,
    fallbackRecipients?: string[]
  ): WaRecipientSlot[] {
    const result: WaRecipientSlot[] = [];
    const seenNumbers = new Set<string>();

    if (Array.isArray(rawSlots) && rawSlots.length > 0) {
      for (let i = 0; i < MAX_WA_RECIPIENT_SLOTS; i++) {
        const entry = rawSlots[i];
        const cleanNum = entry && typeof entry.number === 'string' ? entry.number.trim() : '';
        const cleanLabel = entry && typeof entry.label === 'string' ? entry.label.trim().slice(0, 60) : '';
        if (cleanNum && seenNumbers.has(cleanNum)) {
          throw new Error(`Nomor WhatsApp "${cleanNum}" duplikat di lebih dari satu slot.`);
        }
        if (cleanNum) seenNumbers.add(cleanNum);
        result.push({
          slot: i + 1,
          label: cleanLabel,
          number: cleanNum,
          enabled: cleanNum.length > 0 ? (entry?.enabled !== undefined ? Boolean(entry.enabled) : true) : Boolean(entry?.enabled)
        });
      }
      return result;
    }

    const dedupedFallback = this.deduplicateRecipients(fallbackRecipients || []).slice(0, MAX_WA_RECIPIENT_SLOTS);
    for (let i = 0; i < MAX_WA_RECIPIENT_SLOTS; i++) {
      const num = dedupedFallback[i] || '';
      result.push({
        slot: i + 1,
        label: num && i === 0 ? 'Penerima Utama' : '',
        number: num,
        enabled: num.length > 0
      });
    }
    return result;
  }

  static getActiveRecipientsFromSlots(slots: WaRecipientSlot[]): string[] {
    const active: string[] = [];
    const seen = new Set<string>();
    for (const s of slots.slice(0, MAX_WA_RECIPIENT_SLOTS)) {
      const clean = (s.number || '').trim();
      if (s.enabled && clean.length > 0 && !seen.has(clean)) {
        seen.add(clean);
        active.push(clean);
      }
    }
    return active;
  }

  /**
   * Ambil konfigurasi internal lengkap termasuk raw apiToken (Hanya untuk internal server/provider)
   */
  private static async getInternalConfig(): Promise<WaConfigData> {
    try {
      const rows = await executeQuery<WaConfigRow>('SELECT * FROM wa_config WHERE id = "main" LIMIT 1');
      if (rows && rows.length > 0) {
        const r = rows[0];
        let recs: string[] = [];
        try {
          recs = JSON.parse(r.recipients_json || '[]');
        } catch {
          recs = this.deduplicateRecipients(r.recipients_json || '');
        }

        let parsedSlots: WaRecipientSlot[] | null = null;
        if (r.recipient_slots_json) {
          try {
            const rawParsed = JSON.parse(r.recipient_slots_json);
            if (Array.isArray(rawParsed)) {
              parsedSlots = this.normalizeRecipientSlots(rawParsed, recs);
            }
          } catch {
            parsedSlots = null;
          }
        }
        const slots = parsedSlots || this.normalizeRecipientSlots(null, recs);
        const activeRecipients = this.getActiveRecipientsFromSlots(slots);

        const resolvedUrl = r.api_url || process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send';
        const resolvedToken = r.api_token || process.env.WHATSAPP_API_TOKEN || '';
        let parsedGateways: Partial<Record<WaGatewayId, Partial<WaGatewayConfig>>> | null = null;
        if (r.gateways_json) {
          try {
            parsedGateways = JSON.parse(r.gateways_json);
          } catch {
            parsedGateways = null;
          }
        }
        const gateways = normalizeGateways(parsedGateways, resolvedUrl, resolvedToken);
        const gatewayMode = normalizeGatewayMode(r.gateway_mode);

        localWaConfig = {
          id: r.id || 'main',
          isEnabled: Boolean(r.is_enabled),
          cooldownMinutes: Math.max(1, parseInt(String(r.cooldown_minutes || '15'), 10)),
          lastSentAt: r.last_sent_at ? new Date(r.last_sent_at).toISOString() : null,
          activeHoursStart: r.active_hours_start || null,
          activeHoursEnd: r.active_hours_end || null,
          alertOnOutOfStock: Boolean(r.alert_on_out_of_stock),
          alertOnLowStock: Boolean(r.alert_on_low_stock),
          alertOnEarlyWarning: Boolean(r.alert_on_early_warning),
          globalLowStockThreshold: parseInt(String(r.global_low_stock_threshold || '3'), 10),
          globalEarlyWarningThreshold: parseInt(String(r.global_early_warning_threshold || '5'), 10),
          recipients: activeRecipients,
          recipientSlots: slots,
          apiUrl: gateways.gateway1.apiUrl,
          apiToken: gateways.gateway1.apiToken,
          maskedToken: maskToken(gateways.gateway1.apiToken),
          gatewayMode,
          gateways
        };
      }
    } catch {
      // Memory fallback
    }

    const gateways = normalizeGateways(localWaConfig.gateways, localWaConfig.apiUrl, localWaConfig.apiToken);
    return {
      ...localWaConfig,
      recipientSlots: this.normalizeRecipientSlots(localWaConfig.recipientSlots, localWaConfig.recipients),
      maskedToken: maskToken(gateways.gateway1.apiToken || localWaConfig.apiToken),
      gatewayMode: normalizeGatewayMode(localWaConfig.gatewayMode),
      gateways
    };
  }

  /**
   * 2. Ambil Konfigurasi WA Alert (Tersanitasi untuk klien; gateway hanya ditampilkan ke Developer)
   */
  static async getConfig(options?: { isDeveloper?: boolean }): Promise<WaConfigData> {
    const internal = await this.getInternalConfig();
    const isDeveloper = options?.isDeveloper !== false;
    return sanitizeConfigForClient(internal, isDeveloper);
  }

  /**
   * Ambil target aktif & kredensial untuk notifikasi internal (mis. pengajuan pembelian barang)
   */
  static async getActiveDeliveryConfig(): Promise<{
    isEnabled: boolean;
    recipients: string[];
    recipientSlots: WaRecipientSlot[];
    apiUrl: string;
    apiToken: string;
    gatewayMode: WaGatewayMode;
    gateways: { gateway1: WaGatewayConfig; gateway2: WaGatewayConfig };
  }> {
    const internal = await this.getInternalConfig();
    return {
      isEnabled: internal.isEnabled,
      recipients: this.getActiveRecipientsFromSlots(internal.recipientSlots),
      recipientSlots: internal.recipientSlots,
      apiUrl: internal.gateways.gateway1.apiUrl || internal.apiUrl,
      apiToken: internal.gateways.gateway1.apiToken || internal.apiToken,
      gatewayMode: internal.gatewayMode,
      gateways: internal.gateways
    };
  }

  /**
   * Eksekusi pengiriman via Gateway 1 & Gateway 2 sesuai mode (Failover atau Paralel)
   */
  static async dispatchThroughGateways(
    target: string,
    message: string,
    configOverride?: { gatewayMode: WaGatewayMode; gateways: { gateway1: WaGatewayConfig; gateway2: WaGatewayConfig } },
    customProvider?: WhatsAppProvider
  ): Promise<{ success: boolean; details: string; hasAnyToken: boolean; usedGateway: string | null }> {
    if (customProvider) {
      const res = await customProvider.sendMessage(target, message);
      return {
        success: res.success,
        details: res.details,
        hasAnyToken: true,
        usedGateway: 'custom'
      };
    }

    const internal = configOverride || (await this.getInternalConfig());
    const activeGateways = [internal.gateways.gateway1, internal.gateways.gateway2].filter((g) => g.enabled);

    if (activeGateways.length === 0) {
      return {
        success: false,
        details: 'Kedua Gateway WhatsApp (Gateway 1 & Gateway 2) sedang dimatikan (OFF).',
        hasAnyToken: false,
        usedGateway: null
      };
    }

    const hasAnyToken = activeGateways.some((g) => Boolean(g.apiToken) || g.provider === 'webhook');

    if (internal.gatewayMode === 'parallel') {
      const settled = await Promise.allSettled(
        activeGateways.map(async (gw) => {
          const provider = new FonnteProvider(gw.apiUrl, gw.apiToken, gw.provider);
          const res = await provider.sendMessage(target, message);
          return { gw, res };
        })
      );

      let anySuccess = false;
      const detailsList: string[] = [];
      const succeededGateways: string[] = [];

      for (const item of settled) {
        if (item.status === 'fulfilled') {
          detailsList.push(`[${item.value.gw.label}] ${item.value.res.details}`);
          if (item.value.res.success) {
            anySuccess = true;
            succeededGateways.push(item.value.gw.id);
          }
        } else {
          detailsList.push(`[Gateway Error] ${String(item.reason)}`);
        }
      }

      return {
        success: anySuccess,
        details: detailsList.join(' | '),
        hasAnyToken,
        usedGateway: succeededGateways.length > 0 ? succeededGateways.join('+') : null
      };
    }

    // Mode Failover Otomatis: coba Gateway aktif #1, jika gagal lanjut ke #2
    const attemptLogs: string[] = [];
    for (const gw of activeGateways) {
      const provider = new FonnteProvider(gw.apiUrl, gw.apiToken, gw.provider);
      try {
        const res = await provider.sendMessage(target, message);
        attemptLogs.push(`[${gw.label}] ${res.details}`);
        if (res.success) {
          return {
            success: true,
            details: attemptLogs.join(' -> Failover -> '),
            hasAnyToken,
            usedGateway: gw.id
          };
        }
      } catch (err: unknown) {
        attemptLogs.push(`[${gw.label}] Error: ${getErrorMessage(err)}`);
      }
    }

    return {
      success: false,
      details: attemptLogs.join(' -> Failover -> '),
      hasAnyToken,
      usedGateway: null
    };
  }

  /**
   * Catat log pengiriman dari layanan notifikasi eksternal (seperti pengajuan pembelian)
   */
  static async recordExternalDeliveryLog(entry: Omit<WaDeliveryLogRecord, 'id' | 'sent_at'>): Promise<void> {
    const logRecord: WaDeliveryLogRecord = {
      id: `walog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sent_at: new Date().toISOString(),
      ...entry
    };
    localLogs.unshift(logRecord);
    try {
      await executeQuery(
        `INSERT INTO wa_delivery_logs (id, trigger_type, recipients, message_snippet, summary_counts, fonnte_status, fonnte_response, operator_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logRecord.id,
          logRecord.trigger_type,
          logRecord.recipients,
          logRecord.message_snippet,
          logRecord.summary_counts || null,
          logRecord.fonnte_status,
          logRecord.fonnte_response || null,
          logRecord.operator_id || 'system'
        ]
      );
    } catch {
      // Non-fatal in memory mode
    }
  }

  /**
   * 3. Update Konfigurasi WA Alert (Dilarang Jeda 0 Menit! Maksimal 4 slot nomor penerima)
   */
  static async updateConfig(
    payload: Partial<WaConfigData> & {
      gateways?: Partial<Record<WaGatewayId, Partial<WaGatewayConfig>>>;
    },
    operator: { id: string; name: string },
    options?: { allowGatewayEdit?: boolean }
  ): Promise<WaConfigData> {
    // Validasi aturan jeda minimal
    if (payload.cooldownMinutes !== undefined) {
      const cd = Number(payload.cooldownMinutes);
      if (isNaN(cd) || cd < 1) {
        throw new Error('Jeda antar alert (cooldown) minimal 1 menit dan tidak boleh 0 menit.');
      }
    }

    const current = await this.getInternalConfig();
    let updatedSlots: WaRecipientSlot[];

    if (Array.isArray(payload.recipientSlots)) {
      const nonEmptySlots = payload.recipientSlots.filter(s => s && String(s.number || '').trim().length > 0);
      if (payload.recipientSlots.length > MAX_WA_RECIPIENT_SLOTS || nonEmptySlots.length > MAX_WA_RECIPIENT_SLOTS) {
        throw new Error(`Maksimal ${MAX_WA_RECIPIENT_SLOTS} nomor penerima WhatsApp yang diperbolehkan.`);
      }
      updatedSlots = this.normalizeRecipientSlots(payload.recipientSlots);
    } else if (payload.recipients !== undefined) {
      const deduped = this.deduplicateRecipients(payload.recipients);
      if (deduped.length > MAX_WA_RECIPIENT_SLOTS) {
        throw new Error(`Maksimal ${MAX_WA_RECIPIENT_SLOTS} nomor penerima WhatsApp yang diperbolehkan.`);
      }
      updatedSlots = this.normalizeRecipientSlots(null, deduped);
    } else {
      updatedSlots = this.normalizeRecipientSlots(current.recipientSlots, current.recipients);
    }

    const updatedRecipients = this.getActiveRecipientsFromSlots(updatedSlots);
    const canEditGateway = options?.allowGatewayEdit !== false;

    const currentGw1 = current.gateways.gateway1;
    const currentGw2 = current.gateways.gateway2;
    let nextGateways = { gateway1: { ...currentGw1 }, gateway2: { ...currentGw2 } };
    let nextGatewayMode = current.gatewayMode;

    if (canEditGateway) {
      if (payload.gatewayMode !== undefined) {
        nextGatewayMode = normalizeGatewayMode(payload.gatewayMode);
      }
      const inGw1 = payload.gateways?.gateway1;
      const inGw2 = payload.gateways?.gateway2;

      const resolvedGw1Url =
        inGw1?.apiUrl && inGw1.apiUrl.trim()
          ? inGw1.apiUrl.trim()
          : payload.apiUrl && payload.apiUrl.trim()
            ? payload.apiUrl.trim()
            : currentGw1.apiUrl;
      const resolvedGw1Token =
        inGw1?.apiToken && inGw1.apiToken.trim()
          ? inGw1.apiToken.trim()
          : payload.apiToken && payload.apiToken.trim()
            ? payload.apiToken.trim()
            : currentGw1.apiToken;

      nextGateways = {
        gateway1: {
          id: 'gateway1',
          label: inGw1?.label && inGw1.label.trim() ? inGw1.label.trim().slice(0, 60) : currentGw1.label,
          enabled: inGw1?.enabled !== undefined ? Boolean(inGw1.enabled) : currentGw1.enabled,
          provider: inGw1?.provider !== undefined ? normalizeProviderType(inGw1.provider) : currentGw1.provider,
          apiUrl: resolvedGw1Url,
          apiToken: resolvedGw1Token
        },
        gateway2: {
          id: 'gateway2',
          label: inGw2?.label && inGw2.label.trim() ? inGw2.label.trim().slice(0, 60) : currentGw2.label,
          enabled: inGw2?.enabled !== undefined ? Boolean(inGw2.enabled) : currentGw2.enabled,
          provider: inGw2?.provider !== undefined ? normalizeProviderType(inGw2.provider) : currentGw2.provider,
          apiUrl: inGw2?.apiUrl && inGw2.apiUrl.trim() ? inGw2.apiUrl.trim() : currentGw2.apiUrl,
          apiToken: inGw2?.apiToken && inGw2.apiToken.trim() ? inGw2.apiToken.trim() : currentGw2.apiToken
        }
      };
    }

    const merged: WaConfigData = {
      ...current,
      isEnabled: payload.isEnabled !== undefined ? Boolean(payload.isEnabled) : current.isEnabled,
      cooldownMinutes: payload.cooldownMinutes !== undefined ? Math.max(1, Number(payload.cooldownMinutes)) : current.cooldownMinutes,
      activeHoursStart: payload.activeHoursStart !== undefined ? payload.activeHoursStart : current.activeHoursStart,
      activeHoursEnd: payload.activeHoursEnd !== undefined ? payload.activeHoursEnd : current.activeHoursEnd,
      alertOnOutOfStock: payload.alertOnOutOfStock !== undefined ? Boolean(payload.alertOnOutOfStock) : current.alertOnOutOfStock,
      alertOnLowStock: payload.alertOnLowStock !== undefined ? Boolean(payload.alertOnLowStock) : current.alertOnLowStock,
      alertOnEarlyWarning: payload.alertOnEarlyWarning !== undefined ? Boolean(payload.alertOnEarlyWarning) : current.alertOnEarlyWarning,
      globalLowStockThreshold: payload.globalLowStockThreshold !== undefined ? Math.max(1, Number(payload.globalLowStockThreshold)) : current.globalLowStockThreshold,
      globalEarlyWarningThreshold: payload.globalEarlyWarningThreshold !== undefined ? Math.max(1, Number(payload.globalEarlyWarningThreshold)) : current.globalEarlyWarningThreshold,
      recipients: updatedRecipients,
      recipientSlots: updatedSlots,
      apiUrl: nextGateways.gateway1.apiUrl,
      apiToken: nextGateways.gateway1.apiToken,
      gatewayMode: nextGatewayMode,
      gateways: nextGateways
    };

    localWaConfig = merged;

    try {
      await executeQuery(
        `UPDATE wa_config SET 
          is_enabled = ?, cooldown_minutes = ?, active_hours_start = ?, active_hours_end = ?,
          alert_on_out_of_stock = ?, alert_on_low_stock = ?, alert_on_early_warning = ?,
          global_low_stock_threshold = ?, global_early_warning_threshold = ?,
          recipients_json = ?, recipient_slots_json = ?, api_url = ?, api_token = ?,
          gateways_json = ?, gateway_mode = ?
        WHERE id = 'main'`,
        [
          merged.isEnabled ? 1 : 0,
          merged.cooldownMinutes,
          merged.activeHoursStart || null,
          merged.activeHoursEnd || null,
          merged.alertOnOutOfStock ? 1 : 0,
          merged.alertOnLowStock ? 1 : 0,
          merged.alertOnEarlyWarning ? 1 : 0,
          merged.globalLowStockThreshold,
          merged.globalEarlyWarningThreshold,
          JSON.stringify(merged.recipients),
          JSON.stringify(merged.recipientSlots),
          merged.apiUrl,
          merged.apiToken,
          JSON.stringify(merged.gateways),
          merged.gatewayMode
        ]
      );

      // Audit Log
      await executeQuery(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, after_state) VALUES (?, ?, ?, ?, ?)',
        [
          operator.id,
          'UPDATE_WA_CONFIG',
          'wa_config',
          'main',
          JSON.stringify({
            isEnabled: merged.isEnabled,
            cooldownMinutes: merged.cooldownMinutes,
            recipientsCount: merged.recipients.length,
            slotsConfigured: merged.recipientSlots.filter(s => s.number.length > 0).length,
            gatewayMode: merged.gatewayMode,
            gw1Enabled: merged.gateways.gateway1.enabled,
            gw2Enabled: merged.gateways.gateway2.enabled
          })
        ]
      );
    } catch {
      // Memory store fallback
    }

    return sanitizeConfigForClient(merged, canEditGateway);
  }

  private static async findThresholdRow(level: 'produk' | 'tipe', targetId: number): Promise<WaThresholdRow | undefined> {
    const cached = localThresholds.get(`${level}_${targetId}`);
    if (cached) return cached;

    const column = level === 'tipe' ? 'tipe_id' : 'produk_id';
    try {
      const rows = await executeQuery<WaThresholdRow>(
        `SELECT * FROM wa_thresholds WHERE level = ? AND ${column} = ? LIMIT 1`,
        [level, targetId]
      );
      if (rows && rows.length > 0) return rows[0];
    } catch {
      // Fallback to undefined when threshold table isn't populated
    }
    return undefined;
  }

  /**
   * 4. Resolusi Ambang Berjenjang: tipe > produk > global (Katalog tidak dipakai)
   */
  static async resolveThreshold(produkId?: number, tipeId?: number): Promise<ThresholdResolution> {
    const config = await this.getInternalConfig();
    let lowStockThreshold = config.globalLowStockThreshold;
    let lowStockSource: 'dari tipe' | 'dari produk' | 'dari global' = 'dari global';
    let earlyWarningThreshold = config.globalEarlyWarningThreshold;
    let earlyWarningSource: 'dari tipe' | 'dari produk' | 'dari global' = 'dari global';
    let isWatchlist = false;

    // 1. Cek level tipe (paling spesifik)
    if (tipeId) {
      const tipeRow = await this.findThresholdRow('tipe', tipeId);
      if (tipeRow) {
        if (tipeRow.low_stock_threshold !== null && tipeRow.low_stock_threshold !== undefined) {
          lowStockThreshold = Number(tipeRow.low_stock_threshold);
          lowStockSource = 'dari tipe';
        }
        if (tipeRow.early_warning_threshold !== null && tipeRow.early_warning_threshold !== undefined) {
          earlyWarningThreshold = Number(tipeRow.early_warning_threshold);
          earlyWarningSource = 'dari tipe';
        }
        if (tipeRow.is_watchlist) {
          isWatchlist = true;
        }
      }
    }

    // 2. Cek level produk (jika belum ditentukan dari tipe)
    if (produkId) {
      const prodRow = await this.findThresholdRow('produk', produkId);
      if (prodRow) {
        if (lowStockSource === 'dari global' && prodRow.low_stock_threshold !== null && prodRow.low_stock_threshold !== undefined) {
          lowStockThreshold = Number(prodRow.low_stock_threshold);
          lowStockSource = 'dari produk';
        }
        if (earlyWarningSource === 'dari global' && prodRow.early_warning_threshold !== null && prodRow.early_warning_threshold !== undefined) {
          earlyWarningThreshold = Number(prodRow.early_warning_threshold);
          earlyWarningSource = 'dari produk';
        }
        if (!isWatchlist && prodRow.is_watchlist) {
          isWatchlist = true;
        }
      }
    }

    return {
      lowStockThreshold,
      lowStockSource,
      earlyWarningThreshold,
      earlyWarningSource,
      isWatchlist
    };
  }

  /**
   * 5. Set Ambang / Watchlist Khusus untuk Produk atau Tipe
   */
  static async setThreshold(
    payload: {
      level: 'produk' | 'tipe';
      targetId: number;
      lowStockThreshold?: number | null;
      earlyWarningThreshold?: number | null;
      isWatchlist?: boolean;
    },
    operator: { id: string; name: string }
  ): Promise<WaThresholdRow> {
    const id = `thresh_${payload.level}_${payload.targetId}`;
    const row: WaThresholdRow = {
      id,
      level: payload.level,
      produk_id: payload.level === 'produk' ? payload.targetId : null,
      tipe_id: payload.level === 'tipe' ? payload.targetId : null,
      low_stock_threshold: payload.lowStockThreshold !== undefined ? payload.lowStockThreshold : null,
      early_warning_threshold: payload.earlyWarningThreshold !== undefined ? payload.earlyWarningThreshold : null,
      is_watchlist: Boolean(payload.isWatchlist)
    };

    localThresholds.set(`${payload.level}_${payload.targetId}`, row);

    try {
      await executeQuery(
        `INSERT INTO wa_thresholds (id, level, produk_id, tipe_id, low_stock_threshold, early_warning_threshold, is_watchlist)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           low_stock_threshold = VALUES(low_stock_threshold),
           early_warning_threshold = VALUES(early_warning_threshold),
           is_watchlist = VALUES(is_watchlist),
           updated_at = CURRENT_TIMESTAMP`,
        [
          row.id,
          row.level,
          row.produk_id,
          row.tipe_id,
          row.low_stock_threshold,
          row.early_warning_threshold,
          row.is_watchlist ? 1 : 0
        ]
      );

      // Audit Log
      await executeQuery(
        'INSERT INTO audit_logs (user_id, action, table_name, record_id, after_state) VALUES (?, ?, ?, ?, ?)',
        [operator.id, 'SET_WA_THRESHOLD', 'wa_thresholds', row.id, JSON.stringify(row)]
      );
    } catch {
      // Memory store fallback
    }

    return row;
  }

  /**
   * 6. Hitung Stok Tersedia (Item Rusak Dikecualikan, Konsisten dengan Tabel item & stok_jumlah)
   */
  static async getAvailableStockForTipe(tipeId: number, modeStok?: 'per_id' | 'jumlah'): Promise<number> {
    if (modeStok === 'jumlah') {
      try {
        const sjRows = await executeQuery<CountRow>(
          'SELECT COALESCE(SUM(GREATEST(0, jumlah - COALESCE(reserved_qty, 0))), 0) as total FROM stok_jumlah WHERE tipe_id = ?',
          [tipeId]
        );
        if (sjRows && sjRows.length > 0 && sjRows[0].total !== undefined) {
          return Number(sjRows[0].total);
        }
      } catch {
        // Fallback below
      }
      return Array.from(memoryStore.stok_jumlah.values())
        .filter((sj) => sj.tipe_id === tipeId)
        .reduce((acc, sj) => acc + Math.max(0, Number(sj.jumlah || 0) - Number(sj.reserved_qty || 0)), 0);
    }

    try {
      const rows = await executeQuery<CountRow>(
        `SELECT COUNT(*) as count FROM item 
         WHERE tipe_id = ? AND status = 'aktif' AND (kondisi IS NULL OR kondisi != 'Rusak')`,
        [tipeId]
      );
      if (rows && rows.length > 0) {
        const row = rows[0];
        if (row.count !== undefined && !isNaN(Number(row.count))) {
          return Number(row.count);
        }
        if (row.total !== undefined && row.rusak !== undefined) {
          return Math.max(0, Number(row.total) - Number(row.rusak));
        }
      }
    } catch {
      // Fallback below
    }

    const items = Array.from(memoryStore.item_v2.values()).filter(
      (it) => it.tipe_id === tipeId && it.status === 'aktif' && it.kondisi !== 'Rusak'
    );
    return items.length;
  }

  private static computeAlertStatus(availableStock: number, res: ThresholdResolution): StockAlertStatus {
    if (availableStock === 0) return 'HABIS';
    if (availableStock <= res.lowStockThreshold) return 'MENIPIS';
    if (res.isWatchlist && availableStock <= res.earlyWarningThreshold) return 'PERINGATAN_DINI';
    return 'NORMAL';
  }

  private static async buildThresholdMatrixEntry(
    prod: ProdukSummaryRow,
    tipe: TipeSummaryRow
  ): Promise<ThresholdMatrixEntry> {
    const res = await this.resolveThreshold(prod.id, tipe.id);
    const availableStock = await this.getAvailableStockForTipe(tipe.id, tipe.mode_stok);
    const currentStatus = this.computeAlertStatus(availableStock, res);

    return {
      produkId: prod.id,
      produkNama: prod.nama,
      kategoriBarang: prod.kategori_barang || 'Barang Habis Pakai',
      tipeId: tipe.id,
      tipeNama: tipe.nama_tipe,
      kodeTipe: tipe.prefix_id || tipe.kode_tipe || `T-${tipe.id}`,
      availableStock,
      lowStockThreshold: res.lowStockThreshold,
      lowStockSource: res.lowStockSource,
      earlyWarningThreshold: res.earlyWarningThreshold,
      earlyWarningSource: res.earlyWarningSource,
      isWatchlist: res.isWatchlist,
      currentStatus
    };
  }

  /**
   * 7. Ambil Seluruh Data Resolusi Ambang untuk Seluruh Tipe & Produk
   * (Menampilkan sumber: "dari tipe", "dari produk", "dari global")
   */
  static async getDetailedThresholdMatrix(): Promise<ThresholdMatrixEntry[]> {
    const list: ThresholdMatrixEntry[] = [];
    try {
      const prodRows = await executeQuery<ProdukSummaryRow>(
        'SELECT id, nama, kategori_barang, tipe_stok FROM produk WHERE aktif = 1'
      );
      for (const p of prodRows) {
        const tipeRows = await executeQuery<TipeSummaryRow>(
          'SELECT id, nama_tipe, prefix_id, mode_stok FROM tipe WHERE produk_id = ? AND aktif = 1',
          [p.id]
        );
        for (const t of tipeRows) {
          list.push(await this.buildThresholdMatrixEntry(p, t));
        }
      }
      return list;
    } catch {
      const prods = Array.from(memoryStore.produk.values()).filter((p) => p.aktif === 1 || p.aktif === true);
      for (const p of prods) {
        const tipes = Array.from(memoryStore.tipe.values()).filter(
          (t) => t.produk_id === p.id && (t.aktif === 1 || t.aktif === true)
        );
        for (const t of tipes) {
          list.push(await this.buildThresholdMatrixEntry(p, t));
        }
      }
    }

    return list;
  }

  /**
   * 8. Evaluasi Status Stok dengan Anti-Duplikat Berbasis Status
   */
  static async evaluateStockAlerts(): Promise<{
    outOfStock: Array<{ sku: string; name: string; unit?: string }>;
    lowStock: Array<{ sku: string; name: string; quantity: number; unit?: string; threshold: number; source?: string }>;
    earlyWarning: Array<{ sku: string; name: string; quantity: number; unit?: string; threshold: number; source?: string }>;
    newAlertsCount: number;
  }> {
    const matrix = await this.getDetailedThresholdMatrix();
    const config = await this.getInternalConfig();

    const outOfStock: Array<{ sku: string; name: string; unit?: string }> = [];
    const lowStock: Array<{ sku: string; name: string; quantity: number; unit?: string; threshold: number; source?: string }> = [];
    const earlyWarning: Array<{ sku: string; name: string; quantity: number; unit?: string; threshold: number; source?: string }> = [];
    let newAlertsCount = 0;

    for (const item of matrix) {
      const targetId = `tipe_${item.tipeId}`;
      let statusRecord = localAlertStatuses.get(targetId);
      if (!statusRecord) {
        statusRecord = { current: item.currentStatus, lastSent: null, pending: false };
        localAlertStatuses.set(targetId, statusRecord);
      }

      statusRecord.current = item.currentStatus;

      // Anti-Duplikat: Jika status kembali ke NORMAL, reset status terkirim
      if (item.currentStatus === 'NORMAL') {
        statusRecord.lastSent = null;
        statusRecord.pending = false;
        continue;
      }

      // Jika statusnya berbeda dari alert terakhir yang dikirim, masukkan antrean
      if (item.currentStatus !== statusRecord.lastSent) {
        statusRecord.pending = true;
        newAlertsCount++;

        const entry = {
          sku: item.kodeTipe || `TP-${item.tipeId}`,
          name: `${item.produkNama} (${item.tipeNama})`,
          quantity: item.availableStock,
          unit: 'unit'
        };

        if (item.currentStatus === 'HABIS' && config.alertOnOutOfStock) {
          outOfStock.push(entry);
        } else if (item.currentStatus === 'MENIPIS' && config.alertOnLowStock) {
          lowStock.push({
            ...entry,
            threshold: item.lowStockThreshold,
            source: item.lowStockSource
          });
        } else if (item.currentStatus === 'PERINGATAN_DINI' && config.alertOnEarlyWarning) {
          earlyWarning.push({
            ...entry,
            threshold: item.earlyWarningThreshold,
            source: item.earlyWarningSource
          });
        }
      }
    }

    return { outOfStock, lowStock, earlyWarning, newAlertsCount };
  }

  /**
   * 9. Eksekusi Pengiriman Ringkasan Konsolidasi (Mematuhi Jeda 15 Menit Backend)
   */
  static async dispatchConsolidatedAlert(options?: {
    force?: boolean;
    triggerSource?: string;
    operator?: { id: string; name: string };
    provider?: WhatsAppProvider;
  }): Promise<{
    sent: boolean;
    reason?: string;
    inCooldown?: boolean;
    remainingSeconds?: number;
    message?: string;
    log?: WaDeliveryLogRecord;
  }> {
    const config = await this.getInternalConfig();

    if (!config.isEnabled && !options?.force) {
      return { sent: false, reason: 'ALERT_DISABLED', message: 'Sistem WA Alert sedang dinonaktifkan di konfigurasi.' };
    }

    // Cek Jam Aktif (WIB) jika dikonfigurasi
    if (config.activeHoursStart && config.activeHoursEnd && !options?.force) {
      const nowStr = formatWibTimeHHmm(new Date()); // "HH:MM" WIB
      if (nowStr < config.activeHoursStart || nowStr > config.activeHoursEnd) {
        return { sent: false, reason: 'OUTSIDE_ACTIVE_HOURS', message: `Di luar jam aktif pengiriman WIB (${config.activeHoursStart} - ${config.activeHoursEnd}).` };
      }
    }

    // Cek Cooldown 15 Menit di Backend
    const nowMs = Date.now();
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    if (config.lastSentAt && !options?.force) {
      const lastMs = new Date(config.lastSentAt).getTime();
      const elapsed = nowMs - lastMs;
      if (elapsed < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
        return {
          sent: false,
          inCooldown: true,
          remainingSeconds,
          message: `Jeda pengiriman WhatsApp (${config.cooldownMinutes} menit) masih aktif. Tersisa ${remainingSeconds} detik.`
        };
      }
    }

    // Evaluasi seluruh stok dan kumpulkan ringkasan
    const evaluation = await this.evaluateStockAlerts();
    const hasItems = evaluation.outOfStock.length > 0 || evaluation.lowStock.length > 0 || evaluation.earlyWarning.length > 0;

    if (!hasItems && !options?.force) {
      return { sent: false, reason: 'NO_ALERTS', message: 'Tidak ada perubahan status stok yang memerlukan alert.' };
    }

    // Format Pesan Ringkasan Tunggal (3 Jenis Pesan Otomatis Tanpa Teks Bebas)
    const formattedMessage = formatConsolidatedStockAlertMessage({
      outOfStock: evaluation.outOfStock,
      lowStock: evaluation.lowStock,
      earlyWarning: evaluation.earlyWarning,
      triggerSource: options?.triggerSource || 'Audit Mutasi Stok FieldOps IT',
      cooldownWindowMinutes: config.cooldownMinutes
    });

    const uniqueRecipients = this.deduplicateRecipients(config.recipients);
    if (uniqueRecipients.length === 0) {
      return { sent: false, reason: 'NO_RECIPIENTS', message: 'Daftar penerima WhatsApp belum diisi.' };
    }

    // Kirim via Dual Gateway (Failover / Paralel) atau customProvider untuk pengujian
    const targetStr = uniqueRecipients.join(',');
    const dispatchRes = await this.dispatchThroughGateways(targetStr, formattedMessage, config, options?.provider);
    const sendSuccess = dispatchRes.success;
    const fonnteResponse = dispatchRes.details;

    const logRecord: WaDeliveryLogRecord = {
      id: `walog_${Date.now()}`,
      sent_at: new Date().toISOString(),
      trigger_type: options?.triggerSource || 'CONSOLIDATED_ALERT',
      recipients: uniqueRecipients.join(', '),
      message_snippet: formattedMessage.slice(0, 160) + '...',
      summary_counts: JSON.stringify({
        habis: evaluation.outOfStock.length,
        menipis: evaluation.lowStock.length,
        dini: evaluation.earlyWarning.length,
        usedGateway: dispatchRes.usedGateway
      }),
      fonnte_status: sendSuccess ? 'SUCCESS' : (dispatchRes.hasAnyToken ? 'FAILED' : 'SIMULATED'),
      fonnte_response: fonnteResponse,
      operator_id: options?.operator?.id || 'system'
    };

    localLogs.unshift(logRecord);

    // Update last_sent_at pada konfigurasi
    localWaConfig.lastSentAt = new Date().toISOString();
    try {
      await executeQuery('UPDATE wa_config SET last_sent_at = CURRENT_TIMESTAMP WHERE id = "main"');
      await executeQuery(
        `INSERT INTO wa_delivery_logs (id, trigger_type, recipients, message_snippet, summary_counts, fonnte_status, fonnte_response, operator_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logRecord.id,
          logRecord.trigger_type,
          logRecord.recipients,
          logRecord.message_snippet,
          logRecord.summary_counts,
          logRecord.fonnte_status,
          logRecord.fonnte_response,
          logRecord.operator_id
        ]
      );
    } catch {
      // Memory store fallback
    }

    // Tandai status alert telah terkirim (Anti-Duplikat)
    for (const record of localAlertStatuses.values()) {
      if (record.pending) {
        record.lastSent = record.current;
        record.pending = false;
      }
    }

    return {
      sent: true,
      message: `Berhasil mengirim pesan ringkasan alert ke ${uniqueRecipients.length} target unik.`,
      log: logRecord
    };
  }

  /**
   * 10. Pengiriman Pesan Uji Koneksi (Juga Kena Batas 15 Menit)
   */
  static async sendTestMessage(
    targetPhone?: string,
    operator?: { id: string; name: string },
    customProvider?: WhatsAppProvider
  ): Promise<{ success: boolean; message: string; remainingSeconds?: number; details?: string }> {
    const config = await this.getInternalConfig();
    const nowMs = Date.now();
    const cooldownMs = config.cooldownMinutes * 60 * 1000;

    // Batasan 15 menit juga berlaku untuk pengiriman pesan uji!
    if (config.lastSentAt) {
      const lastMs = new Date(config.lastSentAt).getTime();
      const elapsed = nowMs - lastMs;
      if (elapsed < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
        throw new Error(
          `Batas jeda pengiriman WhatsApp (${config.cooldownMinutes} menit) masih aktif. Mohon tunggu ${remainingSeconds} detik sebelum mengirim pesan uji lagi.`
        );
      }
    }

    const targets = targetPhone
      ? this.deduplicateRecipients([targetPhone])
      : this.deduplicateRecipients(config.recipients);

    if (targets.length === 0) {
      throw new Error('Nomor tujuan atau grup penerima belum diisi.');
    }

    const targetStr = targets.join(',');
    const testMessage = formatTestConnectionMessage(targetStr);
    const result = await this.dispatchThroughGateways(targetStr, testMessage, config, customProvider);

    // Update cooldown
    localWaConfig.lastSentAt = new Date().toISOString();
    try {
      await executeQuery('UPDATE wa_config SET last_sent_at = CURRENT_TIMESTAMP WHERE id = "main"');
    } catch {
      // Memory store fallback
    }

    const logRecord: WaDeliveryLogRecord = {
      id: `walog_test_${Date.now()}`,
      sent_at: new Date().toISOString(),
      trigger_type: 'TEST_MESSAGE',
      recipients: targetStr,
      message_snippet: testMessage.slice(0, 120),
      fonnte_status: result.success ? 'SUCCESS' : (result.hasAnyToken ? 'FAILED' : 'SIMULATED'),
      fonnte_response: result.details,
      operator_id: operator?.id || 'manual'
    };

    localLogs.unshift(logRecord);

    return {
      success: true,
      message: result.success
        ? `Uji koneksi WhatsApp berhasil dikirim ke ${targets.length} penerima!`
        : `Pesan uji dikirim dalam mode simulasi backend (${result.details}).`,
      details: result.details
    };
  }

  /**
   * 10b. Pengiriman Uji Khusus Satu Gateway (Khusus Developer - menguji Gateway 1 atau Gateway 2)
   */
  static async sendTestGateway(
    gatewayId: WaGatewayId,
    targetPhone: string | undefined,
    operator: { id: string; name: string },
    customProvider?: WhatsAppProvider
  ): Promise<{ success: boolean; gatewayId: WaGatewayId; message: string; details: string }> {
    const config = await this.getInternalConfig();
    const gw = config.gateways[gatewayId];
    if (!gw) {
      throw new Error(`Gateway "${gatewayId}" tidak ditemukan.`);
    }

    const targets = targetPhone
      ? this.deduplicateRecipients([targetPhone])
      : this.deduplicateRecipients(config.recipients);

    if (targets.length === 0) {
      throw new Error('Isi minimal satu nomor penerima atau masukkan nomor tujuan uji terlebih dahulu.');
    }

    const targetStr = targets.join(',');
    const testMessage = `[UJI ${gw.label.toUpperCase()}] ${formatTestConnectionMessage(targetStr)}`;
    const provider = customProvider || new FonnteProvider(gw.apiUrl, gw.apiToken, gw.provider);
    const res = await provider.sendMessage(targetStr, testMessage);

    await this.recordExternalDeliveryLog({
      trigger_type: gatewayId === 'gateway1' ? 'TEST_GATEWAY_1' : 'TEST_GATEWAY_2',
      recipients: targetStr,
      message_snippet: testMessage.slice(0, 140),
      summary_counts: JSON.stringify({ gatewayId, provider: gw.provider }),
      fonnte_status: res.success ? 'SUCCESS' : (gw.apiToken ? 'FAILED' : 'SIMULATED'),
      fonnte_response: `[${gw.label}] ${res.details}`,
      operator_id: operator.id
    });

    return {
      success: res.success,
      gatewayId,
      message: res.success
        ? `${gw.label} berhasil mengirim pesan uji ke ${targets.length} penerima.`
        : `Uji ${gw.label} selesai (${res.details}).`,
      details: res.details
    };
  }

  /**
   * 11. Riwayat Log Pengiriman
   */
  static async getLogs(limit: number = 50): Promise<WaDeliveryLogRecord[]> {
    try {
      const rows = await executeQuery<WaDeliveryLogRecord>(
        'SELECT * FROM wa_delivery_logs ORDER BY sent_at DESC LIMIT ?',
        [limit]
      );
      if (rows && rows.length > 0) return rows;
    } catch {
      // Memory store fallback
    }

    return localLogs.slice(0, limit);
  }

  /**
   * 12. Metode Penentuan "Segera Menipis" yang Ekstensibel
   * (Siap digunakan untuk estimasi sisa hari pemakaian tanpa mengubah skema)
   */
  static estimateDaysRemaining(stokTersedia: number, rataRataPemakaianHarian: number): number | null {
    if (rataRataPemakaianHarian <= 0) return null;
    return Math.floor(stokTersedia / rataRataPemakaianHarian);
  }
}
