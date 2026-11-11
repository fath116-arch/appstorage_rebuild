/**
 * Catalog Manage Tab (Kelola Kategori, Atribut, & Pengaturan Katalog)
 * FieldOps IT - Sub-tab Kelola (Khusus Admin, Warehouse, & Developer)
 * Menggunakan istilah 'Kategori' seragam (menggantikan 'Jenis').
 */

import React from 'react';
import {
  Layers,
  Plus,
  Trash2,
  RotateCcw,
  Sliders,
  Settings,
  Sparkles,
  Info
} from 'lucide-react';
import { Jenis } from '../../services/catalogApi';

interface CatalogManageTabProps {
  categories: Jenis[];
  canManageCatalog: boolean;
  onOpenAddCategory: () => void;
  onOpenAddAttribute: (category: Jenis) => void;
  onOpenSNPatterns?: () => void;
  onOpenTrash?: () => void;
  onOpenRestore?: () => void;
  trashCount?: number;
}

export const CatalogManageTab: React.FC<CatalogManageTabProps> = ({
  categories,
  canManageCatalog,
  onOpenAddCategory,
  onOpenAddAttribute,
  onOpenSNPatterns,
  onOpenTrash,
  onOpenRestore,
  trashCount = 0,
}) => {
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
              Pengaturan Katalog, Kategori & Atribut
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
                title="Konfigurasi Pola Serial Number Suku Cadang"
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
      </div>

      {/* Grid Kategori & Kolom Atribut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
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

              {canManageCatalog && (
                <button
                  onClick={() => onOpenAddAttribute(cat)}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Atribut</span>
                </button>
              )}
            </div>

            {/* Daftar Atribut */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Kolom Atribut Spesifikasi ({cat.atributs?.length || 0}):
              </span>

              {!cat.atributs || cat.atributs.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  Belum ada atribut spesifikasi untuk kategori ini.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cat.atributs.map((a) => (
                    <div
                      key={a.id}
                      className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800 text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
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
                        <div className="flex items-center gap-2 text-[10px]">
                          {a.wajib && (
                            <span className="text-red-500 font-semibold font-mono">
                              *Wajib
                            </span>
                          )}
                          {a.masuk_nama && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Masuk Nama Tipe
                            </span>
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
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
