/**
 * Kotak Sampah Modal (Audit Arsip Soft Delete - Retensi 14 Hari)
 * FieldOps IT — Membaca entri sampah_hapus dari InventoryContext
 */

import React, { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { Trash2, X, Search, AlertTriangle, PackageOpen, Clock } from 'lucide-react';
import { formatWibDateTime } from '../utils/timezone';
import { isAdminOrDev } from '../utils/permissions';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({ isOpen, onClose }) => {
  const { trashItems, purgeExpiredTrash } = useInventory();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [purging, setPurging] = useState(false);

  const parsedEntries = useMemo(() => {
    return trashItems.map((entry) => {
      let snap: Record<string, unknown> = {};
      try {
        snap = entry.snapshot ? JSON.parse(entry.snapshot) : {};
      } catch {
        snap = {};
      }
      let label = String(snap.nama || snap.kode_id || snap.name || snap.username || snap.nama_tipe || entry.objek_id);
      if (entry.jenis_objek === 'stok_jumlah') {
        const prodName = snap.nama_produk ? `${String(snap.nama_produk)} — ` : '';
        const tipeName = String(snap.nama_tipe || `Tipe #${String(snap.tipe_id || '')}`);
        const qtyLabel = snap.jumlah_dihapus ?? snap.jumlah ?? '';
        const boxLabel = String(snap.box_kode || snap.box_id || '');
        label = `${prodName}${tipeName}${qtyLabel !== '' ? ` (${qtyLabel} unit${boxLabel ? ` · ${boxLabel}` : ''})` : ''}`;
      }
      return { entry, snap, label };
    });
  }, [trashItems]);

  if (!isOpen) return null;

  const canPurge = isAdminOrDev(user?.role);
  const q = searchTerm.trim().toLowerCase();

  const filtered = parsedEntries.filter(({ entry, label }) => {
    if (!q) return true;
    return (
      label.toLowerCase().includes(q) ||
      entry.jenis_objek.toLowerCase().includes(q) ||
      entry.objek_id.toLowerCase().includes(q) ||
      (entry.nama_penghapus || '').toLowerCase().includes(q)
    );
  });

  const handlePurge = async () => {
    setPurging(true);
    try {
      await purgeExpiredTrash();
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Kotak Sampah &amp; Retensi 14 Hari
                </h2>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                  {trashItems.length} entri
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Objek yang dinonaktifkan disimpan 14 hari sebelum pembersihan permanen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama objek, jenis, ID, atau penghapus..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          {canPurge && (
            <button
              type="button"
              disabled={purging}
              onClick={handlePurge}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50"
            >
              {purging ? 'Membersihkan...' : 'Bersihkan Entri Kedaluwarsa'}
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <PackageOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {trashItems.length === 0 ? 'Kotak Sampah Kosong' : 'Tidak Ada Hasil yang Cocok'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {trashItems.length === 0
                  ? 'Tidak ada data nonaktif dalam antrean retensi 14 hari.'
                  : 'Ubah kata kunci pencarian untuk melihat entri lain.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {filtered.map(({ entry, label }) => (
                <div
                  key={entry.id}
                  className="p-3.5 bg-white dark:bg-slate-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {entry.jenis_objek}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        #{entry.objek_id}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        oleh <strong className="text-slate-700 dark:text-slate-200">{entry.nama_penghapus || entry.dihapus_oleh}</strong>
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {label}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Dihapus: {formatWibDateTime(entry.dihapus_pada)}</span>
                      <span>·</span>
                      <span>Purge: {formatWibDateTime(entry.purge_setelah)}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Clock className="w-3 h-3" />
                      {typeof entry.sisa_hari === 'number' ? `${entry.sisa_hari} hari tersisa` : entry.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Log: {entry.aktivitas_id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            Pemulihan arsip snapshot permanen dijalankan oleh administrator via skrip retensi server.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-medium text-xs text-slate-800 dark:text-slate-200"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
