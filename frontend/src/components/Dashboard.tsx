/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { ArrowUpRight, Wrench } from 'lucide-react';
import { DashboardKpiCards } from './dashboard/DashboardKpiCards';
import { TrendAreaChart } from './dashboard/TrendAreaChart';
import { TopMovingBarChart } from './dashboard/TopMovingBarChart';
import { CategoryDonutChart } from './dashboard/CategoryDonutChart';
import {
  formatWibShortDate,
  getWibDateKey,
  getWibDaysRange,
  parseDateSafe
} from '../utils/timezone';

interface DashboardProps {
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onOpenChecklist: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenStockOut,
  onOpenChecklist
}) => {
  const { products, jenisList, transactions, heldItems, setActiveTab } = useInventory();

  const [timeRangeDays, setTimeRangeDays] = useState<30 | 14 | 7>(30);

  const daysRange = useMemo(() => getWibDaysRange(timeRangeDays), [timeRangeDays]);

  const rangeTransactions = useMemo(() => {
    const startMs = new Date(daysRange.startUtcIso).getTime();
    const endMs = new Date(daysRange.endUtcIso).getTime();
    return transactions.filter((tx) => {
      const txMs = parseDateSafe(tx.occurred_at || tx.waktu).getTime();
      return txMs >= startMs && txMs <= endMs;
    });
  }, [transactions, daysRange]);

  // Daily WIB inflow & outflow trends over selected range
  const trendData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const daysMap: Record<string, { dateLabel: string; fullDate: string; inflow: number; outflow: number; net: number }> = {};

    for (const dateKey of daysRange.dayKeys) {
      const [, mm, dd] = dateKey.split('-');
      const monthIdx = Math.max(0, Math.min(11, Number(mm) - 1));
      daysMap[dateKey] = {
        dateLabel: `${dd} ${monthNames[monthIdx]}`,
        fullDate: dateKey,
        inflow: 0,
        outflow: 0,
        net: 0
      };
    }

    for (const tx of rangeTransactions) {
      const key = getWibDateKey(tx.occurred_at || tx.waktu);
      const bucket = daysMap[key];
      if (!bucket) continue;
      if (tx.type === 'IN') {
        bucket.inflow += Number(tx.quantity || 0);
      } else if (tx.type === 'OUT') {
        bucket.outflow += Number(tx.quantity || 0);
      }
      bucket.net = bucket.inflow - bucket.outflow;
    }

    return Object.values(daysMap);
  }, [rangeTransactions, daysRange]);

  // Top moving items from canonical OUT transactions + live product/tipe stock
  const topMovingItems = useMemo(() => {
    const tipeMap = new Map<number, { name: string; sku: string; stock: number; unit: string; isLow: boolean }>();
    for (const p of products) {
      for (const t of p.tipes || []) {
        tipeMap.set(t.id, {
          name: `${p.nama} - ${t.nama_tipe}`,
          sku: t.prefix_id || `TIPE-${t.id}`,
          stock: Number(t.stok_tersedia || 0),
          unit: p.tipe_stok || 'unit',
          isLow: t.status_stok === 'menipis' || t.status_stok === 'habis'
        });
      }
    }

    const agg = new Map<
      string,
      {
        name: string;
        fullName: string;
        sku: string;
        consumed: number;
        unit: string;
        tickets: number;
        stock: number;
        isLow: boolean;
      }
    >();

    for (const tx of rangeTransactions) {
      if (tx.type !== 'OUT') continue;
      const details = tx.details && tx.details.length > 0
        ? tx.details
        : [
            {
              tipe_id: tx.tipe_id,
              kode_id: tx.item_sku,
              nama_snapshot: tx.item_name,
              jumlah: tx.quantity
            }
          ];

      for (const d of details) {
        const tipeInfo = d.tipe_id ? tipeMap.get(d.tipe_id) : undefined;
        const fullName = tipeInfo?.name || d.nama_snapshot || tx.item_name || 'Barang';
        const key = d.tipe_id ? `tipe-${d.tipe_id}` : fullName;

        const existing = agg.get(key) || {
          name: fullName.length > 24 ? `${fullName.slice(0, 22)}...` : fullName,
          fullName,
          sku: tipeInfo?.sku || d.kode_id || tx.item_sku || '-',
          consumed: 0,
          unit: tipeInfo?.unit || tx.item_unit || 'unit',
          tickets: 0,
          stock: tipeInfo?.stock ?? 0,
          isLow: tipeInfo?.isLow ?? false
        };

        existing.consumed += Number(d.jumlah || 1);
        existing.tickets += 1;
        agg.set(key, existing);
      }
    }

    return Array.from(agg.values())
      .sort((a, b) => b.consumed - a.consumed)
      .slice(0, 7);
  }, [rangeTransactions, products]);

  // Stock volume breakdown by canonical Jenis
  const categoryData = useMemo(() => {
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
    return jenisList
      .map((jenis, idx) => {
        const prods = products.filter(p => p.jenis_id === jenis.id);
        const totalQuantity = prods.reduce((sum, p) => sum + Number(p.total_stok || 0), 0);
        return {
          name: jenis.nama,
          code: `JNS-${jenis.id}`,
          value: totalQuantity,
          itemCount: prods.length,
          color: colors[idx % colors.length]
        };
      })
      .filter(c => c.value > 0);
  }, [jenisList, products]);

  const totalInflow = useMemo(
    () => rangeTransactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + Number(t.quantity || 0), 0),
    [rangeTransactions]
  );

  const totalOutflow = useMemo(
    () => rangeTransactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + Number(t.quantity || 0), 0),
    [rangeTransactions]
  );

  const ticketTransactionsCount = useMemo(
    () =>
      rangeTransactions.filter(
        t => t.type === 'OUT' && (t.reference_type === 'TICKET_EXTERNAL' || t.reference_type === 'EXTERNAL_TICKET')
      ).length,
    [rangeTransactions]
  );

  const criticalItemsCount = useMemo(() => {
    let count = 0;
    for (const p of products) {
      const tipes = p.tipes || [];
      if (tipes.length === 0) {
        if (p.status_stok === 'menipis' || p.status_stok === 'habis') count++;
      } else {
        for (const t of tipes) {
          if (t.status_stok === 'menipis' || t.status_stok === 'habis') count++;
        }
      }
    }
    return count;
  }, [products]);

  return (
    <div className="space-y-5">
      {/* Hero Banner */}
      <div className="glass rounded-2xl p-5 sm:p-6 transition-all shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>VISUALISASI ANALITIK</span>
              <span aria-hidden="true">·</span>
              <span>TREN MUTASI {timeRangeDays} HARI WIB</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600 dark:text-slate-300">SUMBER DATA TUNGGAL</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1.5 font-display">
              Dashboard Tren Inventori &amp; Data Barang Lapangan
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Pantau arus barang masuk vs keluar (WIB), request teknisi aktif, dan varian data barang yang paling cepat terpakai.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div className="flex items-center bg-slate-900/5 dark:bg-slate-900/60 p-1 rounded-xl text-xs font-semibold border border-slate-200/50 dark:border-slate-700/50">
              {([7, 14, 30] as const).map(days => (
                <button
                  key={days}
                  onClick={() => setTimeRangeDays(days)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    timeRangeDays === days
                      ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {days} Hari
                </button>
              ))}
            </div>

            <button
              onClick={onOpenStockOut}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 whitespace-nowrap"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Keluarkan Barang</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <DashboardKpiCards
        totalInflow={totalInflow}
        totalOutflow={totalOutflow}
        ticketTransactionsCount={ticketTransactionsCount}
        mutationCount={rangeTransactions.length}
        criticalItemsCount={criticalItemsCount}
        timeRangeDays={timeRangeDays}
      />

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <TrendAreaChart
          trendData={trendData}
          timeRangeDays={timeRangeDays}
          onViewDetails={() => setActiveTab('inout')}
        />

        <TopMovingBarChart
          topMovingItems={topMovingItems}
          timeRangeDays={timeRangeDays}
          onViewReport={() => setActiveTab('weekly-report')}
        />
      </div>

      {/* Secondary Row: Category Volume Breakdown & Quick Action Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <CategoryDonutChart categoryData={categoryData} />

        <div className="lg:col-span-7 glass rounded-xl p-5 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Aktivitas Barang Keluar Terbaru
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pemakaian data barang dan peminjaman alat terkini di lapangan.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {heldItems.length > 0 && (
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg transition-colors flex items-center gap-1.5 border border-amber-200 dark:border-amber-800/60"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{heldItems.length} Di Tangan Teknisi</span>
                  </button>
                )}
                <button
                  onClick={onOpenChecklist}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-900/5 dark:bg-slate-800 hover:bg-slate-900/10 dark:hover:bg-slate-700/80 rounded-lg transition-colors flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-700/50"
                >
                  <span>Cek Tas Lapangan</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 mt-3">
              {rangeTransactions.filter(t => t.type === 'OUT').length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  Belum ada aktivitas barang keluar dalam {timeRangeDays} hari terakhir.
                </div>
              ) : (
                rangeTransactions
                  .filter(t => t.type === 'OUT')
                  .slice(0, 4)
                  .map(tx => (
                    <div
                      key={tx.id_aktivitas}
                      className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-9 h-9 rounded-lg bg-slate-900/5 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center font-mono font-bold tabular-nums text-slate-800 dark:text-slate-200 text-xs shrink-0">
                          {tx.quantity}x
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {tx.item_name || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">
                              {tx.reference_number || tx.request_id || tx.id_aktivitas}
                            </span>
                            <span>&middot;</span>
                            <span className="font-sans text-slate-500 dark:text-slate-400 truncate">
                              {tx.recipient_destination || tx.box_asal || '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {tx.actor_nama || tx.performed_by || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                          {formatWibShortDate(tx.occurred_at || tx.waktu)} WIB
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[11px]">Tersinkronisasi otomatis dengan katalog tunggal &amp; log aktivitas WIB.</span>
            <button
              onClick={() => setActiveTab('inout')}
              className="text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold transition-colors"
            >
              Semua Riwayat &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
