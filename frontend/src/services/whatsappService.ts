/**
 * WhatsApp Gateway Service Helper
 * FieldOps IT Inventory v1.2.5 Paket 6
 * Handles communication with Express backend /api/whatsapp endpoints
 */

import { getErrorMessage } from '../utils/errorUtils';
import { requestJson } from './httpClient';

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
        return data.config;
      }
    } catch (err) {
      console.warn('Failed to fetch WA config:', err);
    }

    return {
      isEnabled: true,
      cooldownMinutes: 15,
      alertOnOutOfStock: true,
      alertOnLowStock: true,
      alertOnEarlyWarning: true,
      globalLowStockThreshold: 3,
      globalEarlyWarningThreshold: 5,
      recipients: ['081290008888'],
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
