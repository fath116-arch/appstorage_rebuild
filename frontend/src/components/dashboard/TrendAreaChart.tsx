/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { Activity, ArrowRight } from 'lucide-react';
import { formatWibDate } from '../../utils/timezone';

interface TrendAreaChartProps {
  trendData: Array<{
    dateLabel: string;
    fullDate: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
  timeRangeDays: number;
  onViewDetails: () => void;
}

const CustomTrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const inVal = payload.find((p: any) => p.dataKey === 'inflow')?.value || 0;
    const outVal = payload.find((p: any) => p.dataKey === 'outflow')?.value || 0;
    const fullDate = payload[0]?.payload?.fullDate;
    const headerLabel = fullDate ? `${formatWibDate(`${fullDate}T12:00:00+07:00`)} (WIB)` : label;
    return (
      <div className="bg-slate-900 text-white p-2.5 sm:p-3 rounded-lg shadow-xl border border-slate-700 text-xs space-y-1.5 pointer-events-none select-none z-50 max-w-[210px] sm:max-w-[240px]">
        <div className="font-bold font-mono text-slate-300 border-b border-slate-800 pb-1 text-[11px]">
          {headerLabel}
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-400 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
            Masuk (In):
          </span>
          <span className="font-mono font-bold tabular-nums shrink-0">+{inVal} item</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-blue-400 truncate">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
            Keluar (Out):
          </span>
          <span className="font-mono font-bold tabular-nums shrink-0">-{outVal} item</span>
        </div>
        <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span>Net Selisih:</span>
          <span className={`font-mono font-bold ${inVal - outVal >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {inVal - outVal >= 0 ? `+${inVal - outVal}` : inVal - outVal}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const TrendAreaChart: React.FC<TrendAreaChartProps> = ({
  trendData,
  timeRangeDays,
  onViewDetails,
}) => {
  return (
    <div className="lg:col-span-7 glass rounded-xl p-5 flex flex-col justify-between transition-colors">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
              Tren Arus Barang Masuk vs Keluar ({timeRangeDays} Hari)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visualisasi volume penerimaan data barang baru vs konsumsi pekerjaan tiket.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Masuk (In)</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-slate-200"></span>
              <span>Keluar (Out)</span>
            </span>
          </div>
        </div>

        <div className="h-72 w-full mt-4 select-none outline-none focus:outline-none focus-visible:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              style={{ outline: 'none', border: 'none' }}
              tabIndex={-1}
            >
              <defs>
                <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200/70 dark:stroke-slate-700/60" />
              <XAxis 
                dataKey="dateLabel" 
                tickLine={false} 
                axisLine={{ stroke: '#cbd5e1' }}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval={timeRangeDays > 14 ? 3 : 1}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip 
                content={<CustomTrendTooltip />} 
                isAnimationActive={false} 
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ pointerEvents: 'none', outline: 'none', zIndex: 50 }} 
                cursor={false} 
              />
              <Area
                type="monotone"
                dataKey="inflow"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorInflow)"
                name="Barang Masuk"
              />
              <Area
                type="monotone"
                dataKey="outflow"
                stroke="#38bdf8"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOutflow)"
                name="Barang Keluar"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
        <span className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>Aktivitas terekam dari tiket Jira, Zendesk, dan form manual lapangan.</span>
        </span>
        <button
          onClick={onViewDetails}
          className="text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold flex items-center gap-1 transition-colors"
        >
          <span>Lihat Detail Mutasi</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
