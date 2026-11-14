/**
 * WhatsApp Hierarchical Thresholds & Watchlist Tab
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ThresholdMatrixItem, whatsappService } from '../../services/whatsappService';
import { useToast } from '../../context/ToastContext';

interface WaThresholdsTabProps {
  thresholdMatrix: ThresholdMatrixItem[];
  canEdit: boolean;
  onRefresh: () => void;
}

export const WaThresholdsTab: React.FC<WaThresholdsTabProps> = ({
  thresholdMatrix,
  canEdit,
  onRefresh
}) => {
  const { showToast } = useToast();
  const [filterWatchlistOnly, setFilterWatchlistOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingItem, setEditingItem] = useState<ThresholdMatrixItem | null>(null);
  const [customLowStock, setCustomLowStock] = useState<number | ''>('');
  const [customEarlyWarning, setCustomEarlyWarning] = useState<number | ''>('');
  const [customWatchlist, setCustomWatchlist] = useState<boolean>(false);
  const [customLevel, setCustomLevel] = useState<'tipe' | 'produk'>('tipe');

  const handleOpenEditThreshold = (item: ThresholdMatrixItem) => {
    if (!canEdit) return;
    setEditingItem(item);
    setCustomLevel('tipe');
    setCustomLowStock(item.lowStockThreshold);
    setCustomEarlyWarning(item.earlyWarningThreshold);
    setCustomWatchlist(item.isWatchlist);
  };

  const handleSaveCustomThreshold = async () => {
    if (!editingItem || !canEdit) return;

    const targetId = customLevel === 'tipe' ? editingItem.tipeId : editingItem.produkId;
    const res = await whatsappService.setThreshold({
      level: customLevel,
      targetId,
      lowStockThreshold: customLowStock === '' ? null : Number(customLowStock),
      earlyWarningThreshold: customEarlyWarning === '' ? null : Number(customEarlyWarning),
      isWatchlist: customWatchlist
    });

    if (res.success) {
      showToast(`Ambang khusus (${customLevel}) berhasil disimpan!`, 'success');
      setEditingItem(null);
      onRefresh();
    } else {
      showToast(res.message, 'error');
    }
  };

  const filteredThresholdItems = thresholdMatrix.filter(it => {
    if (filterWatchlistOnly && !it.isWatchlist) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        it.produkNama.toLowerCase().includes(q) ||
        it.tipeNama.toLowerCase().includes(q) ||
        it.kodeTipe.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Matriks Ambang Berjenjang: Tipe &gt; Produk &gt; Global
          </h3>
          <p className="text-slate-500 text-xs">
            Sistem otomatis memilih ambang yang paling spesifik. Item berkondisi Rusak tidak dihitung sebagai stok tersedia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari produk / tipe..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
          />
          <button
            onClick={() => setFilterWatchlistOnly(!filterWatchlistOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filterWatchlistOnly
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            Daftar Pantauan Saja
          </button>
        </div>
      </div>

      {/* Table of Resolved Thresholds */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
            <tr>
              <th className="py-2.5 px-3">Produk &amp; Varian Tipe</th>
              <th className="py-2.5 px-3">Kategori</th>
              <th className="py-2.5 px-3 text-right">Stok Tersedia</th>
              <th className="py-2.5 px-3">Ambang Menipis</th>
              <th className="py-2.5 px-3">Ambang Dini</th>
              <th className="py-2.5 px-3 text-center">Daftar Pantauan</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              {canEdit && <th className="py-2.5 px-3 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredThresholdItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Tidak ada produk atau tipe yang cocok dengan filter pencarian.
                </td>
              </tr>
            ) : (
              filteredThresholdItems.map(item => (
                <tr key={`${item.produkId}_${item.tipeId}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {item.produkNama}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {item.tipeNama} [{item.kodeTipe}]
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    {item.kategoriBarang}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                    {item.availableStock} unit
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      &le; {item.lowStockThreshold}
                    </span>
                    <span className="text-[10px] text-slate-500 block italic">
                      {item.lowStockSource}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      &le; {item.earlyWarningThreshold}
                    </span>
                    <span className="text-[10px] text-slate-500 block italic">
                      {item.earlyWarningSource}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.isWatchlist ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Pantau Aktif
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`font-bold text-[11px] ${
                      item.currentStatus === 'HABIS'
                        ? 'text-red-700 dark:text-red-400'
                        : item.currentStatus === 'MENIPIS'
                        ? 'text-amber-700 dark:text-amber-400'
                        : item.currentStatus === 'PERINGATAN_DINI'
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {item.currentStatus}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEditThreshold(item)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded"
                      >
                        Ubah Ambang
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Edit Ambang Khusus */}
      {editingItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                Atur Ambang Khusus: {editingItem.produkNama}
              </h4>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Tingkat Penyetelan Ambang</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomLevel('tipe')}
                    className={`py-1.5 px-3 rounded text-xs font-bold border ${
                      customLevel === 'tipe'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Per Varian Tipe ({editingItem.tipeNama})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomLevel('produk')}
                    className={`py-1.5 px-3 rounded text-xs font-bold border ${
                      customLevel === 'produk'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Per Produk Induk ({editingItem.produkNama})
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ambang Stok Menipis</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Kosongkan untuk pakai global"
                  value={customLowStock}
                  onChange={e => setCustomLowStock(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-900 border rounded"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Ambang Peringatan Dini (Watchlist)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Kosongkan untuk pakai global"
                  value={customEarlyWarning}
                  onChange={e => setCustomEarlyWarning(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-900 border rounded"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customWatchlist}
                  onChange={e => setCustomWatchlist(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Masukkan ke Daftar Pantauan (Watchlist Peringatan Dini)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCustomThreshold}
                className="px-4 py-1.5 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded"
              >
                Simpan Ambang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
