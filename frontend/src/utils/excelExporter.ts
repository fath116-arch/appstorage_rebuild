/**
 * Excel Exporter Engine using ExcelJS
 * FieldOps IT Inventory - Generates valid .xlsx spreadsheet files
 */

import ExcelJS from 'exceljs';
import { InventoryItem, Transaction } from '../types/inventory';
import { sanitizeFormulaInput } from './security';

export { sanitizeFormulaInput };

/**
 * Generate Excel workbook buffer for testing or server-side usage
 */
export async function generateInventoryExcelBuffer(items: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldOps IT';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Katalog Inventori');

  // Title rows
  const titleRow = worksheet.addRow(['LAPORAN KATALOG INVENTORI LAPANGAN IT']);
  titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '0F172A' } };

  const subTitleRow = worksheet.addRow([
    `Tanggal Ditarik: ${new Date().toLocaleString('id-ID')} | Total Master Items: ${items.length}`
  ]);
  subTitleRow.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };

  worksheet.addRow([]); // Blank spacer

  // Table Headers
  const headers = [
    'No',
    'Kode SKU',
    'Barcode',
    'Nama Barang Suku Cadang',
    'Kategori / Rak',
    'Jumlah Stok',
    'Satuan',
    'Batas Min Alert',
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
    const qty = item.quantity || 0;
    const minAlert = item.min_stock_alert ?? item.minStockAlert ?? 0;
    const isLow = qty <= minAlert && qty > 0;
    const isOut = qty === 0;
    const statusText = isOut ? 'HABIS' : isLow ? 'STOK TIPIS' : 'AMAN';

    worksheet.addRow([
      idx + 1,
      sanitizeFormulaInput(item.sku || ''),
      sanitizeFormulaInput(item.barcode || ''),
      sanitizeFormulaInput(item.name || ''),
      sanitizeFormulaInput(item.category_name || item.categoryName || ''),
      qty,
      sanitizeFormulaInput(item.unit || 'pcs'),
      minAlert,
      sanitizeFormulaInput(item.location || '-'),
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
 * Export Inventory Items Catalog to valid Excel (.xlsx) file
 */
export async function exportInventoryToExcel(items: InventoryItem[], filename = 'fieldops-inventory-catalog.xlsx') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldOps IT';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Katalog Inventori IT');

  // Title rows
  const titleRow = worksheet.addRow(['LAPORAN KATALOG INVENTORI LAPANGAN IT']);
  titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '0F172A' } };

  const subTitleRow = worksheet.addRow([
    `Tanggal Ditarik: ${new Date().toLocaleString('id-ID')} | Total Master Items: ${items.length}`
  ]);
  subTitleRow.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };

  worksheet.addRow([]); // Blank spacer

  // Table Headers
  const headers = [
    'No',
    'Kode SKU',
    'Barcode',
    'Nama Barang Suku Cadang',
    'Kategori / Rak',
    'Jumlah Stok',
    'Satuan',
    'Batas Min Alert',
    'Harga Satuan (IDR)',
    'Total Nilai Aset (IDR)',
    'Lokasi Penyimpanan',
    'Status Stok',
    'Spesifikasi Teknis',
    'Terakhir Diperbarui'
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

  const getItemCost = (i: any) => i.unit_cost ?? i.unitCost ?? 0;
  const getItemMinAlert = (i: any) => i.min_stock_alert ?? i.minStockAlert ?? 0;

  let totalValue = 0;
  let totalItemsCount = 0;

  items.forEach((item: any, idx: number) => {
    const cost = getItemCost(item);
    const minAlert = getItemMinAlert(item);
    const qty = item.quantity || 0;
    const itemTotal = qty * cost;

    totalValue += itemTotal;
    totalItemsCount += qty;

    const isLow = qty <= minAlert && qty > 0;
    const isOut = qty === 0;
    const statusText = isOut ? 'HABIS' : isLow ? 'STOK TIPIS' : 'AMAN';
    const lastUpd = item.lastUpdated
      ? new Date(item.lastUpdated).toLocaleString('id-ID')
      : new Date().toLocaleString('id-ID');

    const row = worksheet.addRow([
      idx + 1,
      sanitizeFormulaInput(item.sku || ''),
      sanitizeFormulaInput(item.barcode || ''),
      sanitizeFormulaInput(item.name || ''),
      sanitizeFormulaInput(item.categoryName || ''),
      qty,
      sanitizeFormulaInput(item.unit || 'pcs'),
      minAlert,
      cost,
      itemTotal,
      sanitizeFormulaInput(item.location || '-'),
      statusText,
      sanitizeFormulaInput(item.specs || '-'),
      lastUpd
    ]);

    row.height = 20;

    // Alignment & Formatting
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(9).numFmt = '""#,##0';
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(10).numFmt = '""#,##0';
    row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };

    // Status Cell Styling
    const statusCell = row.getCell(12);
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (isOut) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      statusCell.font = { color: { argb: '991B1B' }, bold: true };
    } else if (isLow) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      statusCell.font = { color: { argb: '92400E' }, bold: true };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      statusCell.font = { color: { argb: '065F46' }, bold: true };
    }
  });

  // Summary Row
  const summaryRow = worksheet.addRow([
    'TOTAL KESELURUHAN:',
    '', '', '', '',
    totalItemsCount,
    'unit',
    '', '',
    totalValue,
    '', '', '', ''
  ]);
  summaryRow.font = { name: 'Segoe UI', size: 10, bold: true };
  summaryRow.height = 24;

  summaryRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  summaryRow.getCell(10).numFmt = '""#,##0';
  summaryRow.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };

  // Adjust Column Widths
  worksheet.columns.forEach((col, index) => {
    if (index === 0) col.width = 6;
    else if (index === 3) col.width = 35;
    else if (index === 12) col.width = 30;
    else col.width = 18;
  });

  await downloadWorkbook(workbook, filename);
}

