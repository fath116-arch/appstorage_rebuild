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

export interface ConsolidatedSummaryInput {
  outOfStock: Array<{ sku: string; name: string; unit?: string }>;
  lowStock: Array<{ sku: string; name: string; quantity: number; unit?: string; threshold: number; source?: string }>;
  earlyWarning: Array<{ sku: string; name: string; quantity: number; unit?: string; threshold: number; source?: string }>;
  triggerSource?: string;
  cooldownWindowMinutes?: number;
}

export function formatConsolidatedStockAlertMessage(input: ConsolidatedSummaryInput): string {
  const timeFormatted = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const sections: string[] = [];

  // 1. Bagian Stok Habis
  if (input.outOfStock && input.outOfStock.length > 0) {
    const list = input.outOfStock
      .map((it, idx) => `  ${idx + 1}. [${it.sku}] ${it.name} (Sisa: 0 ${it.unit || 'unit'})`)
      .join('\n');
    sections.push(`🚨 *STOK HABIS (0 UNIT)*:\n${list}`);
  }

  // 2. Bagian Stok Menipis
  if (input.lowStock && input.lowStock.length > 0) {
    const list = input.lowStock
      .map((it, idx) => `  ${idx + 1}. [${it.sku}] ${it.name} - Sisa: ${it.quantity} ${it.unit || 'unit'} (Ambang: ${it.threshold}${it.source ? ` [${it.source}]` : ''})`)
      .join('\n');
    sections.push(`⚠️ *STOK MENIPIS (PERLU RESTOCK)*:\n${list}`);
  }

  // 3. Bagian Peringatan Dini (Daftar Pantauan)
  if (input.earlyWarning && input.earlyWarning.length > 0) {
    const list = input.earlyWarning
      .map((it, idx) => `  ${idx + 1}. [${it.sku}] ${it.name} - Sisa: ${it.quantity} ${it.unit || 'unit'} (Ambang Dini: ${it.threshold}${it.source ? ` [${it.source}]` : ''})`)
      .join('\n');
    sections.push(`ℹ️ *PERLU DISIAPKAN (PERINGATAN DINI / DAFTAR PANTAUAN)*:\n${list}`);
  }

  const content = sections.join('\n\n');
  const source = input.triggerSource || 'Sistem Audit Otomatis FieldOps IT';
  const cooldownNote = input.cooldownWindowMinutes ? `\n(Ringkasan Konsolidasi Jendela ${input.cooldownWindowMinutes} Menit)` : '';

  return `📊 *[RINGKASAN ALERT STOK - FIELDOPS IT]*${cooldownNote}\nSumber: ${source}\nWaktu: ${timeFormatted}\n\n${content}\n\n_Mohon tim logistik & pengadaan gudang segera menindaklanjuti._`;
}


