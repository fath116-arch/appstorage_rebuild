/**
 * Catalog Manage Tab (Kelola Kategori, Atribut, & Pengaturan Katalog)
 * FieldOps IT - Sub-tab Kelola (Khusus Admin, Warehouse, & Developer)
 * Menggunakan istilah 'Kategori' seragam (menggantikan 'Jenis').
 */

import React from 'react';
import {
  Plus,
  Trash2,
  RotateCcw,
  Sliders,
  Settings,
  Sparkles,
  Pencil,
  CheckSquare,
  Square
} from 'lucide-react';
import { Jenis, Atribut } from '../../services/catalogApi';

interface CatalogManageTabProps {
  categories: Jenis[];
  canManageCatalog: boolean;
  onOpenAddCategory: () => void;
  onEditCategory?: (category: Jenis) => void;
  onDeleteCategory?: (category: Jenis) => void;
  selectedCategoryIds?: number[];
  onToggleCategorySelect?: (categoryId: number) => void;
  onToggleSelectAllCategories?: () => void;
  onDeleteCategoriesBulk?: (categories: Jenis[]) => void;
  onOpenAddAttribute: (category: Jenis) => void;
  onEditAttribute?: (category: Jenis, attr: Atribut) => void;
  onDeleteAttribute?: (category: Jenis, attr: Atribut) => void;
  selectedAttributeIds?: number[];
  onToggleAttributeSelect?: (attrId: number) => void;
  onDeleteAttributesBulk?: (category: Jenis, attrs: Atribut[]) => void;
  onOpenSNPatterns?: () => void;
  onOpenTrash?: () => void;
  onOpenRestore?: () => void;
  trashCount?: number;
}

