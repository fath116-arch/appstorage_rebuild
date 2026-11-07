/**
 * WhatsApp Message Templates
 * FieldOps IT Inventory
 */

export interface LowStockAlertItem {
  sku: string;
  name: string;
  quantity: number;
  unit?: string;
  min_stock_alert?: number;
  minStockAlert?: number;
}

export function formatLowStockAlertMessage(
  items: LowStockAlertItem[],
  triggerSource: string = 'Sistem Inventori FieldOps IT'
): string {
  const timeFormatted = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const itemListText = items
    .map((item, idx) => {
      const isOutOfStock = item.quantity === 0;
      const statusLabel = isOutOfStock ? '🚨 STOK HABIS' : '⚠️ STOK MENIPIS';
      const minAlert = item.min_stock_alert ?? item.minStockAlert ?? 2;
      return `${idx + 1}. [${item.sku}] ${item.name}\n   Status: ${statusLabel}\n   Sisa Stok: ${item.quantity} ${item.unit || 'pcs'} (Min Alert: ${minAlert} ${item.unit || 'pcs'})`;
    })
    .join('\n\n');

  return `⚠️ [ALERT STOK FIELD-OPS IT]\nSumber: ${triggerSource}\n\n${itemListText}\n\n⏰ Waktu Audit: ${timeFormatted}\n\nMohon segera ajukan PO restock ke tim pengadaan gudang.`;
}

export function formatTestConnectionMessage(targetPhone: string): string {
  return `✅ [UJI KONEKSI WHATSAPP FIELD-OPS IT]\nSistem backend server berhasil terhubung dengan Gateway WhatsApp.\n\n⏰ Waktu Uji: ${new Date().toLocaleString('id-ID')}\nTarget: ${targetPhone}\nStatus: ONLINE & SIAP TERIMA ALERT STOK.`;
}

export function formatNewRequestMessage(input: {
  requestId: string;
  pemohonName: string;
  produkNama: string;
  tipeNama: string;
  jumlah: number;
  alasan: string;
}): string {
  const timeFormatted = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return `📦 [PERMOHONAN BARANG BARU - FIELDOPS IT]
ID Request: ${input.requestId}
Pemohon: ${input.pemohonName}
Barang: ${input.produkNama} - ${input.tipeNama}
Jumlah: ${input.jumlah} unit
Alasan: ${input.alasan}
Waktu: ${timeFormatted}

Status: MENUNGGU PERSETUJUAN
Mohon Developer / Admin / Admin Gudang segera memproses melalui sistem.`;
}

