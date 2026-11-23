/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import {
  activityApi,
  CanonicalTransactionView,
  DebugClockResponse,
  DEFAULT_REPORT_APPROVAL_CONFIG,
  ReportApprovalConfig,
  ReportSignerConfig,
  WeeklyReportResponse
} from '../services/activityApi';
import {
  Download,
  Printer,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  Save
} from 'lucide-react';
import { exportWeeklyReportToExcel } from '../utils/excelExporter';
import { sanitizeFormulaInput } from '../utils/security';
import { isWarehouseManager } from '../utils/permissions';
import { getErrorMessage } from '../utils/errorUtils';
import {
  APP_TIMEZONE,
  formatWibDateTime,
  getWibDateKey,
  getWibWeekRange,
  parseDateSafe
} from '../utils/timezone';
import { PrintReportModal } from './reports/PrintReportModal';

interface WeeklyRow {
  rowKey: string;
  sku: string;
  name: string;
  categoryName: string;
  location: string;
  startStock: number;
  totalIn: number;
  totalOut: number;
  endStock: number;
  reservedStock: number;
  unit: string;
  status: 'AMAN' | 'MENIPIS' | 'HABIS';
  lowThreshold: number;
}

export const WeeklyReport: React.FC = () => {
  const { user } = useAuth();
  const { products, transactions, showToast } = useInventory();

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<'current' | 'previous' | 'all'>('current');
  const [reportData, setReportData] = useState<WeeklyReportResponse | null>(null);
  const [clockInfo, setClockInfo] = useState<DebugClockResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const canSaveApprovalConfig = isWarehouseManager(user?.role);
  const [approvalConfig, setApprovalConfig] = useState<ReportApprovalConfig>(DEFAULT_REPORT_APPROVAL_CONFIG);
  const [isEditingApproval, setIsEditingApproval] = useState(false);
  const [savingApprovalConfig, setSavingApprovalConfig] = useState(false);

  useEffect(() => {
    let active = true;
    activityApi
      .getReportApprovalConfig()
      .then((cfg) => {
        if (active && cfg) setApprovalConfig(cfg);
      })
      .catch(() => {
        // Fallback default config tetap aktif
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSignerChange = (idx: 0 | 1 | 2, patch: Partial<ReportSignerConfig>) => {
    setApprovalConfig((prev) => {
      const nextSigners = [...prev.signers] as [ReportSignerConfig, ReportSignerConfig, ReportSignerConfig];
      nextSigners[idx] = { ...nextSigners[idx], ...patch };
      return { ...prev, signers: nextSigners };
    });
  };

  const handleSaveApprovalConfig = async () => {
    if (!canSaveApprovalConfig) return;
    setSavingApprovalConfig(true);
    try {
      const res = await activityApi.updateReportApprovalConfig(approvalConfig);
      setApprovalConfig(res.config);
      showToast(res.message || 'Konfigurasi Kop & Lembar Pengesahan berhasil disimpan.', 'success');
      setIsEditingApproval(false);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Gagal menyimpan konfigurasi pengesahan.'), 'error');
    } finally {
      setSavingApprovalConfig(false);
    }
  };

  const loadReportAndClock = async (weekMode: 'current' | 'previous' | 'all') => {
    setLoadingReport(true);
    try {
      const [rep, clk] = await Promise.all([
        activityApi.getWeeklyReport(weekMode),
        activityApi.getDebugClock()
      ]);
      setReportData(rep);
      setClockInfo(clk);
    } catch {
      // Fallback ke komputasi client jika endpoint sementara gagal
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoadingReport(true);
    Promise.all([
      activityApi.getWeeklyReport(selectedWeek),
      activityApi.getDebugClock()
    ])
      .then(([rep, clk]) => {
        if (!active) return;
        setReportData(rep);
        setClockInfo(clk);
      })
      .catch(() => {
        // Fallback client-side range tetap aktif
      })
      .finally(() => {
        if (active) setLoadingReport(false);
      });
    return () => {
      active = false;
    };
  }, [selectedWeek, transactions.length, products.length]);

  const fallbackRange = useMemo(() => {
    if (selectedWeek === 'all') {
      return {
        label: 'Seluruh Riwayat Waktu (WIB)',
        startUtcIso: '2020-01-01T00:00:00.000Z',
        endUtcIso: new Date().toISOString()
      };
    }
    return getWibWeekRange(selectedWeek === 'previous' ? -1 : 0);
  }, [selectedWeek]);

  const periodLabel = reportData?.reportPeriod?.label || fallbackRange.label;

  const weekTransactions: CanonicalTransactionView[] = useMemo(() => {
    if (reportData?.transactions) return reportData.transactions;
    if (selectedWeek === 'all') return transactions;
    const startMs = new Date(fallbackRange.startUtcIso).getTime();
    const endMs = new Date(fallbackRange.endUtcIso).getTime();
    return transactions.filter((tx) => {
      const ms = parseDateSafe(tx.occurred_at || tx.waktu).getTime();
      return ms >= startMs && ms <= endMs;
    });
  }, [reportData, transactions, selectedWeek, fallbackRange]);

  const itemWeeklyStats: WeeklyRow[] = useMemo(() => {
    const inByTipe = new Map<number, number>();
    const outByTipe = new Map<number, number>();

    for (const tx of weekTransactions) {
      if (tx.type !== 'IN' && tx.type !== 'OUT') continue;
      const details = tx.details || [];
      if (details.length > 0) {
        for (const d of details) {
          if (!d.tipe_id) continue;
          const qty = Number(d.jumlah || 1);
          if (tx.type === 'IN') {
            inByTipe.set(d.tipe_id, (inByTipe.get(d.tipe_id) || 0) + qty);
          } else {
            outByTipe.set(d.tipe_id, (outByTipe.get(d.tipe_id) || 0) + qty);
          }
        }
      } else if (tx.tipe_id) {
        const qty = Number(tx.quantity || 0);
        if (tx.type === 'IN') {
          inByTipe.set(tx.tipe_id, (inByTipe.get(tx.tipe_id) || 0) + qty);
        } else {
          outByTipe.set(tx.tipe_id, (outByTipe.get(tx.tipe_id) || 0) + qty);
        }
      }
    }

    const rows: WeeklyRow[] = [];
    for (const p of products) {
      const tipes = p.tipes || [];
      if (tipes.length === 0) {
        const avail = Number(p.total_stok || 0);
        const statusUpper = String(p.status_stok || (avail === 0 ? 'habis' : 'aman')).toUpperCase();
        rows.push({
          rowKey: `prod-${p.id}`,
          sku: `PROD-${p.id}`,
          name: p.nama,
          categoryName: p.jenis_nama || '-',
          location: '-',
          startStock: avail,
          totalIn: 0,
          totalOut: 0,
          endStock: avail,
          reservedStock: Number(p.total_dipesan || 0),
          unit: p.tipe_stok || 'unit',
          status: statusUpper === 'HABIS' ? 'HABIS' : statusUpper === 'MENIPIS' ? 'MENIPIS' : 'AMAN',
          lowThreshold: 2
        });
      } else {
        for (const t of tipes) {
          const totalIn = inByTipe.get(t.id) || 0;
          const totalOut = outByTipe.get(t.id) || 0;
          const endStock = Number(t.stok_tersedia || 0);
          const startStock = Math.max(0, endStock - totalIn + totalOut);
          const statusUpper = String(t.status_stok || (endStock === 0 ? 'habis' : 'aman')).toUpperCase();
          const locationText = (t.sebaran_box || []).map(b => `${b.box_kode}:${b.jumlah}`).join(', ') || '-';

          rows.push({
            rowKey: `tipe-${t.id}`,
            sku: t.prefix_id || `TIPE-${t.id}`,
            name: `${p.nama} — ${t.nama_tipe}`,
            categoryName: p.jenis_nama || '-',
            location: locationText,
            startStock,
            totalIn,
            totalOut,
            endStock,
            reservedStock: Number(t.stok_dipesan || 0),
            unit: p.tipe_stok || 'unit',
            status: statusUpper === 'HABIS' ? 'HABIS' : statusUpper === 'MENIPIS' ? 'MENIPIS' : 'AMAN',
            lowThreshold: Number(t.threshold?.lowStockThreshold ?? 2)
          });
        }
      }
    }
    return rows;
  }, [products, weekTransactions]);

  const totalInflow = reportData?.summary?.totalInQty ?? weekTransactions.filter(t => t.type === 'IN').reduce((s, t) => s + Number(t.quantity || 0), 0);
  const totalOutflow = reportData?.summary?.totalOutQty ?? weekTransactions.filter(t => t.type === 'OUT').reduce((s, t) => s + Number(t.quantity || 0), 0);
  const criticalItems = itemWeeklyStats.filter(i => i.status === 'MENIPIS');
  const outOfStockItems = itemWeeklyStats.filter(i => i.status === 'HABIS');

  const topConsumedItems = useMemo(() => {
    return [...itemWeeklyStats]
      .filter(i => i.totalOut > 0)
      .sort((a, b) => b.totalOut - a.totalOut)
      .slice(0, 5);
  }, [itemWeeklyStats]);

  const handleExportCSV = () => {
    const headers = [
      'SKU / Kode',
      'Nama Produk & Varian',
      'Jenis',
      'Stok Awal (Est.)',
      'Masuk (+)',
      'Keluar (-)',
      'Stok Akhir Tersedia',
      'Dipesan',
      'Satuan',
      'Status Stok',
      'Sebaran Box'
    ];

    const sanitizeCsvVal = (val: string | number | undefined) => {
      const sanitized = sanitizeFormulaInput(String(val ?? ''));
      return `"${sanitized.replace(/"/g, '""')}"`;
    };

    const rows = itemWeeklyStats.map(i => [
      sanitizeCsvVal(i.sku),
      sanitizeCsvVal(i.name),
      sanitizeCsvVal(i.categoryName),
      i.startStock,
      i.totalIn,
      i.totalOut,
      i.endStock,
      i.reservedStock,
      sanitizeCsvVal(i.unit),
      i.status,
      sanitizeCsvVal(i.location)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Stok_Mingguan_${selectedWeek}_${getWibDateKey(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('File CSV laporan mingguan berhasil diunduh.', 'success');
  };

  const handleExportExcel = () => {
    exportWeeklyReportToExcel(
      weekTransactions,
      `Laporan_Mutasi_Stok_${selectedWeek}_${getWibDateKey(new Date())}.xlsx`
    );
  };

  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    } catch {
      return 'unknown';
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
              <span>Laporan Berkala</span>
              <span aria-hidden="true">·</span>
              <span>Batas Pekan Senin–Minggu (WIB)</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">{periodLabel}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Laporan Stok Mingguan Teknisi IT
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Ringkasan pergerakan stok awal, penerimaan, pengeluaran lapangan, dan status varian dari sumber katalog tunggal.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setSelectedWeek('current')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedWeek === 'current'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pekan Ini
              </button>
              <button
                onClick={() => setSelectedWeek('previous')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedWeek === 'previous'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pekan Lalu
              </button>
              <button
                onClick={() => setSelectedWeek('all')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedWeek === 'all'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua
              </button>
            </div>

            <button
              onClick={() => loadReportAndClock(selectedWeek)}
              disabled={loadingReport}
              className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Muat ulang laporan & verifikasi jam server"
            >
              <RefreshCw className={`w-4 h-4 ${loadingReport ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Weekly KPI Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Barang Keluar (Periode)</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {totalOutflow}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>{reportData?.summary?.totalOutTxCount ?? weekTransactions.filter(t => t.type === 'OUT').length} transaksi keluar</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Barang Masuk (Periode)</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
              +{totalInflow}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{reportData?.summary?.totalInTxCount ?? weekTransactions.filter(t => t.type === 'IN').length} transaksi masuk</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Varian Stok Menipis</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-0.5">
              {criticalItems.length}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
              Perlu pengajuan restock
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Varian Kosong / Habis</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400 mt-0.5">
              {outOfStockItems.length}
            </div>
            <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
              {reportData?.summary?.heldByTechniciansCount
                ? `${reportData.summary.heldByTechniciansCount} sedang dibawa teknisi`
                : 'Prioritas restock mendesak'}
            </div>
          </div>
        </div>
      </div>

      {/* Temporary Server Clock Verification Panel (UTC vs WIB vs Browser) */}
      <div className="bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Verifikasi Jam Server &amp; Zona Waktu Laporan ({APP_TIMEZONE})</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            TZ Env Server: {clockInfo?.processTzEnv || '-'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px]">
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="text-slate-400 dark:text-slate-500 font-sans">Waktu Server (UTC Penyimpanan):</div>
            <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
              {clockInfo?.serverUtcIso || new Date().toISOString()}
            </div>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="text-slate-400 dark:text-slate-500 font-sans">Waktu Server (WIB Tampilan):</div>
            <div className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
              {clockInfo?.serverWibFormatted || formatWibDateTime(new Date())}
            </div>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="text-slate-400 dark:text-slate-500 font-sans">Browser Lokal ({browserTz}) -&gt; WIB:</div>
            <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
              {formatWibDateTime(new Date())}
            </div>
          </div>
        </div>
      </div>

      {/* Top Consumed Items Panel */}
      {topConsumedItems.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                5 Varian Paling Banyak Keluar ({periodLabel})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Peringkat varian dengan volume keluar tertinggi oleh teknisi.
              </p>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">High Demand</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
            {topConsumedItems.map((top, idx) => (
              <div
                key={top.rowKey}
                className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-xs"
              >
                <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                  <span className="font-mono text-[11px] font-bold">#0{idx + 1}</span>
                  <span className="text-[10px] uppercase font-mono">{top.categoryName.split(' ')[0]}</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={top.name}>
                  {top.name}
                </div>
                <div className="mt-2 flex items-baseline justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Keluar:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {top.totalOut} {top.unit}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 text-right font-mono tabular-nums">
                  Sisa: {top.endStock} {top.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comprehensive Movement Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Matriks Pergerakan Stok Produk &amp; Varian Mingguan
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Komparasi estimasi stok awal vs mutasi masuk/keluar vs stok fisik tersedia akhir.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Total {itemWeeklyStats.length} varian aktif
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
              <tr>
                <th className="py-3 px-4">SKU / Kode</th>
                <th className="py-3 px-4">Produk &amp; Varian</th>
                <th className="py-3 px-4">Jenis</th>
                <th className="py-3 px-4 text-right">Stok Awal</th>
                <th className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400">Masuk (+)</th>
                <th className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">Keluar (-)</th>
                <th className="py-3 px-4 text-right font-bold">Stok Akhir</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Rekomendasi Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {itemWeeklyStats.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Belum ada produk atau varian aktif pada katalog.
                  </td>
                </tr>
              ) : (
                itemWeeklyStats.map((item) => {
                  const isOutOfStock = item.status === 'HABIS';
                  const isLowStock = item.status === 'MENIPIS';
                  const suggestedOrder = isOutOfStock || isLowStock ? Math.max(item.lowThreshold * 2 - item.endStock, 5) : 0;

                  return (
                    <tr key={item.rowKey} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 max-w-xs font-medium text-slate-900 dark:text-slate-100">
                        <div className="truncate" title={item.name}>{item.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate">
                          Box: {item.location}
                          {item.reservedStock > 0 ? ` · Dipesan: ${item.reservedStock}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.categoryName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {item.startStock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                        {item.totalIn > 0 ? `+${item.totalIn}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 font-medium">
                        {item.totalOut > 0 ? `-${item.totalOut}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                        <span
                          className={
                            isOutOfStock
                              ? 'text-red-600 dark:text-red-400'
                              : isLowStock
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }
                        >
                          {item.endStock}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal ml-1">
                          {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            isOutOfStock
                              ? 'text-red-700 dark:text-red-400'
                              : isLowStock
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono tabular-nums">
                        {suggestedOrder > 0 ? (
                          <span className="text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                            Pesan +{suggestedOrder} {item.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]">Tercukupi</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Printable & On-Screen Formal Approval Block */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
            <div className="font-mono space-y-0.5">
              <div className="font-bold text-slate-700 dark:text-slate-200">
                Lembar Pengesahan Auditing Inventori IT · {approvalConfig.companyName}
              </div>
              <div className="text-[11px]">
                Waktu Laporan: {formatWibDateTime(new Date())}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingApproval((v) => !v)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 self-start sm:self-center shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isEditingApproval ? 'Tutup Pengaturan Pengesahan' : 'Sesuaikan Kop & Penandatangan'}</span>
            </button>
          </div>

          {isEditingApproval && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Kustomisasi Kop Surat &amp; Penandatangan (Aktif di Pratinjau &amp; Cetak Production)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Perubahan langsung terlihat pada pratinjau &amp; dokumen cetak. {canSaveApprovalConfig ? 'Klik Simpan Permanen agar tersimpan untuk seluruh sesi.' : 'Anda dapat menyesuaikan sementara sebelum mencetak laporan.'}
                  </p>
                </div>
                {canSaveApprovalConfig && (
                  <button
                    type="button"
                    disabled={savingApprovalConfig}
                    onClick={handleSaveApprovalConfig}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingApprovalConfig ? 'Menyimpan...' : 'Simpan Permanen'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Perusahaan (Kop Surat)
                  </label>
                  <input
                    type="text"
                    value={approvalConfig.companyName}
                    onChange={(e) => setApprovalConfig((prev) => ({ ...prev, companyName: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Divisi / Unit Operasional
                  </label>
                  <input
                    type="text"
                    value={approvalConfig.divisionName}
                    onChange={(e) => setApprovalConfig((prev) => ({ ...prev, divisionName: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alamat &amp; Kontak Kop
                  </label>
                  <input
                    type="text"
                    value={approvalConfig.companyAddress}
                    onChange={(e) => setApprovalConfig((prev) => ({ ...prev, companyAddress: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                {approvalConfig.signers.map((signer, idx) => {
                  const slotIdx = idx as 0 | 1 | 2;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-2"
                    >
                      <div className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        Penandatangan {idx + 1}
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
                          Label Peran
                        </label>
                        <input
                          type="text"
                          value={signer.roleLabel}
                          onChange={(e) => handleSignerChange(slotIdx, { roleLabel: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
                          Nama Penandatangan
                        </label>
                        <input
                          type="text"
                          value={signer.name}
                          disabled={signer.useCurrentUser}
                          onChange={(e) => handleSignerChange(slotIdx, { name: e.target.value })}
                          placeholder={signer.useCurrentUser ? (user?.name || 'Mengikuti akun login') : 'Nama lengkap...'}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
                          Jabatan
                        </label>
                        <input
                          type="text"
                          value={signer.title}
                          onChange={(e) => handleSignerChange(slotIdx, { title: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={signer.useCurrentUser}
                          onChange={(e) => handleSignerChange(slotIdx, { useCurrentUser: e.target.checked })}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Gunakan nama akun login ({user?.name || 'User'})</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-xs text-slate-700 dark:text-slate-300">
            {approvalConfig.signers.map((signer, idx) => {
              const resolvedName = signer.useCurrentUser
                ? (user?.name || signer.name)
                : signer.name;
              return (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {idx + 1}. {signer.roleLabel}:
                  </p>
                  <div className="h-16 flex items-center justify-center">
                    <span className="text-slate-300 dark:text-slate-600 font-mono text-[11px] font-bold tracking-widest">
                      ( Tanda Tangan )
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-slate-100 underline">{resolvedName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{signer.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Formal A4 Print Report Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        periodLabel={periodLabel}
        approvalConfig={approvalConfig}
        itemsData={itemWeeklyStats.map(i => ({
          sku: i.sku,
          name: i.name,
          categoryName: i.categoryName,
          location: i.location,
          startStock: i.startStock,
          totalIn: i.totalIn,
          totalOut: i.totalOut,
          endStock: i.endStock,
          unit: i.unit,
          status: i.status
        }))}
        totalInflow={totalInflow}
        totalOutflow={totalOutflow}
        criticalCount={criticalItems.length}
        outOfStockCount={outOfStockItems.length}
      />
    </div>
  );
};
