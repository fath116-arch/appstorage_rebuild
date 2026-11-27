/**
 * Catalog Browse Categories Tab (Jelajah Kategori & Pakai untuk Tiket)
 * FieldOps IT - Sub-tab Kategori
 * Menyediakan penelusuran visual kategori, stok varian, serta aksi cepat admin (pindah produk / hapus kategori).
 */

import React, { useState, useMemo } from 'react';
import {
  Folder,
  Search,
  ChevronRight,
  Ticket,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Trash2,
  ArrowRightLeft,
  Sliders
} from 'lucide-react';
import { Jenis, Produk, Tipe } from '../../services/catalogApi';

interface CatalogBrowseCategoriesTabProps {
  categories: Jenis[];
  products: Produk[];
  canManageCatalog?: boolean;
  onOpenTypeDetail: (tipe: Tipe) => void;
  onOpenStockOut?: (tipe: Tipe) => void;
  onDeleteCategory?: (cat: Jenis) => void;
  onMoveProduct?: (prod: Produk) => void;
  onOpenManageCategoryMembers?: (cat: Jenis) => void;
}

export const CatalogBrowseCategoriesTab: React.FC<CatalogBrowseCategoriesTabProps> = ({
  categories,
  products,
  canManageCatalog = false,
  onOpenTypeDetail,
  onOpenStockOut,
  onDeleteCategory,
  onMoveProduct,
  onOpenManageCategoryMembers,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Hitung jumlah produk dan total varian per kategori
  const categoriesWithStats = useMemo(() => {
    return categories.map((cat) => {
      const catProducts = products.filter(
        (p) => p.jenis_id === cat.id || (p as any).kategori_id === cat.id
      );

      let totalStock = 0;
      let totalVariants = 0;
      let hasLowStock = false;
      let allOutOfStock = catProducts.length > 0;

      for (const p of catProducts) {
        totalStock += Number(p.total_stok || 0);
        totalVariants += Number(p.total_tipe || (p.tipes ? p.tipes.length : 0));
        if (p.status_stok === 'menipis') hasLowStock = true;
        if (p.total_stok && p.total_stok > 0) allOutOfStock = false;
      }

      return {
        ...cat,
        productCount: catProducts.length,
        variantCount: totalVariants,
        totalStock,
        status: allOutOfStock ? 'habis' : hasLowStock ? 'menipis' : 'aman',
      };
    });
  }, [categories, products]);

  // Filter kategori berdasarkan pencarian
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoriesWithStats;
    return categoriesWithStats.filter(
      (c) =>
        c.nama.toLowerCase().includes(q) ||
        (c.prefix_id_bawaan && c.prefix_id_bawaan.toLowerCase().includes(q))
    );
  }, [categoriesWithStats, searchQuery]);

  // Produk di kategori yang sedang dipilih
  const activeCategory = useMemo(() => {
    if (selectedCategoryId === null) return null;
    return categoriesWithStats.find((c) => c.id === selectedCategoryId) || null;
  }, [categoriesWithStats, selectedCategoryId]);

  const activeCategoryProducts = useMemo(() => {
    if (!selectedCategoryId) return [];
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = p.jenis_id === selectedCategoryId || (p as any).kategori_id === selectedCategoryId;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        p.nama.toLowerCase().includes(q) ||
        (p.tipes && p.tipes.some((t) => t.nama_tipe.toLowerCase().includes(q) || (t.prefix_id && t.prefix_id.toLowerCase().includes(q))))
      );
    });
  }, [products, selectedCategoryId, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kategori, nama alat, atau varian data barang..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {selectedCategoryId !== null && (
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Semua Kategori</span>
            </button>
          )}
        </div>
      </div>

      {/* View 1: Grid Kategori */}
      {selectedCategoryId === null ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>Pilih kategori untuk menjelajahi produk &amp; ketersediaan stok:</span>
            <span className="font-mono tabular-nums">{filteredCategories.length} Kategori</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCategories.map((cat) => {
              const statusBadge =
                cat.status === 'habis' ? (
                  <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Habis
                  </span>
                ) : cat.status === 'menipis' ? (
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Menipis
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aman
                  </span>
                );

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCategoryId(cat.id);
                    }
                  }}
                  className="p-4 rounded-xl text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-xs transition-all flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                        <Folder className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                          {cat.nama}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Prefix: {cat.prefix_id_bawaan || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canManageCatalog && onDeleteCategory && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCategory(cat);
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors"
                          title={`Hapus Kategori ${cat.nama}`}
                          aria-label={`Hapus Kategori ${cat.nama}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {cat.productCount}
                      </span>
                      <span>produk</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {cat.variantCount}
                      </span>
                      <span>varian</span>
                    </div>

                    <div>{statusBadge}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCategories.length === 0 && (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Tidak ada kategori yang cocok dengan pencarian.</p>
            </div>
          )}
        </div>
      ) : (
        /* View 2: Produk di dalam Kategori Terpilih */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <span>Kategori</span>
                <span aria-hidden="true">/</span>
                <span className="text-slate-900 dark:text-white font-semibold">{activeCategory?.nama}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-emerald-500" />
                <span>{activeCategory?.nama}</span>
                <span className="text-xs font-normal text-slate-500 font-mono tabular-nums">
                  ({activeCategoryProducts.length} Produk)
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total Stok Fisik:</span>
                <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {activeCategory?.totalStock} unit
                </span>
              </div>

              {canManageCatalog && activeCategory && onOpenManageCategoryMembers && (
                <button
                  type="button"
                  onClick={() => onOpenManageCategoryMembers(activeCategory)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Atur Produk Kategori</span>
                </button>
              )}

              {canManageCatalog && activeCategory && onDeleteCategory && (
                <button
                  type="button"
                  onClick={() => onDeleteCategory(activeCategory)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Kategori</span>
                </button>
              )}
            </div>
          </div>

          {/* List Produk */}
          <div className="space-y-3">
            {activeCategoryProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{prod.nama}</h4>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        · {prod.kategori_barang || 'Barang Habis Pakai'}
                      </span>
                    </div>
                    {prod.catatan && (
                      <p className="text-xs text-slate-500 mt-0.5">{prod.catatan}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      Total: <strong className="font-mono tabular-nums text-slate-900 dark:text-white">{prod.total_stok ?? 0} {prod.tipe_stok || 'unit'}</strong>
                    </span>
                    {canManageCatalog && onMoveProduct && (
                      <button
                        type="button"
                        onClick={() => onMoveProduct(prod)}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md flex items-center gap-1 whitespace-nowrap"
                        title={`Pindahkan ${prod.nama} ke kategori lain`}
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Pindah Kategori</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Variants List */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Daftar Varian ({prod.tipes?.length || 0}):
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {prod.tipes && prod.tipes.length > 0 ? (
                      prod.tipes.map((tipe) => {
                        const isOut = (tipe.stok_tersedia ?? 0) === 0;
                        const isLow = tipe.status_stok === 'menipis';

                        return (
                          <div
                            key={tipe.id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{tipe.nama_tipe}</span>
                                {isOut ? (
                                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                                    · Habis
                                  </span>
                                ) : isLow ? (
                                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                                    · Menipis
                                  </span>
                                ) : null}
                              </div>

                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-mono tabular-nums">
                                  Tersedia: <strong className="text-slate-800 dark:text-slate-200 font-bold">{tipe.stok_tersedia ?? 0}</strong>
                                </span>
                                {tipe.sebaran_box && tipe.sebaran_box.length > 0 && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="truncate">
                                      Box: {tipe.sebaran_box.map((b) => b.box_kode).join(', ')}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenTypeDetail(tipe)}
                                className="px-2.5 py-1 text-[11px] font-medium bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                              >
                                Rincian
                              </button>

                              {onOpenStockOut && (
                                <button
                                  type="button"
                                  onClick={() => onOpenStockOut(tipe)}
                                  disabled={isOut}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors flex items-center gap-1 ${
                                    isOut
                                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                  }`}
                                  title="Pakai barang ini untuk tiket lapangan"
                                >
                                  <Ticket className="w-3 h-3" />
                                  <span>Pakai</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-400 py-2">Belum ada varian tipe untuk produk ini.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {activeCategoryProducts.length === 0 && (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                Tidak ada produk di kategori ini.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
