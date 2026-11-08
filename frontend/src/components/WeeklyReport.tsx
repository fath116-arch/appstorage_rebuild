/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { 
  Calendar, 
  Download, 
  Printer, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  FileText,
  Boxes,
  Activity,
  FileSpreadsheet
} from 'lucide-react';
import { exportWeeklyReportToExcel } from '../utils/excelExporter';
import { sanitizeFormulaInput } from '../utils/security';
import { PrintReportModal } from './reports/PrintReportModal';

import { useAuth } from '../context/AuthContext';

export const WeeklyReport: React.FC = () => {
  const { user } = useAuth();
  const { items, transactions, categories } = useInventory();

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Preset week periods
  const [selectedWeek, setSelectedWeek] = useState<'current' | 'previous' | 'all'>('current');

  // Compute date range based on selected week
  const dateRange = useMemo(() => {
    const now = new Date(2026, 9, 25); // Oct 25, 2026 reference
    if (selectedWeek === 'current') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return {
        label: 'Pekan Berjalan (19 Okt - 25 Okt 2026)',
        startDate: start,
        endDate: now,
      };
    } else if (selectedWeek === 'previous') {
      const end = new Date(now);
      end.setDate(now.getDate() - 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return {
        label: 'Pekan Lalu (12 Okt - 18 Okt 2026)',
        startDate: start,
        endDate: end,
      };
    } else {
      return {
        label: 'Akumulasi Keseluruhan Riwayat',
        startDate: new Date(2026, 8, 1),
        endDate: now,
      };
    }
  }, [selectedWeek]);

  // Filter transactions within the selected range
  const weekTransactions = useMemo(() => {
    if (selectedWeek === 'all') return transactions;
    return transactions.filter((tx: any) => {
      const txDate = new Date(tx.created_at || tx.date || Date.now());
      return txDate >= dateRange.startDate && txDate <= dateRange.endDate;
    });
  }, [transactions, selectedWeek, dateRange]);

  // Compute weekly stats per item
  const itemWeeklyStats = useMemo(() => {
    return items.map((item: any) => {
      // Find transactions for this item in this week
      const itemTxs = weekTransactions.filter((tx: any) => (tx.item_id || tx.itemId) === item.id);
      const totalIn = itemTxs
        .filter((tx: any) => tx.type === 'IN')
        .reduce((sum, tx: any) => sum + tx.quantity, 0);
      const totalOut = itemTxs
        .filter((tx: any) => tx.type === 'OUT')
        .reduce((sum, tx: any) => sum + tx.quantity, 0);

      // Estimated starting stock at beginning of the week
      const calculatedStart = Math.max(0, item.quantity - totalIn + totalOut);

      return {
        ...item,
        min_stock_alert: item.min_stock_alert ?? item.minStockAlert ?? 0,
        startStock: calculatedStart,
        totalIn,
        totalOut,
        endStock: item.quantity,
        netChange: totalIn - totalOut,
        turnoverRate: calculatedStart > 0 ? ((totalOut / calculatedStart) * 100).toFixed(1) : '0',
      };
    });
  }, [items, weekTransactions]);

  // Aggregate totals
  const totalInflow = itemWeeklyStats.reduce((sum, i) => sum + i.totalIn, 0);
  const totalOutflow = itemWeeklyStats.reduce((sum, i) => sum + i.totalOut, 0);
  const criticalItems = items.filter((i: any) => i.quantity <= (i.min_stock_alert ?? i.minStockAlert ?? 0));
  const outOfStockItems = items.filter((i: any) => i.quantity === 0);

  // Top 5 consumed items for field tickets
  const topConsumedItems = useMemo(() => {
    const sorted = [...itemWeeklyStats].filter(i => i.totalOut > 0).sort((a, b) => b.totalOut - a.totalOut);
    return sorted.slice(0, 5);
  }, [itemWeeklyStats]);

  // Export CSV handler
  const handleExportCSV = () => {
    const headers = [
      'SKU',
      'Nama Barang',
      'Kategori',
      'Stok Awal',
      'Masuk (+)',
      'Keluar (-)',
      'Stok Akhir',
      'Satuan',
      'Batas Min Alert',
      'Status Stok',
      'Lokasi Penyimpanan'
    ];

    const sanitizeCsvVal = (val: string | number | undefined) => {
      const sanitized = sanitizeFormulaInput(String(val ?? ''));
      return `"${sanitized.replace(/"/g, '""')}"`;
    };

    const rows = itemWeeklyStats.map((i: any) => [
      sanitizeCsvVal(i.sku),
      sanitizeCsvVal(i.name),
      sanitizeCsvVal(i.categoryName),
      i.startStock,
      i.totalIn,
      i.totalOut,
      i.endStock,
      sanitizeCsvVal(i.unit),
      i.min_stock_alert,
      i.quantity === 0 ? 'HABIS' : i.quantity <= i.min_stock_alert ? 'MENIPIS' : 'AMAN',
      sanitizeCsvVal(i.location)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Stok_Mingguan_${selectedWeek}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    exportWeeklyReportToExcel(weekTransactions as any, `Laporan_Mutasi_Stok_${selectedWeek}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Laporan Berkala</span>
              <span aria-hidden="true">·</span>
              <span>Audit Arus Barang & Suku Cadang</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">{dateRange.label}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Laporan Stok Mingguan Teknisi IT
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Ringkasan pergerakan stok awal, penerimaan pengadaan (PO), dan pemakaian suku cadang perbaikan tiket insiden lapangan selama 1 pekan.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Week Selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setSelectedWeek('current')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedWeek === 'current' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pekan Ini
              </button>
              <button
                onClick={() => setSelectedWeek('previous')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedWeek === 'previous' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pekan Lalu
              </button>
              <button
                onClick={() => setSelectedWeek('all')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedWeek === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua
              </button>
            </div>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
              title="Download laporan lengkap dalam format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
              title="Download file CSV"
            >
              <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
              title="Cetak format laporan resmi"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Weekly KPI Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Suku Cadang Terpakai (Tiket)</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {totalOutflow}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Pengeluaran pekan ini</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Barang Masuk / Restock PO</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
              +{totalInflow}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Penerimaan fisik baru</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Item Stok Menipis</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-0.5">
              {criticalItems.length}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
              Perlu pengajuan PO
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Barang Kosong / Habis</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400 mt-0.5">
              {outOfStockItems.length}
            </div>
            <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
              Prioritas restock mendesak
            </div>
          </div>
        </div>
      </div>

      {/* Top Consumed Items for Tickets Panel */}
      {topConsumedItems.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                5 Suku Cadang Paling Banyak Terpakai di Tiket Lapangan (Pekan Ini)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Peringkat barang dengan frekuensi penggunaan tertinggi oleh teknisi untuk perbaikan insiden.
              </p>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">High Demand</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
            {topConsumedItems.map((top, idx) => (
              <div key={top.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-xs">
                <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                  <span className="font-mono text-[11px] font-bold">#0{idx + 1}</span>
                  <span className="text-[10px] uppercase font-mono">{top.categoryName.split(' ')[0]}</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={top.name}>
                  {top.name}
                </div>
                <div className="mt-2 flex items-baseline justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Terpakai:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {top.totalOut} {top.unit}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 text-right font-mono">
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
              Matriks Pergerakan Stok Suku Cadang Mingguan
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Laporan formal komparasi stok awal vs mutasi masuk/keluar vs stok fisik akhir.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Total {itemWeeklyStats.length} jenis suku cadang
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
              <tr>
                <th className="py-3 px-4">SKU / Kode</th>
                <th className="py-3 px-4">Nama Suku Cadang</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">Stok Awal</th>
                <th className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400">Masuk (+)</th>
                <th className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">Keluar (-)</th>
                <th className="py-3 px-4 text-right font-bold">Stok Akhir</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Rekomendasi Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {itemWeeklyStats.map((item) => {
                const isOutOfStock = item.endStock === 0;
                const isLowStock = item.endStock <= item.minStockAlert;
                const suggestedOrder = isLowStock ? Math.max(item.minStockAlert * 2 - item.endStock, 5) : 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                      {item.sku}
                    </td>
                    <td className="py-3 px-4 max-w-xs font-medium text-slate-900 dark:text-slate-100">
                      <div className="truncate" title={item.name}>{item.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Lokasi: {item.location}</div>
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
                      <span className={isOutOfStock ? 'text-red-600 dark:text-red-400' : isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}>
                        {item.endStock}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal ml-1">{item.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`text-xs font-semibold ${
                        isOutOfStock ? 'text-red-700 dark:text-red-400' : isLowStock ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {isOutOfStock ? 'HABIS' : isLowStock ? 'MENIPIS' : 'AMAN'}
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
              })}
            </tbody>
          </table>
        </div>

        {/* Printable & On-Screen Formal Approval Block */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 mb-6 font-mono">
            <span>Lembar Pengesahan Auditing Inventori IT</span>
            <span>Dicetak Tanggal: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center text-xs text-slate-700 dark:text-slate-300">
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">1. Dibuat Oleh (Admin Logistik):</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-slate-300 dark:text-slate-600 font-mono text-[11px] font-bold tracking-widest">( Tanda Tangan )</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 underline">Siti Rahma</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Admin Inventori & Logistik IT</p>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">2. Diverifikasi (Teknisi Lapangan):</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-slate-300 dark:text-slate-600 font-mono text-[11px] font-bold tracking-widest">( Tanda Tangan )</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 underline">Budi Santoso</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Lead Field Technician</p>
            </div>

            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">3. Disetujui Oleh (Supervisor IT):</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-slate-300 dark:text-slate-600 font-mono text-[11px] font-bold tracking-widest">( Tanda Tangan )</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 underline">Hendra Wijaya, S.Kom</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Supervisor IT Infrastructure</p>
            </div>
          </div>
        </div>
      </div>

      {/* Formal A4 Print Report Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        periodLabel={dateRange.label}
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
          status: (i.endStock === 0 ? 'HABIS' : i.endStock <= i.minStockAlert ? 'MENIPIS' : 'AMAN') as any
        }))}
        totalInflow={totalInflow}
        totalOutflow={totalOutflow}
        criticalCount={criticalItems.length}
        outOfStockCount={outOfStockItems.length}
      />
    </div>
  );
};
