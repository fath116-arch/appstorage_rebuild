/**
 * WhatsApp Gateway Service Helper
 * FieldOps IT Inventory v1.2.5 Paket 6
 * Handles communication with Express backend /api/whatsapp endpoints
 */

import { getErrorMessage } from '../utils/errorUtils';
import { requestJson } from './httpClient';

export const MAX_WA_RECIPIENT_SLOTS = 4;

export interface WaRecipientSlot {
  slot: number;
  label: string;
  number: string;
  enabled: boolean;
}

export function normalizeWaRecipientSlots(
  slots?: WaRecipientSlot[] | null,
  legacyRecipients?: string[] | null
): WaRecipientSlot[] {
  const result: WaRecipientSlot[] = [];
  const seenNumbers = new Set<string>();

  if (Array.isArray(slots) && slots.length > 0) {
    for (let i = 0; i < MAX_WA_RECIPIENT_SLOTS; i++) {
      const src = slots[i];
      const rawNum = String(src?.number || '').trim();
      const dedupedNum = rawNum && !seenNumbers.has(rawNum) ? rawNum : '';
      if (dedupedNum) seenNumbers.add(dedupedNum);
      result.push({
        slot: i + 1,
        label: String(src?.label || '').trim(),
        number: dedupedNum,
        enabled: dedupedNum ? Boolean(src?.enabled ?? true) : Boolean(src?.enabled ?? false),
      });
    }
    return result;
  }

  const cleanLegacy = Array.isArray(legacyRecipients)
    ? Array.from(new Set(legacyRecipients.map((r) => String(r || '').trim()).filter(Boolean))).slice(0, MAX_WA_RECIPIENT_SLOTS)
    : [];

  for (let i = 0; i < MAX_WA_RECIPIENT_SLOTS; i++) {
    const num = cleanLegacy[i] || '';
    result.push({
      slot: i + 1,
      label: num ? (i === 0 ? 'Penerima Utama' : `Penerima ${i + 1}`) : '',
      number: num,
      enabled: Boolean(num),
    });
  }
  return result;
}

export interface WaGatewayConfig {
  id: 'gateway1' | 'gateway2';
  name: string;
  provider: 'fonnte' | 'wablas' | 'webhook';
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  maskedToken?: string;
}

export interface WhatsAppConfigData {
  id?: string;
  isEnabled: boolean;
  cooldownMinutes: number; // Minimal 1, default 15
  lastSentAt?: string | null;
  activeHoursStart?: string | null;
  activeHoursEnd?: string | null;
  alertOnOutOfStock: boolean;
  alertOnLowStock: boolean;
  alertOnEarlyWarning: boolean;
  globalLowStockThreshold: number;
  globalEarlyWarningThreshold: number;
  recipients: string[];
  recipientSlots?: WaRecipientSlot[];
  gatewayMode?: 'failover' | 'parallel';
  gateways?: {
    gateway1: WaGatewayConfig;
    gateway2: WaGatewayConfig;
  };
  hasGatewayAccess?: boolean;
  apiUrl: string;
  apiToken: string;
  maskedToken?: string;
}

export interface ThresholdMatrixItem {
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
  currentStatus: 'NORMAL' | 'PERINGATAN_DINI' | 'MENIPIS' | 'HABIS';
}

export interface WaLogItem {
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

export class WhatsAppService {
  /**
   * Load stored config from Express backend
   */
  async getConfig(): Promise<WhatsAppConfigData> {
    try {
      const { ok, data } = await requestJson<{ config?: WhatsAppConfigData }>('/api/whatsapp/config');
      if (ok && data.config) {
        const slots = normalizeWaRecipientSlots(data.config.recipientSlots, data.config.recipients);
        return {
          ...data.config,
          recipientSlots: slots,
          recipients: slots.filter((s) => s.enabled && s.number.trim()).map((s) => s.number.trim()),
        };
      }
    } catch (err) {
      console.warn('Failed to fetch WA config:', err);
    }

    const fallbackSlots = normalizeWaRecipientSlots(null, ['081290008888']);
    return {
      isEnabled: true,
      cooldownMinutes: 15,
      alertOnOutOfStock: true,
      alertOnLowStock: true,
      alertOnEarlyWarning: true,
      globalLowStockThreshold: 3,
      globalEarlyWarningThreshold: 5,
      recipients: ['081290008888'],
      recipientSlots: fallbackSlots,
      apiUrl: 'https://api.fonnte.com/send',
      apiToken: '',
    };
  }

