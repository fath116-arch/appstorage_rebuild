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

import { executeQuery, runTransaction, memoryStore } from '../db/database';
import { FonnteProvider } from '../integrations/whatsapp/fonnte';
import { formatConsolidatedStockAlertMessage, formatTestConnectionMessage } from '../integrations/whatsapp/templates';

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
  recipients: string[]; // Bebas duplikat
  apiUrl: string;
  apiToken: string;
  maskedToken?: string;
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
  apiUrl: process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send',
  apiToken: process.env.WHATSAPP_API_TOKEN || '',
};

const localThresholds = new Map<string, any>();
const localAlertStatuses = new Map<string, { current: string; lastSent: string | null; pending: boolean }>();
const localLogs: WaDeliveryLogRecord[] = [];

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
   * 2. Ambil Konfigurasi WA Alert
   */
  static async getConfig(): Promise<WaConfigData> {
    try {
      const rows = await executeQuery<any>('SELECT * FROM wa_config WHERE id = "main" LIMIT 1');
      if (rows && rows.length > 0) {
        const r = rows[0];
        let recs: string[] = [];
        try {
          recs = JSON.parse(r.recipients_json || '[]');
        } catch {
          recs = this.deduplicateRecipients(r.recipients_json || '');
        }

        localWaConfig = {
          id: r.id || 'main',
          isEnabled: Boolean(r.is_enabled),
          cooldownMinutes: Math.max(1, parseInt(r.cooldown_minutes || '15', 10)),
          lastSentAt: r.last_sent_at ? new Date(r.last_sent_at).toISOString() : null,
          activeHoursStart: r.active_hours_start || null,
          activeHoursEnd: r.active_hours_end || null,
          alertOnOutOfStock: Boolean(r.alert_on_out_of_stock),
          alertOnLowStock: Boolean(r.alert_on_low_stock),
          alertOnEarlyWarning: Boolean(r.alert_on_early_warning),
          globalLowStockThreshold: parseInt(r.global_low_stock_threshold || '3', 10),
          globalEarlyWarningThreshold: parseInt(r.global_early_warning_threshold || '5', 10),
          recipients: this.deduplicateRecipients(recs),
          apiUrl: r.api_url || 'https://api.fonnte.com/send',
          apiToken: r.api_token || '',
          maskedToken: r.api_token ? r.api_token.slice(0, 4) + '••••••••' : 'Belum diisi'
        };
      }
    } catch {
      // Memory fallback
    }

    return {
      ...localWaConfig,
      apiToken: '', // Sanitasi Keamanan: Raw token tidak pernah diekspos keluar
      maskedToken: localWaConfig.apiToken ? localWaConfig.apiToken.slice(0, 4) + '••••••••' : 'Belum diisi'
    };
  }

  /**
   * 3. Update Konfigurasi WA Alert (Dilarang Jeda 0 Menit!)
   */
  static async updateConfig(
    payload: Partial<WaConfigData>,
    operator: { id: string; name: string }
  ): Promise<WaConfigData> {
    // Validasi aturan jeda minimal
    if (payload.cooldownMinutes !== undefined) {
      const cd = Number(payload.cooldownMinutes);
      if (isNaN(cd) || cd < 1) {
        throw new Error('Jeda antar alert (cooldown) minimal 1 menit dan tidak boleh 0 menit.');
      }
    }

    const current = await this.getConfig();
    const updatedRecipients = payload.recipients !== undefined 
      ? this.deduplicateRecipients(payload.recipients) 
      : current.recipients;

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
      apiUrl: (payload.apiUrl && payload.apiUrl.trim()) ? payload.apiUrl.trim() : localWaConfig.apiUrl,
      apiToken: (payload.apiToken && payload.apiToken.trim()) ? payload.apiToken.trim() : localWaConfig.apiToken
    };

    localWaConfig = merged;

    try {
      await executeQuery(
        `UPDATE wa_config SET 
          is_enabled = ?, cooldown_minutes = ?, active_hours_start = ?, active_hours_end = ?,
          alert_on_out_of_stock = ?, alert_on_low_stock = ?, alert_on_early_warning = ?,
          global_low_stock_threshold = ?, global_early_warning_threshold = ?,
          recipients_json = ?, api_url = ?, api_token = ?
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
          merged.apiUrl,
          merged.apiToken
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
          JSON.stringify({ isEnabled: merged.isEnabled, cooldownMinutes: merged.cooldownMinutes, recipientsCount: merged.recipients.length })
        ]
      );
    } catch {
      // Memory store fallback
    }

    return {
      ...merged,
      maskedToken: merged.apiToken ? merged.apiToken.slice(0, 4) + '••••••••' : 'Belum diisi'
    };
  }

  /**
   * 4. Resolusi Ambang Berjenjang: tipe > produk > global (Katalog tidak dipakai)
   */
  static async resolveThreshold(produkId?: number, tipeId?: number): Promise<ThresholdResolution> {
    const config = await this.getConfig();
    let lowStockThreshold = config.globalLowStockThreshold;
    let lowStockSource: 'dari tipe' | 'dari produk' | 'dari global' = 'dari global';
    let earlyWarningThreshold = config.globalEarlyWarningThreshold;
    let earlyWarningSource: 'dari tipe' | 'dari produk' | 'dari global' = 'dari global';
    let isWatchlist = false;

    // 1. Cek level tipe (paling spesifik)
    if (tipeId) {
      let tipeRow: any = localThresholds.get(`tipe_${tipeId}`);
      if (!tipeRow) {
        try {
          const rows = await executeQuery<any>('SELECT * FROM wa_thresholds WHERE level = "tipe" AND tipe_id = ? LIMIT 1', [tipeId]);
          if (rows && rows.length > 0) tipeRow = rows[0];
        } catch {}
      }

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
      let prodRow: any = localThresholds.get(`produk_${produkId}`);
      if (!prodRow) {
        try {
          const rows = await executeQuery<any>('SELECT * FROM wa_thresholds WHERE level = "produk" AND produk_id = ? LIMIT 1', [produkId]);
          if (rows && rows.length > 0) prodRow = rows[0];
        } catch {}
      }

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
  ): Promise<any> {
    const id = `thresh_${payload.level}_${payload.targetId}`;
    const row = {
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
    } catch {}

    return row;
  }

  /**
   * 6. Hitung Stok Tersedia (Item Rusak Dikecualikan!)
   */
  static async getAvailableStockForTipe(tipeId: number): Promise<number> {
    try {
      // Kueri item_v2: abaikan item berkondisi 'Rusak' dan status selain 'aktif'
      const rows = await executeQuery<any>(
        `SELECT COUNT(*) as count FROM item_v2 
         WHERE tipe_id = ? AND status = 'aktif' AND kondisi != 'Rusak'`,
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
    } catch {}

    // Fallback kueri memoryStore
    const items = Array.from(memoryStore.item_v2.values()).filter(
      (it: any) => it.tipe_id === tipeId && it.status === 'aktif' && it.kondisi !== 'Rusak'
    );
    return items.length;
  }

  /**
   * 7. Ambil Seluruh Data Resolusi Ambang untuk Seluruh Tipe & Produk
   * (Menampilkan sumber: "dari tipe", "dari produk", "dari global")
   */
  static async getDetailedThresholdMatrix(): Promise<any[]> {
    const list: any[] = [];
    try {
      const prodRows = await executeQuery<any>('SELECT id, nama, kategori_barang, tipe_stok FROM produk WHERE status != "dihapus"');
      for (const p of prodRows) {
        const tipeRows = await executeQuery<any>('SELECT id, nama_tipe, kode_tipe, mode_stok FROM tipe WHERE produk_id = ? AND status != "dihapus"', [p.id]);
        for (const t of tipeRows) {
          const res = await this.resolveThreshold(p.id, t.id);
          const availableStock = await this.getAvailableStockForTipe(t.id);

          let currentStatus: 'NORMAL' | 'PERINGATAN_DINI' | 'MENIPIS' | 'HABIS' = 'NORMAL';
          if (availableStock === 0) {
            currentStatus = 'HABIS';
          } else if (availableStock <= res.lowStockThreshold) {
            currentStatus = 'MENIPIS';
          } else if (res.isWatchlist && availableStock <= res.earlyWarningThreshold) {
            currentStatus = 'PERINGATAN_DINI';
          }

          list.push({
            produkId: p.id,
            produkNama: p.nama,
            kategoriBarang: p.kategori_barang,
            tipeId: t.id,
            tipeNama: t.nama_tipe,
            kodeTipe: t.kode_tipe,
            availableStock,
            lowStockThreshold: res.lowStockThreshold,
            lowStockSource: res.lowStockSource,
            earlyWarningThreshold: res.earlyWarningThreshold,
            earlyWarningSource: res.earlyWarningSource,
            isWatchlist: res.isWatchlist,
            currentStatus
          });
        }
      }
    } catch {
      // Memory fallback from memoryStore.produk & tipe
      const prods = Array.from(memoryStore.produk.values()).filter(p => p.status !== 'dihapus');
      for (const p of prods) {
        const tipes = Array.from(memoryStore.tipe.values()).filter(t => t.produk_id === p.id && t.status !== 'dihapus');
        for (const t of tipes) {
          const res = await this.resolveThreshold(p.id, t.id);
          const availableStock = await this.getAvailableStockForTipe(t.id);
          let currentStatus: 'NORMAL' | 'PERINGATAN_DINI' | 'MENIPIS' | 'HABIS' = 'NORMAL';
          if (availableStock === 0) currentStatus = 'HABIS';
          else if (availableStock <= res.lowStockThreshold) currentStatus = 'MENIPIS';
          else if (res.isWatchlist && availableStock <= res.earlyWarningThreshold) currentStatus = 'PERINGATAN_DINI';

          list.push({
            produkId: p.id,
            produkNama: p.nama,
            kategoriBarang: p.kategori_barang || 'Barang Habis Pakai',
            tipeId: t.id,
            tipeNama: t.nama_tipe,
            kodeTipe: t.kode_tipe || `T-${t.id}`,
            availableStock,
            lowStockThreshold: res.lowStockThreshold,
            lowStockSource: res.lowStockSource,
            earlyWarningThreshold: res.earlyWarningThreshold,
            earlyWarningSource: res.earlyWarningSource,
            isWatchlist: res.isWatchlist,
            currentStatus
          });
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
    const config = await this.getConfig();

    const outOfStock: any[] = [];
    const lowStock: any[] = [];
    const earlyWarning: any[] = [];
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
  }): Promise<{
    sent: boolean;
    reason?: string;
    inCooldown?: boolean;
    remainingSeconds?: number;
    message?: string;
    log?: WaDeliveryLogRecord;
  }> {
    const config = await this.getConfig();

    if (!config.isEnabled && !options?.force) {
      return { sent: false, reason: 'ALERT_DISABLED', message: 'Sistem WA Alert sedang dinonaktifkan di konfigurasi.' };
    }

    // Cek Jam Aktif jika dikonfigurasi
    if (config.activeHoursStart && config.activeHoursEnd && !options?.force) {
      const nowStr = new Date().toTimeString().slice(0, 5); // "HH:MM"
      if (nowStr < config.activeHoursStart || nowStr > config.activeHoursEnd) {
        return { sent: false, reason: 'OUTSIDE_ACTIVE_HOURS', message: `Di luar jam aktif pengiriman (${config.activeHoursStart} - ${config.activeHoursEnd}).` };
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

    // Kirim via Fonnte Provider
    const provider = new FonnteProvider(config.apiUrl, config.apiToken);
    let sendSuccess = false;
    let fonnteResponse = '';

    try {
      // Fonnte bisa menerima multi-target dipisahkan koma atau pengiriman iteratif
      const targetStr = uniqueRecipients.join(',');
      const res = await provider.sendMessage(targetStr, formattedMessage);
      sendSuccess = res.success;
      fonnteResponse = res.details;
    } catch (err: any) {
      fonnteResponse = `Error: ${err.message}`;
    }

    const logRecord: WaDeliveryLogRecord = {
      id: `walog_${Date.now()}`,
      sent_at: new Date().toISOString(),
      trigger_type: options?.triggerSource || 'CONSOLIDATED_ALERT',
      recipients: uniqueRecipients.join(', '),
      message_snippet: formattedMessage.slice(0, 160) + '...',
      summary_counts: JSON.stringify({
        habis: evaluation.outOfStock.length,
        menipis: evaluation.lowStock.length,
        dini: evaluation.earlyWarning.length
      }),
      fonnte_status: sendSuccess ? 'SUCCESS' : (config.apiToken ? 'FAILED' : 'SIMULATED'),
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
    } catch {}

    // Tandai status alert telah terkirim (Anti-Duplikat)
    for (const [key, record] of localAlertStatuses.entries()) {
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
    operator?: { id: string; name: string }
  ): Promise<{ success: boolean; message: string; remainingSeconds?: number; details?: string }> {
    const config = await this.getConfig();
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
    const provider = new FonnteProvider(config.apiUrl, config.apiToken);
    const result = await provider.sendMessage(targetStr, testMessage);

    // Update cooldown
    localWaConfig.lastSentAt = new Date().toISOString();
    try {
      await executeQuery('UPDATE wa_config SET last_sent_at = CURRENT_TIMESTAMP WHERE id = "main"');
    } catch {}

    const logRecord: WaDeliveryLogRecord = {
      id: `walog_test_${Date.now()}`,
      sent_at: new Date().toISOString(),
      trigger_type: 'TEST_MESSAGE',
      recipients: targetStr,
      message_snippet: testMessage.slice(0, 120),
      fonnte_status: result.success ? 'SUCCESS' : (config.apiToken ? 'FAILED' : 'SIMULATED'),
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
   * 11. Riwayat Log Pengiriman
   */
  static async getLogs(limit: number = 50): Promise<WaDeliveryLogRecord[]> {
    try {
      const rows = await executeQuery<any>(
        'SELECT * FROM wa_delivery_logs ORDER BY sent_at DESC LIMIT ?',
        [limit]
      );
      if (rows && rows.length > 0) return rows;
    } catch {}

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