/**
 * Export Weekly Report & Transactions to valid Excel (.xlsx) file
 */
export async function exportWeeklyReportToExcel(transactions: Transaction[], filename = 'fieldops-laporan-transaksi.xlsx') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FieldOps IT';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Laporan Mutasi Barang');

  // Title rows
  const titleRow = worksheet.addRow(['LAPORAN MUTASI BARANG IT LAPANGAN']);
  titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '0F172A' } };

  const subTitleRow = worksheet.addRow([
    `Tanggal Ditarik: ${new Date().toLocaleString('id-ID')} | Total Record Mutasi: ${transactions.length} Entri`
  ]);
  subTitleRow.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: '64748B' } };

  worksheet.addRow([]); // Blank spacer

  const headers = [
    'No',
    'Waktu Transaksi',
    'Jenis Transaksi',
    'Kode SKU',
    'Nama Barang / Suku Cadang',
    'Jumlah Mutasi',
    'Satuan',
    'No. Referensi / Tiket',
    'Teknisi / Petugas',
    'Tujuan / Unit Lokasi',
    'Catatan Lapangan',
    'Sumber Entri'
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

  transactions.forEach((tx: any, idx: number) => {
    const isOut = tx.type === 'OUT';
    const typeLabel = isOut ? 'BARANG KELUAR' : 'BARANG MASUK';
    const txDate = tx.created_at || tx.date || new Date().toISOString();
    const sku = tx.item_sku || tx.itemSku || '-';
    const name = tx.item_name || tx.itemName || '-';
    const unit = tx.item_unit || tx.unit || 'pcs';
    const ref = tx.reference_number || tx.referenceNumber || '-';
    const by = tx.performed_by || tx.performedBy || '-';
    const dest = tx.recipient_destination || tx.recipientOrDestination || '-';

    const row = worksheet.addRow([
      idx + 1,
      new Date(txDate).toLocaleString('id-ID'),
      typeLabel,
      sanitizeFormulaInput(sku),
      sanitizeFormulaInput(name),
      isOut ? -Math.abs(tx.quantity) : Math.abs(tx.quantity),
      sanitizeFormulaInput(unit),
      sanitizeFormulaInput(ref),
      sanitizeFormulaInput(by),
      sanitizeFormulaInput(dest),
      sanitizeFormulaInput(tx.notes || '-'),
      sanitizeFormulaInput(tx.apiSource || 'Manual')
    ]);

    row.height = 20;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

    const typeCell = row.getCell(3);
    typeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (isOut) {
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      typeCell.font = { color: { argb: '991B1B' }, bold: true };
    } else {
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      typeCell.font = { color: { argb: '065F46' }, bold: true };
    }
  });

  worksheet.columns.forEach((col, index) => {
    if (index === 0) col.width = 6;
    else if (index === 4) col.width = 35;
    else if (index === 10) col.width = 30;
    else col.width = 20;
  });

  await downloadWorkbook(workbook, filename);
}
