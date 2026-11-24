/**
 * Excel Exporter Engine using ExcelJS
 * FieldOps IT Inventory - Generates valid .xlsx spreadsheet files
 * Enforces WIB (Asia/Jakarta) wall-clock timestamps & CWE-1236 formula sanitization
 */

import ExcelJS from 'exceljs';
import { Produk } from '../services/catalogApi';
import { CanonicalTransactionView } from '../services/activityApi';
import { sanitizeFormulaInput } from './security';
import { formatWibDateTime, getWibDateKey, toExcelWibWallDate } from './timezone';

export { sanitizeFormulaInput };

/**
 * Generate Excel workbook buffer for testing or server-side usage.
 * Supports canonical Produk[] as well as lightweight test objects.
 */
export async function generateInventoryExcelBuffer(items: Array<Produk | Record<string, any>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldOps IT';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Katalog Inventori');

  const titleRow = worksheet.addRow(['LAPORAN KATALOG INVENTORI LAPANGAN IT']);
  titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '0F172A' } };

  const subTitleRow = worksheet.addRow([
    `Tanggal Ditarik: ${formatWibDateTime(new Date())} | Total Master Items: ${items.length}`
  ]);
  subTitleRow.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };

  worksheet.addRow([]); // Blank spacer

  const headers = [
    'No',
    'Kode SKU / ID',
    'Kategori / Perputaran',
    'Nama Data Barang',
    'Jenis / Kategori',
    'Jumlah Stok',
    'Satuan',
    'Stok Dipesan',
    'Lokasi Penyimpanan',
    'Status Stok'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.height = 24;

  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0F172A' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  items.forEach((item: any, idx: number) => {
    const qty = Number(item.total_stok ?? item.quantity ?? 0);
    const reserved = Number(item.total_dipesan ?? 0);
    const sku = item.sku || `PROD-${item.id ?? idx + 1}`;
    const name = item.nama ?? item.name ?? '-';
    const categoryName = item.jenis_nama ?? item.category_name ?? item.categoryName ?? '-';
    const unit = item.tipe_stok ?? item.unit ?? 'unit';
    const turnover = item.kategori ?? item.barcode ?? '-';
    const location = item.location ?? (Array.isArray(item.tipes) ? `${item.tipes.length} varian` : '-');
    const statusRaw = String(item.status_stok || '').toUpperCase();
    const statusText = statusRaw
      ? statusRaw === 'HABIS'
        ? 'HABIS'
        : statusRaw === 'MENIPIS'
        ? 'MENIPIS'
        : 'AMAN'
      : qty === 0
      ? 'HABIS'
      : qty <= (item.min_stock_alert ?? item.minStockAlert ?? 0)
      ? 'STOK TIPIS'
      : 'AMAN';

    worksheet.addRow([
      idx + 1,
      sanitizeFormulaInput(String(sku)),
      sanitizeFormulaInput(String(turnover)),
      sanitizeFormulaInput(String(name)),
      sanitizeFormulaInput(String(categoryName)),
      qty,
      sanitizeFormulaInput(String(unit)),
      reserved,
      sanitizeFormulaInput(String(location)),
      statusText
    ]);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Helper to trigger download of a generated ExcelJS workbook as a valid .xlsx Blob
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Canonical Products & Tipe Variants Catalog to Excel (.xlsx)
 */
export async function exportProductsToExcel(
  products: Produk[],
  filename = `fieldops-katalog-${getWibDateKey(new Date())}.xlsx`
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldOps IT';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Katalog Inventori IT');

  const titleRow = worksheet.addRow(['LAPORAN KATALOG PRODUK & VARIAN INVENTORI IT']);
  titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '0F172A' } };

  const subTitleRow = worksheet.addRow([
    `Tanggal Ditarik: ${formatWibDateTime(new Date())} | Total Produk Aktif: ${products.length}`
  ]);
  subTitleRow.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };

  worksheet.addRow([]);

  const headers = [
    'No',
    'Jenis Barang',
    'Nama Produk',
    'Tipe / Varian',
    'Kategori Barang',
    'Perputaran',
    'Aturan ID',
    'Stok Tersedia',
    'Stok Dipesan',
    'Stok Rusak',
    'Satuan',
    'Status Stok',
    'Sebaran Box'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.height = 24;

  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0F172A' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  let rowNo = 0;
  let totalTersedia = 0;
  let totalDipesan = 0;
  let totalRusak = 0;

  for (const p of products) {
    const tipes = p.tipes || [];
    if (tipes.length === 0) {
      rowNo++;
      const avail = Number(p.total_stok || 0);
      const resv = Number(p.total_dipesan || 0);
      const dmg = Number(p.stok_rusak || 0);
      totalTersedia += avail;
      totalDipesan += resv;
      totalRusak += dmg;

      const statusUpper = String(p.status_stok || (avail === 0 ? 'habis' : 'aman')).toUpperCase();

      const row = worksheet.addRow([
        rowNo,
        sanitizeFormulaInput(p.jenis_nama || '-'),
        sanitizeFormulaInput(p.nama),
        '-',
        sanitizeFormulaInput(p.kategori_barang || 'Barang Habis Pakai'),
        sanitizeFormulaInput(p.kategori === 'fast_moving' ? 'Fast Moving' : 'Recycle / Aset'),
        '-',
        avail,
        resv,
        dmg,
        sanitizeFormulaInput(p.tipe_stok || 'unit'),
        statusUpper,
        '-'
      ]);
      row.height = 20;
      styleStatusCell(row.getCell(12), statusUpper);
    } else {
      for (const t of tipes) {
        rowNo++;
        const avail = Number(t.stok_tersedia || 0);
        const resv = Number(t.stok_dipesan || 0);
        const dmg = Number(t.stok_rusak || 0);
        totalTersedia += avail;
        totalDipesan += resv;
        totalRusak += dmg;

        const statusUpper = String(t.status_stok || (avail === 0 ? 'habis' : 'aman')).toUpperCase();
        const boxesText = (t.sebaran_box || []).map(b => `${b.box_kode}:${b.jumlah}`).join('; ') || '-';

        const row = worksheet.addRow([
          rowNo,
          sanitizeFormulaInput(p.jenis_nama || '-'),
          sanitizeFormulaInput(p.nama),
          sanitizeFormulaInput(t.nama_tipe),
          sanitizeFormulaInput(p.kategori_barang || 'Barang Habis Pakai'),
          sanitizeFormulaInput(p.kategori === 'fast_moving' ? 'Fast Moving' : 'Recycle / Aset'),
          sanitizeFormulaInput(t.sumber_id.toUpperCase()),
          avail,
          resv,
          dmg,
          sanitizeFormulaInput(p.tipe_stok || 'unit'),
          statusUpper,
          sanitizeFormulaInput(boxesText)
        ]);
        row.height = 20;
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
        styleStatusCell(row.getCell(12), statusUpper);
      }
    }
  }

  const summaryRow = worksheet.addRow([
    'TOTAL',
    '', '', '', '', '', '',
    totalTersedia,
    totalDipesan,
    totalRusak,
    'unit',
    '',
    ''
  ]);
  summaryRow.font = { name: 'Segoe UI', size: 10, bold: true };
  summaryRow.height = 24;

  worksheet.columns.forEach((col, index) => {
    if (index === 0) col.width = 6;
    else if (index === 2 || index === 3) col.width = 28;
    else if (index === 12) col.width = 30;
    else col.width = 16;
  });

  await downloadWorkbook(workbook, filename);
}