  /**
   * Save config to backend Express server
   */
  async updateConfig(config: Partial<WhatsAppConfigData>): Promise<{ success: boolean; message: string; config?: WhatsAppConfigData }> {
    try {
      const { ok, data } = await requestJson<{ message?: string; config?: WhatsAppConfigData }>('/api/whatsapp/config', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      return {
        success: ok,
        message: data.message || (ok ? 'Konfigurasi tersimpan' : 'Gagal menyimpan konfigurasi'),
        config: data.config
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: getErrorMessage(err, 'Gagal menghubungi server backend.')
      };
    }
  }

  /**
   * Fetch hierarchical threshold matrix (showing source: "dari tipe", "dari produk", "dari global")
   */
  async getThresholds(): Promise<ThresholdMatrixItem[]> {
    try {
      const { ok, data } = await requestJson<{ thresholds?: ThresholdMatrixItem[] }>('/api/whatsapp/thresholds');
      if (ok) {
        return data.thresholds || [];
      }
    } catch (err) {
      console.warn('Failed to load threshold matrix:', err);
    }
    return [];
  }

  /**
   * Set specific threshold or toggle watchlist for product / type
   */
  async setThreshold(payload: {
    level: 'produk' | 'tipe';
    targetId: number;
    lowStockThreshold?: number | null;
    earlyWarningThreshold?: number | null;
    isWatchlist?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const { ok, data } = await requestJson<{ message?: string }>('/api/whatsapp/thresholds', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return {
        success: ok,
        message: data.message || (ok ? 'Ambang berhasil diperbarui' : 'Gagal mengubah ambang')
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: getErrorMessage(err, 'Gagal menyimpan ambang khusus.')
      };
    }
  }

  /**
   * Test WhatsApp Gateway Connection (Subject to 15-minute cooldown)
   */
  async testConnection(targetPhone?: string): Promise<{ success: boolean; message: string; remainingSeconds?: number; details?: string }> {
    try {
      const { ok, status, data } = await requestJson<{
        success?: boolean;
        message?: string;
        remainingSeconds?: number;
        details?: string;
      }>('/api/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ targetPhone }),
      });
      return {
        success: ok && data.success !== false,
        message: data.message || (ok ? 'Uji koneksi terkirim' : `Gagal HTTP ${status}`),
        remainingSeconds: data.remainingSeconds,
        details: data.details,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Gagal menghubungi server backend: ${getErrorMessage(err, 'Unknown error')}`,
      };
    }
  }

  /**
   * Developer-only test for a specific gateway (gateway1 or gateway2)
   */
  async testGateway(gatewayId: 'gateway1' | 'gateway2', targetPhone?: string): Promise<{ success: boolean; message: string; details?: string }> {
    try {
      const { ok, status, data } = await requestJson<{
        success?: boolean;
        message?: string;
        details?: string;
      }>('/api/whatsapp/test-gateway', {
        method: 'POST',
        body: JSON.stringify({ gatewayId, targetPhone }),
      });
      return {
        success: ok && data.success !== false,
        message: data.message || (ok ? 'Uji gateway terkirim' : `Gagal HTTP ${status}`),
        details: data.details,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Gagal menghubungi server backend: ${getErrorMessage(err, 'Unknown error')}`,
      };
    }
  }

  /**
   * Trigger Consolidated Summary Alert
   */
  async sendConsolidatedAlert(force: boolean = false): Promise<{
    sent: boolean;
    message?: string;
    inCooldown?: boolean;
    remainingSeconds?: number;
    log?: WaLogItem;
  }> {
    try {
      const { data } = await requestJson<{
        sent: boolean;
        message?: string;
        inCooldown?: boolean;
        remainingSeconds?: number;
        log?: WaLogItem;
      }>('/api/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ force }),
      });
      return data;
    } catch (err: unknown) {
      return {
        sent: false,
        message: getErrorMessage(err, 'Gagal memicu pengiriman alert ringkasan.')
      };
    }
  }

  /**
   * Fetch WhatsApp Log History
   */
  async getLogs(limit: number = 50): Promise<WaLogItem[]> {
    try {
      const { ok, data } = await requestJson<{ logs?: WaLogItem[] }>(`/api/whatsapp/logs?limit=${limit}`);
      if (ok) {
        return data.logs || [];
      }
    } catch (err) {
      console.warn('Failed to load WA logs:', err);
    }
    return [];
  }
}

export const whatsappService = new WhatsAppService();
