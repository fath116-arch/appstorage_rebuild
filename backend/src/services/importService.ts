/**
 * Catalog & Initial Stock Import Service (Excel .xlsx / .csv & Public Google Spreadsheet)
 * FieldOps IT v1.2.8
 */

import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { executeQuery, runTransaction } from '../db/database';
import { ActivityDetailInput, ActivityLogService } from './activityLogService';
import { StockService } from './stockService';

export type ImportConflictMode = 'add_stock_only' | 'skip_existing';

export interface ParsedImportRow {
  rowNumber: number;
  kategori: string;
  produk: string;
  kategoriBarang: 'Alat' | 'Barang Habis Pakai';
  perputaran: 'fast_moving' | 'recycle';
  satuan: string;
  tipeVarian: string;
  sumberId: 'tanpa_id' | 'manual' | 'otomatis' | 'scan_sn';
  prefixId: string | null;
  kodeBox: string | null;
  stokAwal: number;
  serialNumbers: string[];
  rowState: 'new' | 'existing_add_stock' | 'skip' | 'error';
  messages: string[];
}

export interface ImportPreviewResult {
  sourceLabel: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  newCatalogItems: number;
  existingCatalogItems: number;
  totalStockToAdd: number;
  rows: ParsedImportRow[];
}

export interface ImportCommitResult {
  success: boolean;
  message: string;
  createdJenis: number;
  createdProduk: number;
  createdTipe: number;
  createdBoxes: number;
  addedStockUnits: number;
  skippedRows: number;
}

const HEADER_ALIASES: Record<string, string> = {
  kategori: 'kategori',
  jenis: 'kategori',
  nama_kategori: 'kategori',
  produk: 'produk',
  nama_produk: 'produk',
  nama_barang: 'produk',
  barang: 'produk',
  kategori_barang: 'kategoriBarang',
  golongan: 'kategoriBarang',
  perputaran: 'perputaran',
  siklus: 'perputaran',
  satuan: 'satuan',
  tipe_stok: 'satuan',
  unit: 'satuan',
  tipe_varian: 'tipeVarian',
  tipe: 'tipeVarian',
  varian: 'tipeVarian',
  sumber_id: 'sumberId',
  mode_id: 'sumberId',
  prefix_id: 'prefixId',
  prefix: 'prefixId',
  kode_box: 'kodeBox',
  box: 'kodeBox',
  lokasi_box: 'kodeBox',
  stok_awal: 'stokAwal',
  stok: 'stokAwal',
  jumlah: 'stokAwal',
  qty: 'stokAwal',
  daftar_serial_number: 'serialNumbers',
  serial_number: 'serialNumbers',
  serial_numbers: 'serialNumbers',
  daftar_sn: 'serialNumbers',
  sn: 'serialNumbers'
};

function normalizeHeaderKey(raw: string): string {
  const clean = String(raw || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return HEADER_ALIASES[clean] || clean;
}

function parseCsvText(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect delimiter from first line (; vs ,)
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
  }

  return rows;
}

