/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { InventoryItem } from '../types';
import { Plus, Briefcase, RotateCcw, Trash2, Layers, Package } from 'lucide-react';
import { CatalogStatusCards } from './catalog/CatalogStatusCards';
import { CatalogToolbar } from './catalog/CatalogToolbar';
import { CatalogItemCard } from './catalog/CatalogItemCard';
import { CatalogItemRow } from './catalog/CatalogItemRow';
import { CatalogEmptyState } from './catalog/CatalogEmptyState';
import { TrashModal } from './TrashModal';
import { CatalogV2Manager } from './catalog/CatalogV2Manager';

interface InventoryCatalogProps {
  onOpenAddItem: () => void;
  onOpenEditItem?: (item: InventoryItem) => void;
  onOpenStockIn: (item: InventoryItem) => void;
  onOpenStockOut: (item: InventoryItem) => void;
  onOpenDetail: (item: InventoryItem) => void;
  onOpenChecklist: () => void;
  onOpenRestore?: () => void;
}

export const InventoryCatalog: React.FC<InventoryCatalogProps> = ({
  onOpenAddItem,
  onOpenEditItem,
  onOpenStockIn,
  onOpenStockOut,
  onOpenDetail,
  onOpenChecklist,
  onOpenRestore
}) => {
  const { user } = useAuth();
  const { items, categories, trashItems } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [catalogMode, setCatalogMode] = useState<'v2' | 'legacy'>('v2');

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filter items efficiently with memoization
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item: any) => {
      const catId = item.category_id || item.categoryId;
      const minAlert = item.min_stock_alert ?? item.minStockAlert ?? 0;

      // Category filter
      if (selectedCategory !== 'ALL' && catId !== selectedCategory) {
        return false;
      }

      // Stock status filter
      if (stockFilter === 'IN_STOCK' && item.quantity <= minAlert) return false;
      if (stockFilter === 'LOW_STOCK' && (item.quantity <= 0 || item.quantity > minAlert)) return false;
      if (stockFilter === 'OUT_OF_STOCK' && item.quantity > 0) return false;

      // Search query filter
      if (query !== '') {
        const matchesName = (item.name || '').toLowerCase().includes(query);
        const matchesSku = (item.sku || '').toLowerCase().includes(query);
        const matchesBarcode = (item.barcode || '').toLowerCase().includes(query);
        const matchesLocation = (item.location || '').toLowerCase().includes(query);
        const matchesSpecs = (item.specs || '').toLowerCase().includes(query);
        return matchesName || matchesSku || matchesBarcode || matchesLocation || matchesSpecs;
      }

      return true;
    });
  }, [items, selectedCategory, stockFilter, searchQuery]);

  // Stock status counts memoized
  const { totalCount, inStockCount, lowStockCount, outOfStockCount } = useMemo(() => {
    let lowStock = 0;
    let outOfStock = 0;
    let inStock = 0;

    items.forEach((i: any) => {
      const minAlert = i.min_stock_alert ?? i.minStockAlert ?? 0;
      if (i.quantity === 0) outOfStock++;
      else if (i.quantity <= minAlert) lowStock++;
      else inStock++;
    });

    return {
      totalCount: items.length,
      inStockCount: inStock,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
    };
  }, [items]);

  const isAdminOrSpv = user?.role === 'admin' || user?.role === 'warehouse_admin' || user?.role === 'developer' || (user?.role as any) === 'superadmin';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setStockFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* View Switcher Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setCatalogMode('v2')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            catalogMode === 'v2'
              ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Katalog Bertingkat v2 (Jenis, Atribut, Produk & Tipe)</span>
        </button>

        <button
          onClick={() => setCatalogMode('legacy')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            catalogMode === 'legacy'
              ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Inventori Stok Fisik ({items.length} Item)</span>
        </button>
      </div>

      {catalogMode === 'v2' ? (
        <CatalogV2Manager />
      ) : (
        <>
          {/* Top Banner / Field Status Briefing */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>Sistem IT Lapangan</span>
                  <span aria-hidden="true">·</span>
                  <span>Pusat Ketersediaan Suku Cadang</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">Update Real-time</span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
                  Katalog Inventori IT & Ketersediaan Lapangan
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
                  Cek kesiapan suku cadang sebelum menuju lokasi penugasan tiket. Stok otomatis berkurang saat tiket diselesaikan atau dicatat manual.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={onOpenChecklist}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Briefcase className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  <span>Simulasi Tas Teknisi</span>
                </button>

                {isAdminOrSpv && onOpenRestore && (
                  <button
                    onClick={onOpenRestore}
                    className="px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                    title="Buka Antarmuka Data Restore & Pemulihan Dokumen Firestore (.JSON)"
                  >
                    <RotateCcw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Restore Data</span>
                  </button>
                )}

                {isAdminOrSpv && (
                  <button
                    onClick={() => setIsTrashOpen(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/80 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                    title="Buka Kotak Sampah untuk melihat atau memulihkan barang yang dihapus sementara (Soft Delete)"
                  >
                    <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Kotak Sampah</span>
                    {trashItems.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold font-mono">
                        {trashItems.length}
                      </span>
                    )}
                  </button>
                )}

                {isAdminOrSpv && (
                  <button
                    onClick={() => setCatalogMode('v2')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 dark:hover:bg-emerald-500 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-xs"
                    title="Buka Form Katalog v2 untuk pendaftaran produk & stok resmi"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Buat Produk Baru di Katalog</span>
                  </button>
                )}
              </div>
            </div>

            {/* Stock Status Summary Cards */}
            <CatalogStatusCards
              stockFilter={stockFilter}
              setStockFilter={setStockFilter as any}
              totalCount={totalCount}
              inStockCount={inStockCount}
              lowStockCount={lowStockCount}
              outOfStockCount={outOfStockCount}
            />
          </div>

          {/* Filter and Search Controls */}
          <CatalogToolbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            viewMode={viewMode}
            setViewMode={setViewMode}
            categories={categories}
            items={items}
          />

          {/* Item Display List */}
          {filteredItems.length === 0 ? (
            <CatalogEmptyState onResetFilters={handleResetFilters} />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <CatalogItemCard
                  key={item.id}
                  item={item}
                  isAdminOrSpv={isAdminOrSpv}
                  onOpenDetail={onOpenDetail}
                  onOpenStockIn={onOpenStockIn}
                  onOpenStockOut={onOpenStockOut}
                />
              ))}
            </div>
          ) : (
            /* High density data table view */
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs transition-colors">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                    <tr>
                      <th className="py-3 px-4">SKU / Barcode</th>
                      <th className="py-3 px-4">Nama Barang & Spek</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Lokasi Rak / Bin</th>
                      <th className="py-3 px-4 text-right">Stok Fisik</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {filteredItems.map((item) => (
                      <CatalogItemRow
                        key={item.id}
                        item={item}
                        onOpenDetail={onOpenDetail}
                        onOpenStockOut={onOpenStockOut}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kotak Sampah Modal */}
          <TrashModal
            isOpen={isTrashOpen}
            onClose={() => setIsTrashOpen(false)}
          />
        </>
      )}
    </div>
  );
};
