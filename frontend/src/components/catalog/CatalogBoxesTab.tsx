/**
 * Catalog Boxes Tab (Pusat Penyimpanan Storage Box)
 * FieldOps IT - Sub-tab Storage Box
 */

import React from 'react';
import { Box as BoxIcon, Plus, RefreshCw, ArrowRightLeft, Trash2, CheckSquare, Square } from 'lucide-react';

interface CatalogBoxesTabProps {
  boxesList: any[];
  loading: boolean;
  canManageCatalog: boolean;
  onOpenCreateBox: () => void;
  onSelectBox: (boxId: string) => void;
  onDeleteBox?: (box: any) => void;
  selectedBoxIds?: string[];
  onToggleBoxSelect?: (boxId: string) => void;
  onToggleSelectAllBoxes?: () => void;
  onDeleteBoxesBulk?: (boxes: any[]) => void;
}

export const CatalogBoxesTab: React.FC<CatalogBoxesTabProps> = ({
  boxesList,
  loading,
  canManageCatalog,
  onOpenCreateBox,
  onSelectBox,
  onDeleteBox,
  selectedBoxIds = [],
  onToggleBoxSelect,
  onToggleSelectAllBoxes,
  onDeleteBoxesBulk,
}) => {
  const selectedBoxes = boxesList.filter((b: any) => selectedBoxIds.includes(b.id));
  const allBoxesSelected = boxesList.length > 0 && selectedBoxes.length === boxesList.length;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BoxIcon className="w-4 h-4 text-emerald-500" />
              <span>Pusat Penyimpanan Storage Box</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Setiap box dapat menampung campuran berbagai produk dan tipe varian data barang fisik ber-ID maupun stok jumlah.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManageCatalog && (
              <button
                onClick={onOpenCreateBox}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Box Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Select Toolbar */}
        {canManageCatalog && boxesList.length > 0 && onToggleSelectAllBoxes && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={onToggleSelectAllBoxes}
              className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {allBoxesSelected ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4 text-slate-400" />}
              <span>{allBoxesSelected ? 'Batal Pilih Semua Box' : `Pilih Semua Box (${boxesList.length})`}</span>
            </button>

            {selectedBoxes.length > 0 && onDeleteBoxesBulk && (
              <button
                type="button"
                onClick={() => onDeleteBoxesBulk(selectedBoxes)}
                className="px-3.5 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Box Terpilih ({selectedBoxes.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
          <span>Memuat data storage box...</span>
        </div>
      ) : boxesList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <BoxIcon className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Belum ada Storage Box</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Buat kode box pertama Anda (misal: BOX-01, RAK-A) untuk mulai menempatkan barang.
          </p>
          {canManageCatalog && (
            <button
              onClick={onOpenCreateBox}
              className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Box Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {boxesList.map((box: any) => {
            const isSelected = selectedBoxIds.includes(box.id);
            return (
              <div
                key={box.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-xs transition-all flex flex-col justify-between space-y-3 group ${
                  isSelected
                    ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                    : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {canManageCatalog && onToggleBoxSelect && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleBoxSelect(box.id)}
                          aria-label={`Pilih box ${box.kode}`}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      )}
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <BoxIcon className="w-5 h-5" />
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                      {box.total_item ?? 0} item
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 dark:text-white text-base mt-2.5 font-mono">
                    {box.kode}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {box.keterangan || 'Tanpa keterangan lokasi'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectBox(box.id)}
                    className="flex-1 py-2 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Buka Isi Box</span>
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                  {canManageCatalog && onDeleteBox && (
                    <button
                      type="button"
                      onClick={() => onDeleteBox(box)}
                      className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors shrink-0"
                      title={`Hapus Box ${box.kode}`}
                      aria-label={`Hapus Box ${box.kode}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