export const CatalogManageTab: React.FC<CatalogManageTabProps> = ({
  categories,
  canManageCatalog,
  onOpenAddCategory,
  onEditCategory,
  onDeleteCategory,
  selectedCategoryIds = [],
  onToggleCategorySelect,
  onToggleSelectAllCategories,
  onDeleteCategoriesBulk,
  onOpenAddAttribute,
  onEditAttribute,
  onDeleteAttribute,
  selectedAttributeIds = [],
  onToggleAttributeSelect,
  onDeleteAttributesBulk,
  onOpenSNPatterns,
  onOpenTrash,
  onOpenRestore,
  trashCount = 0,
}) => {
  const selectedCats = categories.filter((c) => selectedCategoryIds.includes(c.id));
  const allCatsSelected = categories.length > 0 && selectedCats.length === categories.length;

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Sliders className="w-4 h-4" />
              <span>Panel Kontrol Administrator</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              Pengaturan Katalog, Kategori &amp; Atribut
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola kategori barang, definisi atribut dinamis, aturan format Serial Number, dan pemulihan arsip inventori.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenSNPatterns && (
              <button
                onClick={onOpenSNPatterns}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                title="Konfigurasi Pola Serial Number Data Barang"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Aturan Serial Number</span>
              </button>
            )}

            {onOpenRestore && (
              <button
                onClick={onOpenRestore}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                title="Buka Pemulihan Data Cadangan JSON"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Restore Data</span>
              </button>
            )}

            {onOpenTrash && (
              <button
                onClick={onOpenTrash}
                className="px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/80 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                title="Kotak Sampah / Soft Delete"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Kotak Sampah</span>
                {trashCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold font-mono">
                    {trashCount}
                  </span>
                )}
              </button>
            )}

            {canManageCatalog && (
              <button
                onClick={onOpenAddCategory}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Select Kategori Bar */}
        {canManageCatalog && categories.length > 0 && onToggleSelectAllCategories && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={onToggleSelectAllCategories}
              className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {allCatsSelected ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4 text-slate-400" />}
              <span>{allCatsSelected ? 'Batal Pilih Semua Kategori' : `Pilih Semua Kategori (${categories.length})`}</span>
            </button>

            {selectedCats.length > 0 && onDeleteCategoriesBulk && (
              <button
                type="button"
                onClick={() => onDeleteCategoriesBulk(selectedCats)}
                className="px-3.5 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Kategori Terpilih ({selectedCats.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid Kategori & Kolom Atribut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {categories.map((cat) => {
          const isCatSelected = selectedCategoryIds.includes(cat.id);
          const catAttrs = cat.atributs || [];
          const selectedCatAttrs = catAttrs.filter((a) => selectedAttributeIds.includes(a.id));

          return (
            <div
              key={cat.id}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-5 shadow-xs space-y-4 transition-colors ${
                isCatSelected
                  ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  {canManageCatalog && onToggleCategorySelect && (
                    <input
                      type="checkbox"
                      checked={isCatSelected}
                      onChange={() => onToggleCategorySelect(cat.id)}
                      aria-label={`Pilih kategori ${cat.nama}`}
                      className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        {cat.nama}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {cat.total_produk || 0} Produk Aktif
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Sumber ID Bawaan: {cat.sumber_id_bawaan}{' '}
                      {cat.prefix_id_bawaan ? `(Prefix: ${cat.prefix_id_bawaan})` : ''}
                    </span>
                  </div>
                </div>

                {canManageCatalog && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onEditCategory && (
                      <button
                        type="button"
                        onClick={() => onEditCategory(cat)}
                        className="px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                        title={`Ubah Kategori ${cat.nama}`}
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Ubah</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenAddAttribute(cat)}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1 shadow-xs whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Atribut</span>
                    </button>
                    {onDeleteCategory && (
                      <button
                        type="button"
                        onClick={() => onDeleteCategory(cat)}
                        className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors shrink-0"
                        title={`Hapus Kategori ${cat.nama}`}
                        aria-label={`Hapus Kategori ${cat.nama}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Daftar Atribut */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Kolom Atribut Spesifikasi ({catAttrs.length}):
                  </span>
                  {canManageCatalog && selectedCatAttrs.length > 0 && onDeleteAttributesBulk && (
                    <button
                      type="button"
                      onClick={() => onDeleteAttributesBulk(cat, selectedCatAttrs)}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-md flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Atribut Terpilih ({selectedCatAttrs.length})</span>
                    </button>
                  )}
                </div>

                {catAttrs.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    Belum ada atribut spesifikasi untuk kategori ini.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {catAttrs.map((a) => {
                      const isAttrSelected = selectedAttributeIds.includes(a.id);
                      return (
                        <div
                          key={a.id}
                          className={`bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 border text-xs flex flex-col gap-1.5 transition-colors ${
                            isAttrSelected
                              ? 'border-emerald-500'
                              : 'border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              {canManageCatalog && onToggleAttributeSelect && (
                                <input
                                  type="checkbox"
                                  checked={isAttrSelected}
                                  onChange={() => onToggleAttributeSelect(a.id)}
                                  aria-label={`Pilih atribut ${a.nama}`}
                                  className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                                />
                              )}
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {a.nama}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                ({a.kode})
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                                {a.tipe_isian} {a.satuan ? `(${a.satuan})` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] shrink-0">
                              {Boolean(a.wajib) && (
                                <span className="text-red-500 font-semibold font-mono">
                                  *Wajib
                                </span>
                              )}
                              {Boolean(a.masuk_nama) && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Masuk Nama Tipe
                                </span>
                              )}
                              {canManageCatalog && onEditAttribute && (
                                <button
                                  type="button"
                                  onClick={() => onEditAttribute(cat, a)}
                                  className="p-1 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                                  title={`Ubah Atribut ${a.nama}`}
                                  aria-label={`Ubah Atribut ${a.nama}`}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {canManageCatalog && onDeleteAttribute && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteAttribute(cat, a)}
                                  className="p-1 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
                                  title={`Hapus Atribut ${a.nama}`}
                                  aria-label={`Hapus Atribut ${a.nama}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Tampilkan Opsi Jika Tipe Isian Pilihan */}
                          {a.tipe_isian === 'pilihan' && a.opsi && a.opsi.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                              <span className="text-[10px] text-slate-400">Opsi:</span>
                              {a.opsi.map((o) => (
                                <span
                                  key={o.id}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-mono"
                                >
                                  {o.nilai}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
