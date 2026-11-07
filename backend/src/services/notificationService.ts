/**
 * Notification Service (FieldOps Inventory v2 - Tahap 8)
 * WhatsApp Gateway (Fonnte) Auto-Alert System
 * Mengirim notifikasi asinkron tanpa menggagalkan transaksi utama
 */

import { executeQuery } from '../db/database';
import { FonnteProvider } from '../integrations/whatsapp/fonnte';
import { formatNewRequestMessage, formatLowStockAlertMessage } from '../integrations/whatsapp/templates';

export class NotificationService {
  /**
   * Mengambil nomor target notifikasi untuk developer, admin, dan warehouse_admin
   */
  static async getTargetPhoneNumbers(): Promise<string[]> {
    try {
      // 1. Ambil nomor dari konfigurasi whatsapp_config
      const configs = await executeQuery<any>('SELECT target_phones, auto_alert_enabled FROM whatsapp_config LIMIT 1');
      const phones = new Set<string>();

      if (configs && configs.length > 0 && configs[0].auto_alert_enabled) {
        const rawList = String(configs[0].target_phones || '').split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
        rawList.forEach((p: string) => phones.add(p));
      }

      // 2. Ambil nomor telepon pengguna ber-role developer, admin, atau warehouse_admin yang memiliki nomor telepon
      const users = await executeQuery<any>(
        `SELECT phone FROM users WHERE role IN ('developer', 'admin', 'warehouse_admin') AND status = 'ACTIVE' AND phone IS NOT NULL AND phone != ''`
      );

      if (users && users.length > 0) {
        users.forEach((u: any) => {
          const cleanPhone = String(u.phone).trim();
          if (cleanPhone.length > 0) phones.add(cleanPhone);
        });
      }

      // Fallback jika belum ada yang diset
      if (phones.size === 0) {
        phones.add(process.env.WHATSAPP_TARGET_PHONES || '081290008888');
      }

      return Array.from(phones);
    } catch {
      return [process.env.WHATSAPP_TARGET_PHONES || '081290008888'];
    }
  }

  /**
   * Mengirim alert request baru ke Developer, Admin, dan Admin Gudang
   * PENTING: Kegagalan kirim WA TIDAK BOLEH menggagalkan transaksi database!
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
      // Ambil nama pemohon
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

      const targets = await this.getTargetPhoneNumbers();
      const apiUrl = process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send';
      const apiToken = process.env.WHATSAPP_API_TOKEN || '';
      const provider = new FonnteProvider(apiUrl, apiToken);

      // Jalankan asinkron tanpa menunggu (fire and forget) untuk menjaga kecepatan API
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