export function parseGoogleSheetUrl(rawUrl: string): { sheetId: string; gid: string; exportUrl: string } {
  const trimmed = String(rawUrl || '').trim();
  const idMatch = trimmed.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (!idMatch) {
    throw new Error('URL Google Spreadsheet tidak valid. Gunakan link Google Sheets seperti: https://docs.google.com/spreadsheets/d/ID_SHEET/edit');
  }
  const sheetId = idMatch[1];
  const gidMatch = trimmed.match(/[#&?]gid=(\d+)/i);
  const gid = gidMatch ? gidMatch[1] : '0';
  return {
    sheetId,
    gid,
    exportUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  };
}

function normalizeKategoriBarang(raw: string): 'Alat' | 'Barang Habis Pakai' {
  const lower = String(raw || '').trim().toLowerCase();
  if (lower === 'alat' || lower === 'peralatan' || lower === 'tool') return 'Alat';
  return 'Barang Habis Pakai';
}

function normalizePerputaran(raw: string): 'fast_moving' | 'recycle' {
  const lower = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (lower === 'recycle' || lower === 'daur_ulang' || lower === 'kembali' || lower === 'aset') {
    return 'recycle';
  }
  return 'fast_moving';
}

function normalizeSumberId(raw: string): 'tanpa_id' | 'manual' | 'otomatis' | 'scan_sn' {
  const lower = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (lower === 'manual') return 'manual';
  if (lower === 'otomatis' || lower === 'auto') return 'otomatis';
  if (lower === 'scan_sn' || lower === 'sn' || lower === 'scan' || lower === 'serial') return 'scan_sn';
  return 'tanpa_id';
}

function slugPrefix(text: string): string {
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 8) || 'ITEM';
}

export class ImportService {
  /**
   * Generate official .xlsx template with Data_Barang + Panduan_Isi sheets
   */
  static async generateTemplateBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FieldOps IT Inventory';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Data_Barang', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Kategori', key: 'kategori', width: 22 },
      { header: 'Produk', key: 'produk', width: 26 },
      { header: 'Kategori_Barang', key: 'kategori_barang', width: 20 },
      { header: 'Perputaran', key: 'perputaran', width: 15 },
      { header: 'Satuan', key: 'satuan', width: 12 },
      { header: 'Tipe_Varian', key: 'tipe_varian', width: 22 },
      { header: 'Sumber_ID', key: 'sumber_id', width: 14 },
      { header: 'Prefix_ID', key: 'prefix_id', width: 16 },
      { header: 'Kode_Box', key: 'kode_box', width: 14 },
      { header: 'Stok_Awal', key: 'stok_awal', width: 12 },
      { header: 'Daftar_Serial_Number', key: 'daftar_sn', width: 38 }
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 24;

    // 2 example rows ready for user editing or Google Sheets upload
    sheet.addRow({
      kategori: 'Router & Switch',
      produk: 'MikroTik RB750Gr3',
      kategori_barang: 'Alat',
      perputaran: 'recycle',
      satuan: 'unit',
      tipe_varian: 'Standar 5-Port',
      sumber_id: 'scan_sn',
      prefix_id: 'MTK-750',
      kode_box: 'BOX-A-01',
      stok_awal: 2,
      daftar_sn: 'SN-MTK-001, SN-MTK-002'
    });

    sheet.addRow({
      kategori: 'Kabel & Konektor',
      produk: 'Konektor RJ45 Cat6',
      kategori_barang: 'Barang Habis Pakai',
      perputaran: 'fast_moving',
      satuan: 'pcs',
      tipe_varian: 'Standar',
      sumber_id: 'tanpa_id',
      prefix_id: '',
      kode_box: 'BOX-A-02',
      stok_awal: 50,
      daftar_sn: ''
    });

    const guideSheet = workbook.addWorksheet('Panduan_Isi');
    guideSheet.columns = [
      { header: 'Kolom', key: 'kolom', width: 24 },
      { header: 'Wajib', key: 'wajib', width: 12 },
      { header: 'Aturan / Nilai yang Didukung', key: 'aturan', width: 70 }
    ];
    const gHeader = guideSheet.getRow(1);
    gHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    gHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

    const guideRows = [
      ['Kategori', 'Ya', 'Nama kategori utama barang (otomatis dibuat jika belum ada di katalog).'],
      ['Produk', 'Ya', 'Nama produk barang (otomatis dibuat di bawah Kategori terkait jika belum ada).'],
      ['Kategori_Barang', 'Opsional', 'Isi: "Alat" atau "Barang Habis Pakai" (bawaan: Barang Habis Pakai).'],
      ['Perputaran', 'Opsional', 'Isi: "fast_moving" atau "recycle" (bawaan: fast_moving).'],
      ['Satuan', 'Opsional', 'Contoh: unit, pcs, roll, meter, box, pack, set (bawaan: unit).'],
      ['Tipe_Varian', 'Opsional', 'Nama tipe/varian produk (bawaan: "Standar").'],
      ['Sumber_ID', 'Opsional', 'Isi: "tanpa_id", "manual", "otomatis", atau "scan_sn" (bawaan: tanpa_id).'],
      ['Prefix_ID', 'Opsional', 'Awalan kode otomatis jika Sumber_ID = otomatis (contoh: MTK-750).'],
      ['Kode_Box', 'Jika stok > 0', 'Kode Box penyimpanan (misal BOX-A-01). Box baru otomatis dibuat jika belum ada.'],
      ['Stok_Awal', 'Opsional', 'Angka bulat >= 0 untuk saldo awal yang dimasukkan saat impor.'],
      ['Daftar_Serial_Number', 'Khusus Per-ID', 'Pisahkan serial number dengan koma (,) atau titik koma (;) untuk Sumber_ID scan_sn / manual.']
    ];
    for (const r of guideRows) {
      guideSheet.addRow({ kolom: r[0], wajib: r[1], aturan: r[2] });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  /**
   * Read rows from uploaded base64 .xlsx / .csv OR public Google Spreadsheet URL
   */
  private static async extractRawTable(input: {
    sourceType: 'file' | 'google_sheet';
    fileBase64?: string;
    fileName?: string;
    googleSheetUrl?: string;
  }): Promise<{ sourceLabel: string; table: string[][] }> {
    if (input.sourceType === 'google_sheet') {
      if (!input.googleSheetUrl) {
        throw new Error('URL Google Spreadsheet wajib diisi.');
      }
      const { sheetId, exportUrl } = parseGoogleSheetUrl(input.googleSheetUrl);
      const resp = await fetch(exportUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: 'text/csv,text/plain,*/*' }
      });
      const contentType = resp.headers.get('content-type') || '';
      const text = await resp.text();
      if (!resp.ok || contentType.includes('text/html') || text.trim().startsWith('<')) {
        throw new Error(
          'Spreadsheet Google belum dibagikan secara publik ("Siapa saja yang memiliki link - Pengakses Lihat Saja") atau tautan tidak ditemukan.'
        );
      }
      const table = parseCsvText(text);
      return { sourceLabel: `Google Sheet (${sheetId})`, table };
    }

    // File (.xlsx or .csv)
    if (!input.fileBase64) {
      throw new Error('Berkas Excel atau CSV wajib dipilih.');
    }
    const base64Clean = input.fileBase64.includes(',') ? input.fileBase64.split(',').pop()! : input.fileBase64;
    const buffer = Buffer.from(base64Clean, 'base64');
    if (buffer.length === 0) {
      throw new Error('Berkas impor kosong.');
    }

    const lowerName = String(input.fileName || '').toLowerCase();
    if (lowerName.endsWith('.csv')) {
      const table = parseCsvText(buffer.toString('utf8'));
      return { sourceLabel: input.fileName || 'impor.csv', table };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.getWorksheet('Data_Barang') || workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Worksheet Excel tidak ditemukan.');
    }

    const table: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      // ExcelJS row.values is 1-indexed (index 0 empty)
      const cells = values.slice(1).map((cell) => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'object' && cell !== null && 'text' in cell) {
          return String((cell as { text?: unknown }).text || '').trim();
        }
        return String(cell).trim();
      });
      if (cells.some(c => c.length > 0)) {
        table.push(cells);
      }
    });

    return { sourceLabel: input.fileName || 'impor.xlsx', table };
  }

  /**
   * Preview & Validate import table without mutating database
   */
  static async previewImport(input: {
    sourceType: 'file' | 'google_sheet';
    fileBase64?: string;
    fileName?: string;
    googleSheetUrl?: string;
    conflictMode?: ImportConflictMode;
  }): Promise<ImportPreviewResult> {
    const conflictMode: ImportConflictMode = input.conflictMode === 'skip_existing' ? 'skip_existing' : 'add_stock_only';
    const { sourceLabel, table } = await this.extractRawTable(input);

    if (table.length < 2) {
      throw new Error('Berkas impor tidak memiliki baris data (minimal 1 baris header + 1 baris data).');
    }

    const headerMap = table[0].map(normalizeHeaderKey);
    const colIdx = (key: string) => headerMap.indexOf(key);

    if (colIdx('kategori') === -1 || colIdx('produk') === -1) {
      throw new Error('Header wajib "Kategori" dan "Produk" tidak ditemukan. Unduh template resmi terlebih dahulu.');
    }

    // Load existing catalog snapshots for conflict preview
    const existingJenis = await executeQuery<{ id: number; nama: string }>('SELECT id, nama FROM jenis WHERE aktif = 1');
    const jenisMap = new Map<string, number>();
    for (const j of existingJenis) {
      jenisMap.set(j.nama.trim().toLowerCase(), Number(j.id));
    }

    const existingProduk = await executeQuery<{ id: number; jenis_id: number; nama: string }>(
      'SELECT id, jenis_id, nama FROM produk WHERE aktif = 1'
    );
    const produkMap = new Map<string, number>();
    for (const p of existingProduk) {
      produkMap.set(`${p.jenis_id}::${p.nama.trim().toLowerCase()}`, Number(p.id));
    }

    const existingTipe = await executeQuery<{ id: number; produk_id: number; nama_tipe: string }>(
      'SELECT id, produk_id, nama_tipe FROM tipe WHERE aktif = 1'
    );
    const tipeMap = new Map<string, number>();
    for (const t of existingTipe) {
      tipeMap.set(`${t.produk_id}::${t.nama_tipe.trim().toLowerCase()}`, Number(t.id));
    }

    const existingBoxes = await StockService.listBoxes();
    const boxKodeSet = new Set(existingBoxes.map(b => b.kode.trim().toUpperCase()));

    const seenSerialsInBatch = new Set<string>();
    const parsedRows: ParsedImportRow[] = [];

    for (let i = 1; i < table.length; i++) {
      const cells = table[i];
      const getVal = (key: string) => {
        const idx = colIdx(key);
        return idx >= 0 && idx < cells.length ? String(cells[idx] || '').trim() : '';
      };

      const kategori = getVal('kategori');
      const produk = getVal('produk');
      if (!kategori && !produk) continue;
      if (kategori.startsWith('#')) continue;

      const messages: string[] = [];
      if (!kategori) messages.push('Kolom Kategori wajib diisi.');
      if (!produk) messages.push('Kolom Produk wajib diisi.');

      const kategoriBarang = normalizeKategoriBarang(getVal('kategoriBarang'));
      const perputaran = normalizePerputaran(getVal('perputaran'));
      const satuan = (getVal('satuan') || 'unit').toLowerCase();
      const tipeVarian = getVal('tipeVarian') || 'Standar';
      const sumberId = normalizeSumberId(getVal('sumberId'));
      const prefixId = getVal('prefixId') ? getVal('prefixId').toUpperCase() : null;
      const rawBox = getVal('kodeBox');
      let kodeBox = rawBox ? rawBox.toUpperCase() : null;

      const rawStok = getVal('stokAwal');
      let stokAwal = rawStok === '' ? 0 : Number(rawStok);
      if (!Number.isFinite(stokAwal) || stokAwal < 0 || !Number.isInteger(stokAwal)) {
        messages.push(`Stok_Awal "${rawStok}" harus berupa bilangan bulat >= 0.`);
        stokAwal = 0;
      }

      const rawSerials = getVal('serialNumbers');
      const serialNumbers = rawSerials
        ? rawSerials
            .split(/[\n,;]+/)
            .map(s => s.trim())
            .filter(Boolean)
        : [];

      if (stokAwal === 0 && serialNumbers.length > 0) {
        stokAwal = serialNumbers.length;
      }

      if (stokAwal > 0 && !kodeBox) {
        kodeBox = 'BOX-A-01';
        messages.push('Kode_Box kosong, akan menggunakan BOX-A-01.');
      }

      if (sumberId !== 'tanpa_id' && stokAwal > 0) {
        if (sumberId === 'otomatis') {
          // Auto-generated during commit
        } else {
          if (serialNumbers.length === 0) {
            messages.push(`Sumber_ID "${sumberId}" membutuhkan Daftar_Serial_Number sejumlah Stok_Awal (${stokAwal}).`);
          } else if (serialNumbers.length !== stokAwal) {
            messages.push(
              `Jumlah Serial Number (${serialNumbers.length}) tidak sama dengan Stok_Awal (${stokAwal}).`
            );
          }

          for (const sn of serialNumbers) {
            const upperSn = sn.toUpperCase();
            if (seenSerialsInBatch.has(upperSn)) {
              messages.push(`Serial Number "${sn}" duplikat di dalam berkas impor.`);
            } else {
              seenSerialsInBatch.add(upperSn);
              const dupCheck = await StockService.checkDuplicateKodeId(sn);
              if (dupCheck.exists) {
                messages.push(`Serial Number "${sn}" sudah terdaftar di sistem.`);
              }
            }
          }
        }
      }

      if (kodeBox && !boxKodeSet.has(kodeBox)) {
        messages.push(`Box baru "${kodeBox}" akan otomatis dibuat.`);
      }

      // Catalog existence check
      const jId = jenisMap.get(kategori.toLowerCase());
      const pId = jId ? produkMap.get(`${jId}::${produk.toLowerCase()}`) : undefined;
      const tId = pId ? tipeMap.get(`${pId}::${tipeVarian.toLowerCase()}`) : undefined;
      const catalogExists = Boolean(tId);

      const hasFatalError = messages.some(
        m =>
          m.includes('wajib') ||
          m.includes('harus berupa') ||
          m.includes('membutuhkan') ||
          m.includes('tidak sama') ||
          m.includes('duplikat') ||
          m.includes('sudah terdaftar')
      );

      let rowState: ParsedImportRow['rowState'] = 'new';
      if (hasFatalError) {
        rowState = 'error';
      } else if (catalogExists) {
        if (conflictMode === 'skip_existing') {
          rowState = 'skip';
          messages.push('Tipe produk sudah ada — baris akan dilewati.');
        } else {
          rowState = 'existing_add_stock';
          if (stokAwal > 0) {
            messages.push(`Tipe sudah ada — menambah ${stokAwal} ${satuan} ke stok.`);
          } else {
            messages.push('Tipe sudah ada (tidak ada stok tambahan).');
          }
        }
      }

      parsedRows.push({
        rowNumber: i + 1,
        kategori,
        produk,
        kategoriBarang,
        perputaran,
        satuan,
        tipeVarian,
        sumberId,
        prefixId,
        kodeBox,
        stokAwal,
        serialNumbers,
        rowState,
        messages
      });
    }

    const validRowsList = parsedRows.filter(r => r.rowState !== 'error' && r.rowState !== 'skip');
    return {
      sourceLabel,
      totalRows: parsedRows.length,
      validRows: validRowsList.length,
      errorRows: parsedRows.filter(r => r.rowState === 'error').length,
      newCatalogItems: parsedRows.filter(r => r.rowState === 'new').length,
      existingCatalogItems: parsedRows.filter(r => r.rowState === 'existing_add_stock' || r.rowState === 'skip').length,
      totalStockToAdd: validRowsList.reduce((sum, r) => sum + r.stokAwal, 0),
      rows: parsedRows
    };
  }

  /**
   * Execute validated import inside a single atomic DB transaction
   */
  static async commitImport(input: {
    rows: ParsedImportRow[];
    conflictMode?: ImportConflictMode;
    sourceLabel?: string;
    userId: string;
    userName?: string;
  }): Promise<ImportCommitResult> {
    const conflictMode: ImportConflictMode = input.conflictMode === 'skip_existing' ? 'skip_existing' : 'add_stock_only';
    const rawRows = Array.isArray(input.rows) ? input.rows : [];
    if (rawRows.length === 0) {
      throw new Error('Tidak ada baris data untuk diimpor.');
    }

    const errorRows = rawRows.filter(r => r.rowState === 'error');
    if (errorRows.length > 0) {
      throw new Error(`Masih ada ${errorRows.length} baris error. Perbaiki atau hapus baris error sebelum impor.`);
    }

    return await runTransaction(async (conn) => {
      const jenisCache = new Map<string, number>();
      const produkCache = new Map<string, number>();
      const tipeCache = new Map<string, number>();
      const boxCache = new Map<string, { id: string; kode: string }>();

      const allJenis = (await conn.query('SELECT id, nama FROM jenis WHERE aktif = 1')) as Array<{ id: number; nama: string }>;
      for (const j of allJenis) jenisCache.set(String(j.nama).trim().toLowerCase(), Number(j.id));

      const allProduk = (await conn.query('SELECT id, jenis_id, nama FROM produk WHERE aktif = 1')) as Array<{
        id: number;
        jenis_id: number;
        nama: string;
      }>;
      for (const p of allProduk) produkCache.set(`${p.jenis_id}::${String(p.nama).trim().toLowerCase()}`, Number(p.id));

      const allTipe = (await conn.query('SELECT id, produk_id, nama_tipe FROM tipe WHERE aktif = 1')) as Array<{
        id: number;
        produk_id: number;
        nama_tipe: string;
      }>;
      for (const t of allTipe) tipeCache.set(`${t.produk_id}::${String(t.nama_tipe).trim().toLowerCase()}`, Number(t.id));

      const allBoxes = (await conn.query('SELECT id, kode FROM box WHERE aktif = 1')) as Array<{ id: string; kode: string }>;
      for (const b of allBoxes) boxCache.set(String(b.kode).trim().toUpperCase(), { id: String(b.id), kode: String(b.kode).trim().toUpperCase() });

      let createdJenis = 0;
      let createdProduk = 0;
      let createdTipe = 0;
      let createdBoxes = 0;
      let addedStockUnits = 0;
      let skippedRows = 0;
      const activityDetails: ActivityDetailInput[] = [];

      for (const row of rawRows) {
        const kategoriClean = String(row.kategori || '').trim();
        const produkClean = String(row.produk || '').trim();
        const tipeClean = String(row.tipeVarian || 'Standar').trim();
        if (!kategoriClean || !produkClean) {
          skippedRows++;
          continue;
        }

        // Check skip_existing against live cache
        const existingJenisId = jenisCache.get(kategoriClean.toLowerCase());
        const existingProdukId = existingJenisId ? produkCache.get(`${existingJenisId}::${produkClean.toLowerCase()}`) : undefined;
        const existingTipeId = existingProdukId ? tipeCache.get(`${existingProdukId}::${tipeClean.toLowerCase()}`) : undefined;

        if ((row.rowState === 'skip') || (existingTipeId && conflictMode === 'skip_existing')) {
          skippedRows++;
          continue;
        }

        // 1. Ensure Jenis
        let jenisId = existingJenisId;
        if (!jenisId) {
          const jRes = (await conn.query(
            `INSERT INTO jenis (nama, sumber_id_bawaan, prefix_id_bawaan, aktif) VALUES (?, ?, ?, 1)`,
            [kategoriClean, row.sumberId || 'tanpa_id', row.prefixId || null]
          )) as { insertId?: number; id?: number };
          jenisId = Number(jRes.insertId || jRes.id);
          jenisCache.set(kategoriClean.toLowerCase(), jenisId);
          createdJenis++;
        }

        // 2. Ensure Produk
        let produkId = produkCache.get(`${jenisId}::${produkClean.toLowerCase()}`);
        if (!produkId) {
          const pRes = (await conn.query(
            `INSERT INTO produk (jenis_id, nama, kategori, kategori_barang, tipe_stok, catatan, aktif, dibuat_oleh)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
            [
              jenisId,
              produkClean,
              row.perputaran === 'recycle' ? 'recycle' : 'fast_moving',
              row.kategoriBarang === 'Alat' ? 'Alat' : 'Barang Habis Pakai',
              (row.satuan || 'unit').toLowerCase(),
              'Diimpor via Template Spreadsheet',
              input.userId
            ]
          )) as { insertId?: number; id?: number };
          produkId = Number(pRes.insertId || pRes.id);
          produkCache.set(`${jenisId}::${produkClean.toLowerCase()}`, produkId);
          createdProduk++;
        }

        // 3. Ensure Tipe
        const sumberId = row.sumberId || 'tanpa_id';
        const modeStok = sumberId === 'tanpa_id' ? 'jumlah' : 'per_id';
        let tipeId = tipeCache.get(`${produkId}::${tipeClean.toLowerCase()}`);
        if (!tipeId) {
          const tRes = (await conn.query(
            `INSERT INTO tipe (produk_id, nama_tipe, catatan, sumber_id, mode_stok, prefix_id, pola_id, id_dikunci, aktif)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
            [produkId, tipeClean, 'Diimpor via Template Spreadsheet', sumberId, modeStok, row.prefixId || null, null]
          )) as { insertId?: number; id?: number };
          tipeId = Number(tRes.insertId || tRes.id);
          tipeCache.set(`${produkId}::${tipeClean.toLowerCase()}`, tipeId);
          createdTipe++;
        }

        // 4. Add initial stock if > 0
        const stokAwal = Math.max(0, Number(row.stokAwal || 0));
        if (stokAwal > 0) {
          const boxKode = (row.kodeBox || 'BOX-A-01').trim().toUpperCase();
          let box = boxCache.get(boxKode);
          if (!box) {
            const newBoxId = `box-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            await conn.query(
              `INSERT INTO box (id, kode, keterangan, aktif) VALUES (?, ?, ?, 1)`,
              [newBoxId, boxKode, 'Dibuat otomatis dari impor katalog']
            );
            box = { id: newBoxId, kode: boxKode };
            boxCache.set(boxKode, box);
            createdBoxes++;
          }

          if (modeStok === 'jumlah') {
            const sjExisting = (await conn.query(
              `SELECT jumlah FROM stok_jumlah WHERE tipe_id = ? AND box_id = ?`,
              [tipeId, box.id]
            )) as Array<{ jumlah: number }>;

            if (sjExisting && sjExisting.length > 0) {
              await conn.query(
                `UPDATE stok_jumlah SET jumlah = jumlah + ? WHERE tipe_id = ? AND box_id = ?`,
                [stokAwal, tipeId, box.id]
              );
            } else {
              await conn.query(
                `INSERT INTO stok_jumlah (tipe_id, box_id, jumlah) VALUES (?, ?, ?)`,
                [tipeId, box.id, stokAwal]
              );
            }

            addedStockUnits += stokAwal;
            activityDetails.push({
              tipe_id: tipeId,
              item_id: null,
              kode_id: null,
              nama_snapshot: `${produkClean} - ${tipeClean}`,
              jumlah: stokAwal,
              status_sebelum: null,
              status_sesudah: 'aktif'
            });
          } else {
            let serialsToInsert = [...(row.serialNumbers || [])];
            if (sumberId === 'otomatis' && serialsToInsert.length < stokAwal) {
              const basePrefix = row.prefixId || slugPrefix(produkClean);
              const ts = String(Date.now()).slice(-4);
              for (let k = serialsToInsert.length + 1; k <= stokAwal; k++) {
                serialsToInsert.push(`${basePrefix}-${ts}-${String(k).padStart(3, '0')}`);
              }
            }

            for (const kodeSn of serialsToInsert) {
              const dup = await conn.query('SELECT id FROM item WHERE UPPER(kode_id) = UPPER(?)', [kodeSn]);
              if (Array.isArray(dup) && dup.length > 0) {
                throw new Error(`Kode ID "${kodeSn}" sudah terdaftar di sistem.`);
              }
              const itemId = `item-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
              await conn.query(
                `INSERT INTO item (id, kode_id, tipe_id, box_id, status, kondisi, catatan_kondisi)
                 VALUES (?, ?, ?, ?, 'aktif', 'Baik', NULL)`,
                [itemId, kodeSn, tipeId, box.id]
              );
              addedStockUnits++;
              activityDetails.push({
                tipe_id: tipeId,
                item_id: itemId,
                kode_id: kodeSn,
                nama_snapshot: `${produkClean} - ${tipeClean}`,
                jumlah: 1,
                status_sebelum: null,
                status_sesudah: 'aktif'
              });
            }
          }
        }
      }

      await ActivityLogService.recordActivity(
        {
          aksi: 'impor_katalog',
          pelaku_id: input.userId,
          actor_id: input.userId,
          actor_nama: input.userName,
          tipe_mutasi: addedStockUnits > 0 ? 'MASUK' : undefined,
          reference_type: 'IMPORT_SPREADSHEET',
          reference_number: `IMP-${Date.now()}`,
          qty_total: addedStockUnits,
          catatan: `Impor Katalog (${input.sourceLabel || 'Spreadsheet'}): +${createdJenis} Kategori, +${createdProduk} Produk, +${createdTipe} Tipe, +${createdBoxes} Box, +${addedStockUnits} stok awal`,
          details: activityDetails
        },
        conn
      );

      return {
        success: true,
        message: `Impor berhasil: ${createdJenis} Kategori, ${createdProduk} Produk, ${createdTipe} Tipe, ${createdBoxes} Box, dan ${addedStockUnits} unit stok awal ditambahkan.`,
        createdJenis,
        createdProduk,
        createdTipe,
        createdBoxes,
        addedStockUnits,
        skippedRows
      };
    });
  }
}