function styleStatusCell(statusCell: ExcelJS.Cell, statusUpper: string) {
  statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
  if (statusUpper === 'HABIS') {
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
    statusCell.font = { color: { argb: '991B1B' }, bold: true };
  } else if (statusUpper === 'MENIPIS') {
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
    statusCell.font = { color: { argb: '92400E' }, bold: true };
  } else {
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
    statusCell.font = { color: { argb: '065F46' }, bold: true };
  }
}

/**
 * Export Weekly Report & Canonical Transactions to valid Excel (.xlsx)
 * Uses WIB wall-clock serial dates & CWE-1236 sanitization
 */
export async function exportWeeklyReportToExcel(
  transactions: CanonicalTransactionView[],
  filename = `fieldops-laporan-transaksi-${getWibDateKey(new Date())}.xlsx`
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldOps IT';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Laporan Mutasi Barang');

  const titleRow = worksheet.addRow(['LAPORAN MUTASI BARANG IT LAPANGAN']);
  titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '0F172A' } };

  const subTitleRow = worksheet.addRow([
    `Tanggal Ditarik: ${formatWibDateTime(new Date())} | Total Record Mutasi: ${transactions.length} Entri`
  ]);
  subTitleRow.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };

  worksheet.addRow([]);

  const headers = [
    'No',
    'Waktu Kejadian (WIB)',
    'Waktu Dicatat (WIB)',
    'Jenis Transaksi',
    'Data Barang',
    'Kode / SKU',
    'Jumlah Mutasi',
    'Satuan',
    'No. Referensi / Tiket',
    'Pelaku (Actor)',
    'Dicatat Oleh',
    'Atas Nama',
    'Request Terkait',
    'Tujuan / Lokasi / Box',
    'Catatan Lapangan'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.height = 24;

  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E293B' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  transactions.forEach((tx, idx) => {
    const isOut = tx.type === 'OUT';
    const isIn = tx.type === 'IN';
    const typeLabel = isOut ? 'BARANG KELUAR' : isIn ? 'BARANG MASUK' : tx.aksi.toUpperCase();
    const qtySigned = isOut ? -Math.abs(tx.quantity) : Math.abs(tx.quantity);

    const occurredWallDate = toExcelWibWallDate(tx.occurred_at || tx.waktu);
    const recordedWallDate = toExcelWibWallDate(tx.recorded_at || tx.waktu);

    const row = worksheet.addRow([
      idx + 1,
      occurredWallDate,
      recordedWallDate,
      typeLabel,
      sanitizeFormulaInput(tx.item_name || '-'),
      sanitizeFormulaInput(tx.item_sku || '-'),
      qtySigned,
      sanitizeFormulaInput(tx.item_unit || 'unit'),
      sanitizeFormulaInput(tx.reference_number || '-'),
      sanitizeFormulaInput(tx.actor_nama || tx.performed_by || '-'),
      sanitizeFormulaInput(tx.recorded_by_nama || tx.performed_by || '-'),
      sanitizeFormulaInput(tx.is_on_behalf ? `Ya (${tx.on_behalf_reason || '-'})` : 'Tidak'),
      sanitizeFormulaInput(tx.request_id || '-'),
      sanitizeFormulaInput(tx.recipient_destination || tx.box_tujuan || tx.box_asal || '-'),
      sanitizeFormulaInput(tx.notes || '-')
    ]);

    row.height = 20;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    const occCell = row.getCell(2);
    occCell.numFmt = 'dd/mm/yyyy hh:mm';
    occCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const recCell = row.getCell(3);
    recCell.numFmt = 'dd/mm/yyyy hh:mm';
    recCell.alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

    const typeCell = row.getCell(4);
    typeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (isOut) {
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      typeCell.font = { color: { argb: '991B1B' }, bold: true };
    } else if (isIn) {
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      typeCell.font = { color: { argb: '065F46' }, bold: true };
    } else {
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
      typeCell.font = { color: { argb: '1E293B' }, bold: true };
    }
  });

  worksheet.columns.forEach((col, index) => {
    if (index === 0) col.width = 6;
    else if (index === 1 || index === 2) col.width = 20;
    else if (index === 4 || index === 14) col.width = 32;
    else col.width = 18;
  });

  await downloadWorkbook(workbook, filename);
}

export const exportTransactionsToExcel = exportWeeklyReportToExcel;
