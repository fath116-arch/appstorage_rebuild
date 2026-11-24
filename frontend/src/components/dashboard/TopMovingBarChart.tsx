/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell 
} from 'recharts';
import { ArrowRight } from 'lucide-react';

interface TopMovingItem {
  name: string;
  fullName: string;
  sku: string;
  consumed: number;
  unit: string;
  tickets: number;
  stock: number;
  isLow: boolean;
}

interface TopMovingBarChartProps {
  topMovingItems: TopMovingItem[];
  timeRangeDays: number;
  onViewReport: () => void;
}

const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-xl border border-slate-700 text-xs space-y-1 pointer-events-none select-none z-50 max-w-[200px] sm:max-w-[240px]">
        <div className="font-mono text-[9px] text-slate-400 truncate">{data.sku}</div>
        <div className="font-bold text-slate-100 text-[11px] line-clamp-2 leading-tight break-words">{data.fullName}</div>
        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2 text-[10px]">
          <span className="text-slate-400">Total Terpakai:</span>
          <span className="font-mono font-bold text-emerald-400 tabular-nums">
            {data.consumed} {data.unit}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-slate-400">Tiket Terkait:</span>
          <span className="font-mono text-slate-200">{data.tickets} pek.</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-slate-400">Stok Saat Ini:</span>
          <span className={`font-mono font-bold ${data.isLow ? 'text-amber-400' : 'text-slate-200'}`}>
            {data.stock} {data.unit} {data.isLow ? '(Menipis)' : ''}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const TopMovingBarChart: React.FC<TopMovingBarChartProps> = ({
  topMovingItems,
  timeRangeDays,
  onViewReport,
}) => {
  return (
    <div className="lg:col-span-5 glass rounded-xl p-5 flex flex-col justify-between transition-colors">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
              Data Barang Paling Banyak Terpakai (*Top-Moving*)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Peringkat barang dengan volume penggunaan tertinggi {timeRangeDays} hari terakhir.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-900/10 dark:bg-slate-700/80 px-2.5 py-1 rounded-md uppercase tracking-wider shrink-0">
            High Velocity
          </span>
        </div>

        <div className="h-72 w-full mt-4 select-none outline-none focus:outline-none focus-visible:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topMovingItems}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 15, bottom: 5 }}
              style={{ outline: 'none', border: 'none' }}
              tabIndex={-1}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-200/70 dark:stroke-slate-700/60" />
              <XAxis 
                type="number" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                width={105}
              />
              <Tooltip 
                content={<CustomBarTooltip />} 
                isAnimationActive={false} 
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ pointerEvents: 'none', outline: 'none', zIndex: 50 }} 
                cursor={false} 
              />
              <Bar dataKey="consumed" radius={[0, 4, 4, 0]} background={false} activeBar={false}>
                {topMovingItems.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isLow ? '#f59e0b' : '#10b981'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
        <span className="text-[11px] font-mono">
          <span className="text-amber-500 font-bold font-mono">Kuning</span> = Stok &le; min alert
        </span>
        <button
          onClick={onViewReport}
          className="text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold flex items-center gap-1 transition-colors"
        >
          <span>Laporan Lengkap</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
