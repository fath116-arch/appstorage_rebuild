/**
 * Notification Service (FieldOps Inventory v2 - Tahap 8 & Purchase Alert)
 * WhatsApp Gateway (Fonnte) Auto-Alert System
 * Menggunakan 4 slot nomor penerima + saklar ON/OFF dari WhatsappAlertService
 * dan hanya dipicu untuk Pengajuan Pembelian Barang (request_type = 'beli').
 */

import { executeQuery } from '../db/database';
import { FonnteProvider } from '../integrations/whatsapp/fonnte';
import {
  formatNewRequestMessage,
  formatPurchaseRequestMessage
} from '../integrations/whatsapp/templates';
import { WhatsappAlertService } from './whatsappAlertService';

export class NotificationService {
  /**
   * Mengambil nomor target aktif (maks 4 nomor dari slot ON di pengaturan WA).
   * Jika saklar master dimatikan atau seluruh slot OFF, mengembalikan [].
   */
  static async getTargetPhoneNumbers(): Promise<string[]> {
    try {
      const deliveryCfg = await WhatsappAlertService.getActiveDeliveryConfig();
      if (!deliveryCfg.isEnabled) {
        return [];
      }

      const activeFromSlots = deliveryCfg.recipients.slice(0, 4);
      if (activeFromSlots.length > 0) {
        return activeFromSlots;
      }

      // Jika seluruh slot kosong & belum ada nomor sama sekali, fallback env
      const hasAnyConfiguredSlot = deliveryCfg.recipientSlots.some(s => s.number.trim().length > 0);
      if (hasAnyConfiguredSlot) {
        // Semua nomor yang terdaftar sedang dimatikan (saklar OFF)
        return [];
      }

      const envPhones = String(process.env.WHATSAPP_TARGET_PHONES || '')
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .slice(0, 4);
      return envPhones;
    } catch {
      const envPhone = (process.env.WHATSAPP_TARGET_PHONES || '').trim();
      return envPhone ? [envPhone] : [];
    }
  }

  /**
   * Mengirim notifikasi WhatsApp KHUSUS untuk Pengajuan Pembelian Barang ('beli')
   * ke maksimal 4 nomor penerima yang saklarnya ON.
   * PENTING: Kegagalan kirim WA TIDAK BOLEH menggagalkan transaksi database!
   */
  static async notifyPurchaseRequest(input: {
    requestId: string;
    pemohonId: string;
    itemName: string;
    jumlah: number;
    satuan?: string;
    estimatedPrice?: number | null;
    alasan: string;
  }): Promise<{ attempted: boolean; targetsCount: number; skippedReason?: string }> {
    try {
      const deliveryCfg = await WhatsappAlertService.getActiveDeliveryConfig();
      if (!deliveryCfg.isEnabled) {
        return { attempted: false, targetsCount: 0, skippedReason: 'WA Gateway sedang dinonaktifkan.' };
      }

      const targets = await this.getTargetPhoneNumbers();
      if (targets.length === 0) {
        return { attempted: false, targetsCount: 0, skippedReason: 'Tidak ada nomor penerima WA yang saklarnya ON.' };
      }

      const userRows = await executeQuery<any>('SELECT name, username FROM users WHERE id = ?', [input.pemohonId]);
      const pemohonName = userRows && userRows.length > 0 ? (userRows[0].name || userRows[0].username) : input.pemohonId;

      const message = formatPurchaseRequestMessage({
        requestId: input.requestId,
        pemohonName,
        itemName: input.itemName,
        jumlah: input.jumlah,
        satuan: input.satuan,
        estimatedPrice: input.estimatedPrice,
        alasan: input.alasan
      });

      const apiUrl = deliveryCfg.apiUrl || process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send';
      const apiToken = deliveryCfg.apiToken || process.env.WHATSAPP_API_TOKEN || '';
      const provider = new FonnteProvider(apiUrl, apiToken);

      Promise.allSettled(targets.map(target => provider.sendMessage(target, message)))
        .then(async results => {
          const allOk = results.every(r => r.status === 'fulfilled' && r.value.success);
          const details = results
            .map(r => (r.status === 'fulfilled' ? r.value.details : String(r.reason)))
            .join(' | ');
          await WhatsappAlertService.recordExternalDeliveryLog({
            trigger_type: 'PURCHASE_REQUEST',
            recipients: targets.join(', '),
            message_snippet: message.slice(0, 160),
            summary_counts: JSON.stringify({ requestId: input.requestId, jumlah: input.jumlah }),
            fonnte_status: allOk ? 'SUCCESS' : (apiToken ? 'FAILED' : 'SIMULATED'),
            fonnte_response: details,
            operator_id: input.pemohonId
          });
        })
        .catch(err => {
          console.warn('[NotificationService] Peringatan pengiriman WA pembelian non-fatal:', err.message);
        });

      return { attempted: true, targetsCount: targets.length };
    } catch (err: any) {
      console.warn('[NotificationService] Gagal memicu notifikasi WA pembelian (non-fatal):', err.message);
      return { attempted: false, targetsCount: 0 };
    }
  }

  /**
   * Helper backward-compatible untuk pengujian internal
   */
  static async notifyNewRequest(input: {
    requestId: string;
    pemohonId: string;
    produkNama: string;
    tipeNama: string;
    jumlah: number;
    alasan: string;
  }): Promise<{ attempted: boolean; targetsCount: number }> {
    try {
      const deliveryCfg = await WhatsappAlertService.getActiveDeliveryConfig();
      const targets = await this.getTargetPhoneNumbers();
      if (!deliveryCfg.isEnabled || targets.length === 0) {
        return { attempted: false, targetsCount: 0 };
      }

      const userRows = await executeQuery<any>('SELECT name, username FROM users WHERE id = ?', [input.pemohonId]);
      const pemohonName = userRows && userRows.length > 0 ? (userRows[0].name || userRows[0].username) : input.pemohonId;

      const message = formatNewRequestMessage({
        requestId: input.requestId,
        pemohonName,
        produkNama: input.produkNama,
        tipeNama: input.tipeNama,
        jumlah: input.jumlah,
        alasan: input.alasan
      });

      const apiUrl = deliveryCfg.apiUrl || process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send';
      const apiToken = deliveryCfg.apiToken || process.env.WHATSAPP_API_TOKEN || '';
      const provider = new FonnteProvider(apiUrl, apiToken);

      Promise.allSettled(targets.map(target => provider.sendMessage(target, message)))
        .then(results => {
          console.log(`[NotificationService] Alert permohonan #${input.requestId} terkirim ke ${results.length} target.`);
        })
        .catch(err => {
          console.warn('[NotificationService] Peringatan pengiriman WA non-fatal:', err.message);
        });

      return { attempted: true, targetsCount: targets.length };
    } catch (err: any) {
      console.warn('[NotificationService] Gagal memicu notifikasi WA (non-fatal):', err.message);
      return { attempted: false, targetsCount: 0 };
    }
  }
}
