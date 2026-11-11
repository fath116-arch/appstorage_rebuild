/**
 * Catalog Summary Cards (Status Stok Berjenjang & Klik-Filter)
 * FieldOps IT - Sub-tab Produk
 * Menghitung status berdasarkan ambang berjenjang WhatsApp Alert (tipe > produk > global)
 */

import React from 'react';
import { Package, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Produk } from '../../services/catalogApi';

interface CatalogSummaryCardsProps {
  products: Produk[];
  selectedStatus: 'ALL' | 'aman' | 'menipis' | 'habis';
  onSelectStatus: (status: 'ALL' | 'aman' | 'menipis' | 'habis') => void;
}

export const CatalogSummaryCards: React.FC<CatalogSummaryCardsProps> = ({
  products,
  selectedStatus,
  onSelectStatus,
}) => {
  // Hitung jumlah produk berdasarkan status agregasi varian
  const { totalCount, amanCount, menipisCount, habisCount, totalVariants } = React.useMemo(() => {
    let aman = 0;
    let menipis = 0;
    let habis = 0;
    let variants = 0;

    for (const p of products) {
      variants += Number(p.total_tipe || (p.tipes ? p.tipes.length : 0));
      const s = p.status_stok || 'aman';
      if (s === 'habis') {
        habis++;
      } else if (s === 'menipis') {
        menipis++;
      } else {
        aman++;
      }
    }

    return {
      totalCount: products.length,
      amanCount: aman,
      menipisCount: menipis,
      habisCount: habis,
      totalVariants: variants,
    };
  }, [products]);

  const cards = [
    {
      id: 'ALL' as const,
      label: 'Semua Produk',
      count: totalCount,
      sublabel: `${totalVariants} total varian`,
      icon: Package,
      activeRing: 'border-slate-900 dark:border-emerald-500 bg-slate-50/80 dark:bg-slate-800/80',
      iconColor: 'text-slate-700 dark:text-slate-300',
    },
    {
      id: 'aman' as const,
      label: 'Stok Aman',
      count: amanCount,
      sublabel: 'Di atas ambang batas',
      icon: CheckCircle2,
      activeRing: 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'menipis' as const,
      label: 'Stok Menipis',
      count: menipisCount,
      sublabel: 'Mendekati ambang alert',
      icon: AlertTriangle,
      activeRing: 'border-amber-600 dark:border-amber-500 bg-amber-50/60 dark:bg-amber-950/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      id: 'habis' as const,
      label: 'Stok Habis',
      count: habisCount,
      sublabel: 'Varian kosong (0 unit)',
      icon: XCircle,
      activeRing: 'border-rose-600 dark:border-rose-500 bg-rose-50/60 dark:bg-rose-950/40',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = selectedStatus === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectStatus(card.id)}
            className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
              isActive
                ? `${card.activeRing} shadow-xs ring-1 ring-slate-900/10 dark:ring-emerald-500/30`
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {card.label}
              </span>
              <Icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {card.count}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {card.sublabel}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
