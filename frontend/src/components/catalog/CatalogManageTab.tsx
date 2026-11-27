/**
 * Catalog Manage Tab (Pusat Pengaturan & Perubahan Massal Katalog)
 * FieldOps IT v1.2.9 - Sub-tab Kelola & Pengaturan
 * Terbagi menjadi 4 kartu pengaturan yang mewakili tiap bagian fitur Katalog:
 *   1. Pengaturan Produk & Varian (Hapus/Pindah Produk Massal, Kelola & Hapus Massal Tipe)
 *   2. Pengaturan Jelajah Kategori & Anggota Produk Manual (Menggantikan Atur Atribut)
 *   3. Pengaturan Storage Box (Tambah, Hapus Massal Box, Relokasi Isi Box)
 *   4. Aturan Serial Number, Impor Multi-Tipe & Pemulihan
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  RotateCcw,
  Sliders,
  Settings,
  Pencil,
  CheckSquare,
  Square,
  Tag,
  Folder,
  Box as BoxIcon,
  ArrowRightLeft,
  Search,
  FileSpreadsheet,
  ArrowRight,
  Lock,
  Unlock
} from 'lucide-react';
import { Jenis, Produk, Tipe } from '../../services/catalogApi';

interface CatalogManageTabProps {
  categories: Jenis[];
  products: Produk[];
  boxesList: any[];
  canManageCatalog: boolean;
  canImportCatalog?: boolean;
  initialFocusCategoryId?: number | null;
  // Product & Type Management (Card 1)
  selectedProductIds: number[];
  onToggleProductSelect: (prodId: number) => void;
  onToggleSelectAllProducts: (filteredIds: number[]) => void;
  onMoveProductsBulk: (produkIds: number[], targetJenisId: number) => Promise<void>;
  onDeleteProductsBulk: (chosenProducts: Produk[]) => void;
  onMoveSingleProduct: (prod: Produk) => void;
  onMoveSingleType: (tipe: Tipe, sourceProd: Produk) => void;
  onEditTypeAndIdRule: (tipe: Tipe) => void;
  onDeleteSingleType: (tipe: Tipe, prod: Produk) => void;
  selectedTypeIds: number[];
  onToggleTypeSelect: (tipeId: number) => void;
  onDeleteTypesBulk: (chosenTypes: Array<{ tipe: Tipe; produkNama: string }>) => void;
  // Category & Manual Membership Management (Card 2)
  onOpenAddCategory: () => void;
  onEditCategory: (category: Jenis) => void;
  onDeleteCategory: (category: Jenis) => void;
  selectedCategoryIds: number[];
  onToggleCategorySelect: (categoryId: number) => void;
  onToggleSelectAllCategories: () => void;
  onDeleteCategoriesBulk: (categories: Jenis[]) => void;
  // Storage Box Management (Card 3)
  onOpenCreateBox: () => void;
  onOpenBoxContents: (boxId: string) => void;
  onDeleteBox: (box: any) => void;
  selectedBoxIds: string[];
  onToggleBoxSelect: (boxId: string) => void;
  onToggleSelectAllBoxes: () => void;
  onDeleteBoxesBulk: (boxes: any[]) => void;
  // SN Rules, Import & Recovery (Card 4)
  onOpenImportModal?: () => void;
  onOpenSNPatterns?: () => void;
  onOpenTrash?: () => void;
  onOpenRestore?: () => void;
  trashCount?: number;
}

export const CatalogManageTab: React.FC<CatalogManageTabProps> = ({
  categories,
  products,
  boxesList,
  canManageCatalog,
  canImportCatalog = false,
  initialFocusCategoryId = null,
  selectedProductIds,
  onToggleProductSelect,
  onToggleSelectAllProducts,
  onMoveProductsBulk,
  onDeleteProductsBulk,
  onMoveSingleProduct,
  onMoveSingleType,
  onEditTypeAndIdRule,
  onDeleteSingleType,
  selectedTypeIds,
  onToggleTypeSelect,
  onDeleteTypesBulk,
  onOpenAddCategory,
  onEditCategory,
  onDeleteCategory,
  selectedCategoryIds,
  onToggleCategorySelect,
  onToggleSelectAllCategories,
  onDeleteCategoriesBulk,
  onOpenCreateBox,
  onOpenBoxContents,
  onDeleteBox,
  selectedBoxIds,
  onToggleBoxSelect,
  onToggleSelectAllBoxes,
  onDeleteBoxesBulk,
  onOpenImportModal,
  onOpenSNPatterns,
  onOpenTrash,
  onOpenRestore,
  trashCount = 0,
}) => {
  // Card 1 State: Produk & Varian filter + bulk move destination
  const [prodSearch, setProdSearch] = useState('');
  const [prodCategoryFilter, setProdCategoryFilter] = useState<string>('ALL');
  const [bulkMoveTargetJenisId, setBulkMoveTargetJenisId] = useState<string>('');
  const [bulkMovingProducts, setBulkMovingProducts] = useState(false);

  // Card 2 State: Manual Category Membership Manager
  const [activeMemberCategoryId, setActiveMemberCategoryId] = useState<number | null>(
    initialFocusCategoryId ?? (categories[0]?.id ?? null)
  );
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedToAssignProdIds, setSelectedToAssignProdIds] = useState<number[]>([]);
  const [assigningMembers, setAssigningMembers] = useState(false);

  useEffect(() => {
    if (initialFocusCategoryId && categories.some((c) => c.id === initialFocusCategoryId)) {
      setActiveMemberCategoryId(initialFocusCategoryId);
      setSelectedToAssignProdIds([]);
    }
  }, [initialFocusCategoryId, categories]);

  useEffect(() => {
    if (activeMemberCategoryId === null && categories.length > 0) {
      setActiveMemberCategoryId(categories[0].id);
    } else if (
      activeMemberCategoryId !== null &&
      categories.length > 0 &&
      !categories.some((c) => c.id === activeMemberCategoryId)
    ) {
      setActiveMemberCategoryId(categories[0].id);
    }
  }, [categories, activeMemberCategoryId]);

  useEffect(() => {
    if (!bulkMoveTargetJenisId && categories.length > 0) {
      setBulkMoveTargetJenisId(String(categories[0].id));
    }
  }, [categories, bulkMoveTargetJenisId]);

  // Card 1 derived lists
  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (prodCategoryFilter !== 'ALL' && p.jenis_id !== parseInt(prodCategoryFilter, 10)) {
        return false;
      }
      if (!q) return true;
      const matchesProd =
        p.nama.toLowerCase().includes(q) || (p.jenis_nama || '').toLowerCase().includes(q);
      const matchesTipe = (p.tipes || []).some((t) =>
        t.nama_tipe.toLowerCase().includes(q)
      );
      return matchesProd || matchesTipe;
    });
  }, [products, prodSearch, prodCategoryFilter]);

  const filteredProductIds = useMemo(
    () => filteredProducts.map((p) => p.id),
    [filteredProducts]
  );
  const allFilteredProductsSelected =
    filteredProductIds.length > 0 &&
    filteredProductIds.every((id) => selectedProductIds.includes(id));

  const selectedProductsList = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  const selectedTypesEntries = useMemo(() => {
    const out: Array<{ tipe: Tipe; produkNama: string }> = [];
    for (const p of products) {
      for (const t of p.tipes || []) {
        if (selectedTypeIds.includes(t.id)) {
          out.push({ tipe: t, produkNama: p.nama });
        }
      }
    }
    return out;
  }, [products, selectedTypeIds]);

  // Card 2 derived lists
  const activeMemberCategory = useMemo(
    () => categories.find((c) => c.id === activeMemberCategoryId) || null,
    [categories, activeMemberCategoryId]
  );

  const productsInsideActiveCategory = useMemo(
    () =>
      activeMemberCategory
        ? products.filter((p) => p.jenis_id === activeMemberCategory.id)
        : [],
    [products, activeMemberCategory]
  );

  const productsOutsideActiveCategory = useMemo(() => {
    if (!activeMemberCategory) return [];
    const q = memberSearchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (p.jenis_id === activeMemberCategory.id) return false;
      if (!q) return true;
      return (
        p.nama.toLowerCase().includes(q) ||
        (p.jenis_nama || '').toLowerCase().includes(q)
      );
    });
  }, [products, activeMemberCategory, memberSearchQuery]);

  const selectedCats = categories.filter((c) => selectedCategoryIds.includes(c.id));
  const allCatsSelected = categories.length > 0 && selectedCats.length === categories.length;

  const selectedBoxes = boxesList.filter((b: any) => selectedBoxIds.includes(b.id));
  const allBoxesSelected = boxesList.length > 0 && selectedBoxes.length === boxesList.length;

  const handleBulkMoveSubmit = async () => {
    const targetId = parseInt(bulkMoveTargetJenisId, 10);
    if (!Number.isFinite(targetId) || targetId <= 0 || selectedProductIds.length === 0) return;
    setBulkMovingProducts(true);
    try {
      await onMoveProductsBulk(selectedProductIds, targetId);
    } finally {
      setBulkMovingProducts(false);
    }
  };

  const handleAssignToCategory = async () => {
    if (!activeMemberCategory || selectedToAssignProdIds.length === 0) return;
    setAssigningMembers(true);
    try {
      await onMoveProductsBulk(selectedToAssignProdIds, activeMemberCategory.id);
      setSelectedToAssignProdIds([]);
    } finally {
      setAssigningMembers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Sliders className="w-4 h-4" />
              <span>Pusat Pengaturan &amp; Perubahan Massal Katalog</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              Kelola Produk, Anggota Kategori, Storage Box &amp; Pemulihan Data
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Seluruh perubahan massal, penetapan manual anggota kategori, penghapusan kategori, serta pengaturan ID dikelompokkan sesuai masing-masing tab katalog.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
            <span>{products.length} Produk</span>
            <span aria-hidden="true">/</span>
            <span>{categories.length} Kategori</span>
            <span aria-hidden="true">/</span>
            <span>{boxesList.length} Box</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* KARTU 1: PENGATURAN PRODUK & VARIAN (MEWAKILI TAB PRODUK & VARIAN)    */}
      {/* ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                01. Pengaturan Produk &amp; Varian Tipe
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih banyak produk atau varian tipe sekaligus untuk pindah kategori massal, ubah aturan ID, atau hapus massal.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {selectedTypesEntries.length > 0 && canManageCatalog && (
              <button
                type="button"
                onClick={() => onDeleteTypesBulk(selectedTypesEntries)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Tipe Terpilih ({selectedTypesEntries.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Bulk Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={prodSearch}
                onChange={(e) => setProdSearch(e.target.value)}
                placeholder="Cari produk atau varian tipe..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={prodCategoryFilter}
              onChange={(e) => setProdCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Semua Kategori ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          {canManageCatalog && filteredProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleSelectAllProducts(filteredProductIds)}
                className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                {allFilteredProductsSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {allFilteredProductsSelected
                    ? 'Batal Pilih Semua'
                    : `Pilih Semua (${filteredProducts.length})`}
                </span>
              </button>

              {selectedProductsList.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={bulkMoveTargetJenisId}
                      onChange={(e) => setBulkMoveTargetJenisId(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      aria-label="Pilih kategori tujuan pindah produk massal"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          Ke: {c.nama}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={bulkMovingProducts || !bulkMoveTargetJenisId}
                      onClick={handleBulkMoveSubmit}
                      className="px-3 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>
                        {bulkMovingProducts ? 'Memindahkan...' : `Pindah (${selectedProductsList.length})`}
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteProductsBulk(selectedProductsList)}
                    className="px-3 py-2 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Produk ({selectedProductsList.length})</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Flat Product & Variant Rows */}
        {filteredProducts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
            Tidak ada produk yang cocok dengan filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 max-h-[420px] overflow-y-auto">
            {filteredProducts.map((prod) => {
              const isProdChecked = selectedProductIds.includes(prod.id);
              const tipes = prod.tipes || [];
              return (
                <div key={prod.id} className="py-3 space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {canManageCatalog && (
                        <input
                          type="checkbox"
                          checked={isProdChecked}
                          onChange={() => onToggleProductSelect(prod.id)}
                          aria-label={`Pilih produk ${prod.nama}`}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {prod.nama}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 font-mono tabular-nums">
                          <span>{prod.jenis_nama || 'Tanpa Kategori'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{prod.kategori === 'recycle' ? 'Recycle' : 'Fast Moving'}</span>
                          <span aria-hidden="true">·</span>
                          <span>Tersedia {prod.total_stok ?? 0} {prod.tipe_stok || 'unit'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tipes.length} varian</span>
                        </div>
                      </div>
                    </div>

                    {canManageCatalog && (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => onMoveSingleProduct(prod)}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md flex items-center gap-1 whitespace-nowrap"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Pindah Kategori</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Varian Tipe rows under product */}
                  {tipes.length > 0 && (
                    <div className="pl-6 space-y-1">
                      {tipes.map((t) => {
                        const isTypeChecked = selectedTypeIds.includes(t.id);
                        return (
                          <div
                            key={t.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-1.5 px-2.5 rounded-md bg-slate-50 dark:bg-slate-950/60"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {canManageCatalog && (
                                <input
                                  type="checkbox"
                                  checked={isTypeChecked}
                                  onChange={() => onToggleTypeSelect(t.id)}
                                  aria-label={`Pilih tipe ${t.nama_tipe}`}
                                  className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer shrink-0"
                                />
                              )}
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {t.nama_tipe}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center gap-1">
                                {t.id_dikunci ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                                <span>{t.sumber_id}</span>
                                <span aria-hidden="true">·</span>
                                <span>{t.stok_tersedia ?? t.stok_total ?? 0} {prod.tipe_stok || 'unit'}</span>
                              </span>
                            </div>

                            {canManageCatalog && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onEditTypeAndIdRule(t)}
                                  className="px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors whitespace-nowrap"
                                >
                                  Ubah Tipe &amp; ID
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onMoveSingleType(t, prod)}
                                  className="px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors whitespace-nowrap"
                                >
                                  Pindah Produk
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteSingleType(t, prod)}
                                  className="p-1 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
                                  title={`Hapus Varian ${t.nama_tipe}`}
                                  aria-label={`Hapus Varian ${t.nama_tipe}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* KARTU 2: PENGATURAN JELAJAH KATEGORI & ANGGOTA BARANG MANUAL          */}
      {/* ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                02. Pengaturan Kategori &amp; Anggota Produk (Manual)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Buat, ubah, hapus kategori (dengan opsi pindah atau ikut hapus produk), serta atur barang apa saja yang masuk ke dalam kategori secara manual.
              </p>
            </div>
          </div>

          {canManageCatalog && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={onToggleSelectAllCategories}
                  className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  {allCatsSelected ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                  <span>{allCatsSelected ? 'Batal Pilih Kategori' : `Pilih Semua (${categories.length})`}</span>
                </button>
              )}

              {selectedCats.length > 0 && (
                <button
                  type="button"
                  onClick={() => onDeleteCategoriesBulk(selectedCats)}
                  className="px-3 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Kategori Kosong ({selectedCats.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenAddCategory}
                className="px-3.5 py-1.5 font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori</span>
              </button>
            </div>
          )}
        </div>

        {/* Category List & Manual Member Manager Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          {/* Left: Daftar Kategori */}
          <div className="lg:col-span-5 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Daftar Kategori ({categories.length})
            </div>

            {categories.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                Belum ada kategori.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                {categories.map((cat) => {
                  const isCatSelected = selectedCategoryIds.includes(cat.id);
                  const isFocused = activeMemberCategory?.id === cat.id;
                  const countInCat = products.filter((p) => p.jenis_id === cat.id).length;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setActiveMemberCategoryId(cat.id);
                        setSelectedToAssignProdIds([]);
                      }}
                      className={`p-3 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isFocused
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40'
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {canManageCatalog && (
                          <input
                            type="checkbox"
                            checked={isCatSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => onToggleCategorySelect(cat.id)}
                            aria-label={`Pilih kategori ${cat.nama}`}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {cat.nama}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {countInCat} produk · {cat.sumber_id_bawaan}
                            {cat.prefix_id_bawaan ? ` (${cat.prefix_id_bawaan})` : ''}
                          </div>
                        </div>
                      </div>

                      {canManageCatalog && (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onEditCategory(cat)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                            title={`Ubah Kategori ${cat.nama}`}
                            aria-label={`Ubah Kategori ${cat.nama}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCategory(cat)}
                            className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
                            title={`Hapus Kategori ${cat.nama}`}
                            aria-label={`Hapus Kategori ${cat.nama}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Atur Barang/Produk dalam Kategori secara Manual */}
          <div className="lg:col-span-7 space-y-3 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
            {activeMemberCategory ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Anggota Produk dalam Kategori
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {activeMemberCategory.nama} ({productsInsideActiveCategory.length} produk)
                    </h4>
                  </div>
                </div>

                {/* Current Members */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Produk yang saat ini ada di kategori ini:
                  </div>
                  {productsInsideActiveCategory.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                      Kategori "{activeMemberCategory.nama}" belum memiliki produk. Pilih produk di bawah untuk memasukkannya.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-40 overflow-y-auto">
                      {productsInsideActiveCategory.map((p) => (
                        <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800 dark:text-slate-100 truncate block">
                              {p.nama}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                              {p.total_tipe ?? p.tipes?.length ?? 0} varian · {p.total_stok ?? 0} {p.tipe_stok || 'unit'}
                            </span>
                          </div>
                          {canManageCatalog && (
                            <button
                              type="button"
                              onClick={() => onMoveSingleProduct(p)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Keluarkan / Pindah</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assign Products from Other Categories */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Masukkan Produk dari Kategori Lain ke &quot;{activeMemberCategory.nama}&quot;:
                    </span>
                    {canManageCatalog && selectedToAssignProdIds.length > 0 && (
                      <button
                        type="button"
                        disabled={assigningMembers}
                        onClick={handleAssignToCategory}
                        className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>
                          {assigningMembers
                            ? 'Memasukkan...'
                            : `Masukkan ${selectedToAssignProdIds.length} Produk ke Kategori Ini`}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="Cari produk dari kategori lain..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {productsOutsideActiveCategory.length === 0 ? (
                    <div className="py-4 text-center text-slate-400">
                      Tidak ada produk lain yang tersedia untuk dipindahkan.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto">
                      {productsOutsideActiveCategory.map((p) => {
                        const isPicked = selectedToAssignProdIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              isPicked
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/40'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isPicked}
                                onChange={() => {
                                  setSelectedToAssignProdIds((prev) =>
                                    prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                  );
                                }}
                                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate block">
                                  {p.nama}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Dari: {p.jenis_nama || '-'} · {p.total_stok ?? 0} {p.tipe_stok || 'unit'}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-400">
                Pilih salah satu kategori untuk mengatur daftar produknya.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* KARTU 3: PENGATURAN STORAGE BOX (MEWAKILI TAB STORAGE BOX)            */}
      {/* ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shrink-0">
              <BoxIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                03. Pengaturan Storage Box
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Buat box baru, pilih banyak box untuk penghapusan massal, atau buka isi box untuk memindahkan barang antar box &amp; varian tipe.
              </p>
            </div>
          </div>

          {canManageCatalog && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
              {boxesList.length > 0 && (
                <button
                  type="button"
                  onClick={onToggleSelectAllBoxes}
                  className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  {allBoxesSelected ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                  <span>{allBoxesSelected ? 'Batal Pilih Box' : `Pilih Semua Box (${boxesList.length})`}</span>
                </button>
              )}

              {selectedBoxes.length > 0 && (
                <button
                  type="button"
                  onClick={() => onDeleteBoxesBulk(selectedBoxes)}
                  className="px-3 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Box Terpilih ({selectedBoxes.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenCreateBox}
                className="px-3.5 py-1.5 font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Box Baru</span>
              </button>
            </div>
          )}
        </div>

        {boxesList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Belum ada Storage Box terdaftar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto text-xs">
            {boxesList.map((box: any) => {
              const isSelected = selectedBoxIds.includes(box.id);
              return (
                <div
                  key={box.id}
                  className={`py-2.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {canManageCatalog && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleBoxSelect(box.id)}
                        aria-label={`Pilih box ${box.kode}`}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {box.kode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {box.keterangan || 'Tanpa keterangan lokasi'} · <span className="font-mono tabular-nums">{box.total_item ?? 0} item aktif</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onOpenBoxContents(box.id)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-md flex items-center gap-1 whitespace-nowrap"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Kelola &amp; Pindah Isi</span>
                    </button>
                    {canManageCatalog && (
                      <button
                        type="button"
                        onClick={() => onDeleteBox(box)}
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors"
                        title={`Hapus Box ${box.kode}`}
                        aria-label={`Hapus Box ${box.kode}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* KARTU 4: ATURAN SERIAL NUMBER, IMPOR MULTI-TIPE & PEMULIHAN           */}
      {/* ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              04. Aturan ID, Impor Multi-Tipe &amp; Pemulihan Data
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Konfigurasi standar regex Serial Number global, impor massal katalog dengan banyak varian tipe dalam 1 produk, cadangan data, dan kotak sampah.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {canImportCatalog && onOpenImportModal && (
            <button
              type="button"
              onClick={onOpenImportModal}
              className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Impor Excel / Google Sheets Multi-Tipe</span>
            </button>
          )}

          {onOpenSNPatterns && (
            <button
              type="button"
              onClick={onOpenSNPatterns}
              className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Aturan Pola Serial Number</span>
            </button>
          )}

          {onOpenRestore && (
            <button
              type="button"
              onClick={onOpenRestore}
              className="px-4 py-2 font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Restore Data Cadangan</span>
            </button>
          )}

          {onOpenTrash && (
            <button
              type="button"
              onClick={onOpenTrash}
              className="px-4 py-2 font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/80 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Kotak Sampah (14 Hari)</span>
              <span className="font-mono tabular-nums text-[11px] font-bold">
                · {trashCount}
              </span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
