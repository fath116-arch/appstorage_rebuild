/**
 * Box Content Modal (FieldOps Inventory v2 - Tahap 3)
 * Menampilkan isi box penyimpanan dikelompokkan per Produk & Tipe, dengan opsi Pindah Box
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  QrCode,
  X,
  RefreshCw,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Tag,
  CheckCircle2,
  Box as BoxIcon
} from 'lucide-react';
import { stockApi, Box, BoxContentsResponse } from '../../services/stockApi';
import { useInventory } from '../../context/InventoryContext';

interface BoxContentModalProps {
  isOpen: boolean;
  boxIdOrKode: string | null;
  onClose: () => void;
  onRefreshParent?: () => void;
}

export const BoxContentModal: React.FC<BoxContentModalProps> = ({
  isOpen,
  boxIdOrKode,
  onClose,
  onRefreshParent
}) => {
  const { showToast } = useInventory();
  const [data, setData] = useState<BoxContentsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [allBoxes, setAllBoxes] = useState<Box[]>([]);

  // State Pindah Box
  const [movingItem, setMovingItem] = useState<{
    itemId?: string;
    tipeId?: number;
    kodeId?: string;
    namaSnapshot?: string;
    jumlahAvailable?: number;
  } | null>(null);

  // State Ubah Kondisi Item
  const [editingConditionItem, setEditingConditionItem] = useState<any | null>(null);
  const [newKondisi, setNewKondisi] = useState<'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak'>('Baik');
  const [catatanKondisiInput, setCatatanKondisiInput] = useState<string>('');

  const [targetBoxId, setTargetBoxId] = useState<string>('');
  const [moveQuantity, setMoveQuantity] = useState<string>('1');
  const [moveCatatan, setMoveCatatan] = useState<string>('');

  const loadContents = useCallback(async () => {
    if (!boxIdOrKode) return;
    try {
      setLoading(true);
      const [resContents, boxes] = await Promise.all([
        stockApi.getBoxContents(boxIdOrKode),
        stockApi.listBoxes()
      ]);
      setData(resContents);
      setAllBoxes(boxes);
      // Filter out current box from target options
      const otherBoxes = boxes.filter(b => b.id !== resContents.box.id);
      if (otherBoxes.length > 0) setTargetBoxId(otherBoxes[0].id);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [boxIdOrKode, showToast]);

  useEffect(() => {
    if (isOpen && boxIdOrKode) {
      loadContents();
    }
  }, [isOpen, boxIdOrKode, loadContents]);

  if (!isOpen || !boxIdOrKode) return null;

  const handleExecuteMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingItem || !data || !targetBoxId) return;

    try {
      const qty = parseInt(moveQuantity, 10) || 1;
      const res = await stockApi.pindahBox({
        item_id: movingItem.itemId,
        tipe_id: movingItem.tipeId,
        box_asal_id: data.box.id,
        box_tujuan_id: targetBoxId,
        jumlah: movingItem.tipeId ? qty : undefined,
        catatan: moveCatatan.trim() || undefined
      });

      showToast(res.message, 'success');
      setMovingItem(null);
      setMoveQuantity('1');
      setMoveCatatan('');
      await loadContents();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (editingConditionItem) {
      setNewKondisi(editingConditionItem.kondisi || 'Baik');
      setCatatanKondisiInput(editingConditionItem.catatan_kondisi || '');
    }
  }, [editingConditionItem]);

  const handleExecuteUpdateCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConditionItem) return;

    try {
      const res = await fetch(`/api/stock/items/${encodeURIComponent(editingConditionItem.id)}/condition`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kondisi: newKondisi,
          catatan_kondisi: catatanKondisiInput.trim() || undefined
        })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || 'Gagal mengubah kondisi item.');

      showToast(resData.message, 'success');
      setEditingConditionItem(null);
      setCatatanKondisiInput('');
      await loadContents();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <BoxIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                <span>Isi Storage Box: {data?.box.kode || boxIdOrKode}</span>
              </h3>
              {data?.box.keterangan && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{data.box.keterangan}</p>
              )}
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Loading State */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            <span>Membaca isi box & memetakan suku cadang...</span>
          </div>
        ) : !data ? (
          <div className="p-6 text-center text-slate-500">
            Box tidak ditemukan atau kosong.
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Summary Counters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="font-medium text-slate-600 dark:text-slate-300">Item Fisik Ber-ID:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">{data.total_items} unit</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="font-medium text-slate-600 dark:text-slate-300">Stok Jumlah (Bulk):</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">{data.total_stok_jumlah} unit</span>
              </div>
            </div>

            {/* List Grouped Contents */}
            {Object.keys(data.contents).length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400">
                Box ini saat ini masih kosong.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(data.contents).map(([produkNama, tipesObj]) => (
                  <div key={produkNama} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
                    <div className="bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{produkNama}</span>
                    </div>

                    <div className="p-3 space-y-3">
                      {Object.entries(tipesObj).map(([tipeNama, contentObj]) => (
                        <div key={tipeNama} className="bg-white dark:bg-slate-900 p-3 rounded-md border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Varian: {tipeNama}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {contentObj.items.length > 0 && `${contentObj.items.length} item ber-ID`}
                              {contentObj.stokJumlah > 0 && `${contentObj.stokJumlah} unit stok jumlah`}
                            </span>
                          </div>

                          {/* Items List */}
                          {contentObj.items.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {contentObj.items.map(it => {
                                const kondisi = it.kondisi || 'Baik';
                                const badgeColor =
                                  kondisi === 'Baru'
                                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300 border-sky-300 dark:border-sky-700'
                                    : kondisi === 'Perlu Perbaikan'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                    : kondisi === 'Rusak'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';

                                return (
                                  <div
                                    key={it.id}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono"
                                  >
                                    <span className="font-bold text-slate-900 dark:text-white">{it.kode_id}</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingConditionItem(it)}
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold border ${badgeColor} hover:opacity-80 transition-opacity`}
                                      title={it.catatan_kondisi ? `Kondisi: ${kondisi} (${it.catatan_kondisi}) - Klik untuk ubah` : `Kondisi: ${kondisi} - Klik untuk ubah`}
                                    >
                                      {kondisi}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setMovingItem({
                                        itemId: it.id,
                                        kodeId: it.kode_id,
                                        namaSnapshot: `${it.nama_produk} - ${it.nama_tipe}`
                                      })}
                                      className="p-0.5 text-slate-400 hover:text-emerald-500 transition-colors"
                                      title="Pindahkan item ini ke box lain"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Stok Jumlah Row */}
                          {contentObj.stokJumlah > 0 && (
                            <div className="flex items-center justify-between p-2 bg-emerald-50/50 dark:bg-emerald-950/30 rounded border border-emerald-100 dark:border-emerald-900/40 text-[11px]">
                              <span className="font-medium text-emerald-900 dark:text-emerald-300">
                                Total Stok Jumlah: <strong>{contentObj.stokJumlah} unit</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const rawSj = data.raw_stok_jumlah.find(s => s.nama_tipe === tipeNama && s.nama_produk === produkNama);
                                  if (rawSj) {
                                    setMovingItem({
                                      tipeId: rawSj.tipe_id,
                                      namaSnapshot: `${produkNama} - ${tipeNama}`,
                                      jumlahAvailable: contentObj.stokJumlah
                                    });
                                    setMoveQuantity('1');
                                  }
                                }}
                                className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 rounded transition-colors flex items-center gap-1"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Pindah Sebagian</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Sub-Dialog Pindah Box */}
            {movingItem && (
              <form onSubmit={handleExecuteMove} className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4" />
                    Pindah Lokasi Box: {movingItem.kodeId || movingItem.namaSnapshot}
                  </span>
                  <button type="button" onClick={() => setMovingItem(null)} className="text-emerald-700 hover:text-emerald-900">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Pilih Box Tujuan *
                    </label>
                    <select
                      value={targetBoxId}
                      onChange={e => setTargetBoxId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold"
                    >
                      {allBoxes.filter(b => b.id !== data.box.id).map(b => (
                        <option key={b.id} value={b.id}>{b.kode} - {b.keterangan || 'Tanpa Keterangan'}</option>
                      ))}
                    </select>
                  </div>

                  {movingItem.tipeId && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Jumlah Dipindah * (Max: {movingItem.jumlahAvailable})
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={moveQuantity}
                        onFocus={(e) => e.target.select()}
                        onChange={e => setMoveQuantity(e.target.value.replace(/\D/g, ''))}
                        onBlur={() => { if (!moveQuantity || moveQuantity === '0') setMoveQuantity('1'); }}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Catatan alasan relokasi box..."
                    value={moveCatatan}
                    onChange={e => setMoveCatatan(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-[11px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMovingItem(null)}
                    className="px-3 py-1.5 text-slate-600 bg-white dark:bg-slate-800 rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                  >
                    Eksekusi Pindah Box
                  </button>
                </div>
              </form>
            )}

            {/* Modal Sub-Dialog Ubah Kondisi Item (Paket 4) */}
            {editingConditionItem && (
              <form onSubmit={handleExecuteUpdateCondition} className="p-4 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-500" />
                    Ubah Kondisi Item: <span className="font-mono">{editingConditionItem.kode_id}</span>
                  </span>
                  <button type="button" onClick={() => setEditingConditionItem(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Kondisi Fisik *
                    </label>
                    <select
                      value={newKondisi}
                      onChange={e => setNewKondisi(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold"
                    >
                      <option value="Baru">Baru</option>
                      <option value="Baik">Baik</option>
                      <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                      <option value="Rusak">Rusak (Tidak Tersedia untuk Request)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Catatan Kondisi (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Port 2 kendor, bodi lecet..."
                      value={catatanKondisiInput}
                      onChange={e => setCatatanKondisiInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-[11px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingConditionItem(null)}
                    className="px-3 py-1.5 text-slate-600 bg-white dark:bg-slate-800 rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-md shadow-xs"
                  >
                    Simpan Kondisi
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
