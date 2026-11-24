/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Activity, AlertTriangle } from 'lucide-react';

interface DashboardKpiCardsProps {
  totalInflow: number;
  totalOutflow: number;
  ticketTransactionsCount: number;
  mutationCount: number;
  criticalItemsCount: number;
  timeRangeDays: number;
}

export const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = ({
  totalInflow,
  totalOutflow,
  ticketTransactionsCount,
  mutationCount,
  criticalItemsCount,
  timeRangeDays,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Barang Masuk */}
      <div className="glass rounded-xl p-5 flex flex-col justify-between transition-all hover:translate-y-[-2px] hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Barang Masuk (Inflow)
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
        </div>
        <div className="my-2">
          <div className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            +{totalInflow}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          Pengadaan & restock PO ({timeRangeDays} hari)
        </div>
      </div>

      {/* Card 2: Barang Keluar */}
      <div className="glass rounded-xl p-5 flex flex-col justify-between transition-all hover:translate-y-[-2px] hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Barang Keluar (Outflow)
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div className="my-2">
          <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
            -{totalOutflow}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          Terkonsumsi {ticketTransactionsCount} tiket pekerjaan
        </div>
      </div>

      {/* Card 3: Perputaran Data Barang */}
      <div className="glass rounded-xl p-5 flex flex-col justify-between transition-all hover:translate-y-[-2px] hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Perputaran Data Barang
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="my-2">
          <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
            {mutationCount}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          Total transaksi mutasi fisik ({timeRangeDays}d)
        </div>
      </div>

      {/* Card 4: Item Perlu Restock */}
      <div className="glass rounded-xl p-5 flex flex-col justify-between border-amber-300/60 dark:border-amber-500/30 transition-all hover:translate-y-[-2px] hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
            Item Perlu Restock
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="my-2">
          <div className="text-3xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {criticalItemsCount}
          </div>
        </div>
        <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium">
          Stok saat ini &le; batas minimum alert
        </div>
      </div>
    </div>
  );
};
