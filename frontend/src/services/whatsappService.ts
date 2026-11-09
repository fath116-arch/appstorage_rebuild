/**
 * WhatsApp Gateway Service Helper
 * FieldOps IT Inventory v1.2.5 Paket 6
 * Handles communication with Express backend /api/whatsapp endpoints
 */

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

const getHeaders = () => ({
  'Content-Type': 'application/json',
});

export class WhatsAppService {
  /**
   * Load stored config from Express backend
   */
  async getConfig(): Promise<WhatsAppConfigData> {
    try {
      const res = await fetch('/api/whatsapp/config', {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          return data.config;
        }
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
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(config),
      });
      const data = await res.json();
      return {
        success: res.ok,
        message: data.message || (res.ok ? 'Konfigurasi tersimpan' : 'Gagal menyimpan konfigurasi'),
        config: data.config
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Gagal menghubungi server backend.'
      };
    }
  }

  /**
   * Fetch hierarchical threshold matrix (showing source: "dari tipe", "dari produk", "dari global")
   */
  async getThresholds(): Promise<ThresholdMatrixItem[]> {
    try {
      const res = await fetch('/api/whatsapp/thresholds', {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
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
      const res = await fetch('/api/whatsapp/thresholds', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return {
        success: res.ok,
        message: data.message || (res.ok ? 'Ambang berhasil diperbarui' : 'Gagal mengubah ambang')
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Gagal menyimpan ambang khusus.'
      };
    }
  }

  /**
   * Test WhatsApp Gateway Connection (Subject to 15-minute cooldown)
   */
  async testConnection(targetPhone?: string): Promise<{ success: boolean; message: string; remainingSeconds?: number; details?: string }> {
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ targetPhone }),
      });
      const data = await res.json();
      return {
        success: res.ok && data.success !== false,
        message: data.message || (res.ok ? 'Uji koneksi terkirim' : `Gagal HTTP ${res.status}`),
        remainingSeconds: data.remainingSeconds,
        details: data.details,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menghubungi server backend: ${err.message || err}`,
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
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        sent: false,
        message: err.message || 'Gagal memicu pengiriman alert ringkasan.'
      };
    }
  }

  /**
   * Fetch WhatsApp Log History
   */
  async getLogs(limit: number = 50): Promise<WaLogItem[]> {
    try {
      const res = await fetch(`/api/whatsapp/logs?limit=${limit}`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (err) {
      console.warn('Failed to load WA logs:', err);
    }
    return [];
  }
}

export const whatsappService = new WhatsAppService();
