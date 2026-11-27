/**
 * Catalog & Initial Stock Bulk Import Modal (Excel .xlsx/.csv & Public Google Spreadsheet)
 * FieldOps IT v1.2.8
 */

import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Link2,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Layers,
  Info
} from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { useInventory } from '../../context/InventoryContext';

interface CatalogImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

type ImportPreviewData = Awaited<ReturnType<typeof catalogApi.previewImport>>;

export const CatalogImportModal: React.FC<CatalogImportModalProps> = ({
  isOpen,
  onClose,
  onImported
}) => {
  const { showToast } = useInventory();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sourceType, setSourceType] = useState<'file' | 'google_sheet'>('file');
  const [selectedFile, setSelectedFile] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [conflictMode, setConflictMode] = useState<'add_stock_only' | 'skip_existing'>('add_stock_only');

  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetAllAndClose = () => {
    setPreviewData(null);
    setErrorMsg(null);
    setSelectedFile(null);
    setGoogleSheetUrl('');
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setErrorMsg(null);
    try {
      await catalogApi.downloadImportTemplate();
      showToast('Template Excel (.xlsx) berhasil diunduh.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh template impor.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg(null);
    setPreviewData(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv')) {
      setErrorMsg('Format berkas tidak didukung. Gunakan file Excel (.xlsx) atau CSV (.csv).');
      setSelectedFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawResult = typeof reader.result === 'string' ? reader.result : '';
      const base64 = rawResult.includes(',') ? rawResult.split(',')[1] : rawResult;
      if (!base64) {
        setErrorMsg('Gagal membaca isi berkas.');
        return;
      }
      setSelectedFile({
        name: file.name,
        base64,
        size: file.size
      });
    };
    reader.onerror = () => {
      setErrorMsg('Terjadi kesalahan saat membaca berkas dari perangkat.');
    };
    reader.readAsDataURL(file);
  };

  const handlePreview = async () => {
    setErrorMsg(null);
    if (sourceType === 'file' && !selectedFile) {
      setErrorMsg('Pilih file .xlsx atau .csv terlebih dahulu.');
      return;
    }
    if (sourceType === 'google_sheet' && !googleSheetUrl.trim()) {
      setErrorMsg('Tempel link Google Spreadsheet publik terlebih dahulu.');
      return;
    }

    setValidating(true);
    try {
      const res = await catalogApi.previewImport({
        sourceType,
        fileBase64: sourceType === 'file' ? selectedFile?.base64 : undefined,
        fileName: sourceType === 'file' ? selectedFile?.name : undefined,
        googleSheetUrl: sourceType === 'google_sheet' ? googleSheetUrl.trim() : undefined,
        conflictMode
      });
      setPreviewData(res);
      if (res.totalRows === 0) {
        setErrorMsg('Tidak ada baris data yang ditemukan pada sumber tersebut.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memvalidasi data impor.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData) return;
    const rowsToCommit = previewData.rows.filter(
      (r) => r.rowState === 'new' || r.rowState === 'existing_add_stock'
    );
    if (rowsToCommit.length === 0) {
      setErrorMsg('Tidak ada baris valid yang siap diimpor. Periksa status error/lewati.');
      return;
    }

    setCommitting(true);
    setErrorMsg(null);
    try {
      const result = await catalogApi.commitImport({
        rows: previewData.rows.filter((r) => r.rowState !== 'error'),
        conflictMode,
        sourceLabel: previewData.sourceLabel
      });

      showToast(result.message || 'Impor katalog & stok awal berhasil dijalankan.', 'success');
      await onImported();
      resetAllAndClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengeksekusi impor ke database.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setCommitting(false);
    }
  };

  const actionableCount = previewData
    ? previewData.rows.filter((r) => r.rowState === 'new' || r.rowState === 'existing_add_stock').length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-5xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                Impor Katalog, Box &amp; Stok Awal (Excel / Google Spreadsheet)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Buat kategori, produk, varian tipe, storage box, dan stok awal secara massal menggunakan format standar FieldOps IT.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetAllAndClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Step 1: Unduh Template */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-600 text-white font-mono text-[11px] font-bold">
                  1
                </span>
                <span>Unduh Template Resmi Terlebih Dahulu</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Template berisi sheet <strong>Data_Barang</strong> (kolom standar + contoh multi-varian dalam 1 produk + kolom <strong>Pola_ID</strong>) dan sheet <strong>Panduan_Isi</strong>. Isi <strong>satu baris per varian tipe</strong> lengkap dengan <code>Daftar_Serial_Number</code> terpisah per tipe, lalu unggah Excel/CSV atau tautkan Google Sheets.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 shrink-0 shadow-xs disabled:opacity-50 whitespace-nowrap"
            >
              {downloadingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{downloadingTemplate ? 'Mengunduh...' : 'Download Template Excel (.xlsx)'}</span>
            </button>
          </div>

          {/* Step 2: Pilih Sumber & Mode Konflik */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-900 dark:bg-emerald-600 text-white font-mono text-[11px] font-bold">
                  2
                </span>
                <span>Pilih Sumber Data &amp; Aturan Data Ganda</span>
              </div>

              {/* Source Switcher */}
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 gap-1 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSourceType('file');
                    setPreviewData(null);
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
                    sourceType === 'file'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File (.xlsx / .csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceType('google_sheet');
                    setPreviewData(null);
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
                    sourceType === 'google_sheet'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Link Google Spreadsheet Publik</span>
                </button>
              </div>
            </div>

            {sourceType === 'file' ? (
              <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedFile ? selectedFile.name : 'Pilih file Excel (.xlsx) atau CSV (.csv)'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedFile
                      ? `Ukuran berkas: ${(selectedFile.size / 1024).toFixed(1)} KB — Siap divalidasi`
                      : 'Maksimal 5 MB. Pastikan baris header sesuai dengan template resmi.'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{selectedFile ? 'Ganti Berkas' : 'Pilih Berkas'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  URL Google Spreadsheet (Pastikan akses disetel: &quot;Siapa saja yang memiliki link dapat melihat&quot;)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/1ABC.../edit?usp=sharing"
                    value={googleSheetUrl}
                    onChange={(e) => {
                      setGoogleSheetUrl(e.target.value);
                      setPreviewData(null);
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Jika URL memiliki parameter <code>#gid=...</code>, tab sheet tersebut otomatis diambil saat validasi.</span>
                </p>
              </div>
            )}

            {/* Conflict Mode & Validate CTA */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Jika Produk &amp; Varian Tipe sudah ada di katalog:
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="importConflictMode"
                      checked={conflictMode === 'add_stock_only'}
                      onChange={() => {
                        setConflictMode('add_stock_only');
                        setPreviewData(null);
                      }}
                    />
                    <span>Tambahkan stok awal ke varian yang sudah ada</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="importConflictMode"
                      checked={conflictMode === 'skip_existing'}
                      onChange={() => {
                        setConflictMode('skip_existing');
                        setPreviewData(null);
                      }}
                    />
                    <span>Lewati baris yang sudah ada</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePreview}
                disabled={validating || (sourceType === 'file' ? !selectedFile : !googleSheetUrl.trim())}
                className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {validating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                <span>{validating ? 'Memvalidasi...' : 'Pratinjau & Validasi Data'}</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-start gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 3: Pratinjau Hasil Validasi */}
          {previewData && (
            <div className="space-y-3">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Baris</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white font-mono">{previewData.totalRows}</span>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Item Baru</span>
                  <span className="text-base font-bold text-emerald-800 dark:text-emerald-300 font-mono">{previewData.newCatalogItems}</span>
                </div>
                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                  <span className="text-[10px] uppercase font-bold text-sky-700 dark:text-sky-400 block">Tambah Stok</span>
                  <span className="text-base font-bold text-sky-800 dark:text-sky-300 font-mono">{previewData.existingCatalogItems}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Valid Siap</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white font-mono">{previewData.validRows}</span>
                </div>
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">Error Baris</span>
                  <span className="text-base font-bold text-rose-700 dark:text-rose-300 font-mono">{previewData.errorRows}</span>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">Total Unit Stok</span>
                  <span className="text-base font-bold text-amber-800 dark:text-amber-300 font-mono">+{previewData.totalStockToAdd}</span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">Baris</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Kategori</th>
                        <th className="p-2.5">Produk &amp; Tipe</th>
                        <th className="p-2.5">Mode ID</th>
                        <th className="p-2.5">Box</th>
                        <th className="p-2.5 text-right">Stok Awal</th>
                        <th className="p-2.5">Catatan Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {previewData.rows.map((row) => {
                        const badgeClass =
                          row.rowState === 'new'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : row.rowState === 'existing_add_stock'
                            ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                            : row.rowState === 'skip'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
                        const badgeText =
                          row.rowState === 'new'
                            ? 'Baru'
                            : row.rowState === 'existing_add_stock'
                            ? 'Tambah Stok'
                            : row.rowState === 'skip'
                            ? 'Lewati'
                            : 'Error';

                        return (
                          <tr
                            key={row.rowNumber}
                            className={row.rowState === 'error' ? 'bg-rose-50/40 dark:bg-rose-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}
                          >
                            <td className="p-2.5 font-mono text-slate-500">#{row.rowNumber}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded font-semibold border whitespace-nowrap ${badgeClass}`}>
                                {badgeText}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-700 dark:text-slate-300">{row.kategori || '-'}</td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-900 dark:text-white">{row.produk || '-'}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                Varian: {row.tipeVarian || 'Standar'} · {row.satuan}
                              </div>
                            </td>
                            <td className="p-2.5 font-mono text-slate-600 dark:text-slate-300">
                              <div>
                                {row.sumberId}
                                {row.prefixId ? ` (${row.prefixId})` : ''}
                              </div>
                              {row.polaId && (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate max-w-[160px]" title={row.polaId}>
                                  Regex: {row.polaId}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {row.kodeBox || '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {row.stokAwal}
                              {row.serialNumbers.length > 0 && (
                                <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 font-normal">
                                  {row.serialNumbers.length} SN
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-400 max-w-xs">
                              {row.messages.length > 0 ? row.messages.join(' ') : 'Siap diimpor'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            {previewData
              ? `Sumber: ${previewData.sourceLabel} · ${actionableCount} baris siap diproses${previewData.errorRows > 0 ? ` (${previewData.errorRows} baris error akan diabaikan)` : ''}.`
              : 'Lakukan pratinjau validasi untuk melihat data sebelum disimpan ke database.'}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={resetAllAndClose}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={committing || actionableCount === 0}
              className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 disabled:opacity-50 shadow-xs whitespace-nowrap"
            >
              {committing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{committing ? 'Mengimpor...' : `Konfirmasi & Impor (${actionableCount})`}</span>
              {!committing && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
