/**
 * Box Content Modal (FieldOps Inventory v2 - v1.2.9)
 * Menampilkan isi box penyimpanan dikelompokkan per Produk & Tipe,
 * dengan fitur Pindah Box / Tipe (tunggal & massal), Ubah Kondisi,
 * serta Hapus Item Ber-ID maupun Stok Jumlah Non-SN.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  RefreshCw,
  ArrowRightLeft,
  Tag,
  Box as BoxIcon,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import { stockApi, Box, BoxContentsResponse, BoxContentItem } from '../../services/stockApi';
import { catalogApi, Produk, Tipe } from '../../services/catalogApi';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { isFeatureEnabled } from '../../utils/permissions';
import { ConfirmDeleteModal, DeleteConfirmTarget } from '../common/ConfirmDeleteModal';

interface BoxContentModalProps {
  isOpen: boolean;
  boxIdOrKode: string | null;
  onClose: () => void;
  onRefreshParent?: () => void;
}

interface MovingTarget {
  mode: 'per_id' | 'jumlah';
  itemIds?: string[];
  kodeIdLabel?: string;
  tipeAsalId: number;
  sourceTipeLabel: string;
  jumlahAvailable?: number;
}

interface DeletingStokTarget {
  tipeId: number;
  boxId: string;
  label: string;
  totalQty: number;
  reservedQty: number;
  freeQty: number;
}

export const BoxContentModal: React.FC<BoxContentModalProps> = ({
  isOpen,
  boxIdOrKode,
  onClose,
  onRefreshParent
}) => {
  const { user } = useAuth();
  const { showToast, refreshData } = useInventory();
  const canManageCatalog = isFeatureEnabled(user, 'catalog_manage');
  const canManageStock = isFeatureEnabled(user, 'stock_in_out');
  const canMove = canManageCatalog || canManageStock;

  const [data, setData] = useState<BoxContentsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allBoxes, setAllBoxes] = useState<Box[]>([]);
  const [allProducts, setAllProducts] = useState<Produk[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedSjTipeIds, setSelectedSjTipeIds] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteConfirmTarget | null>(null);

  // State Pindah Box &/atau Tipe
  const [movingTarget, setMovingTarget] = useState<MovingTarget | null>(null);
  const [targetBoxId, setTargetBoxId] = useState<string>('');
  const [targetTipeId, setTargetTipeId] = useState<string>('SAME');
  const [moveQuantity, setMoveQuantity] = useState<string>('1');
  const [moveCatatan, setMoveCatatan] = useState<string>('');
  const [movingSubmitting, setMovingSubmitting] = useState<boolean>(false);

  // State Hapus Stok Jumlah Non-SN
  const [deletingStokTarget, setDeletingStokTarget] = useState<DeletingStokTarget | null>(null);
  const [deleteStokQty, setDeleteStokQty] = useState<string>('1');

  // State Ubah Kondisi Item
  const [editingConditionItem, setEditingConditionItem] = useState<BoxContentItem | null>(null);
  const [newKondisi, setNewKondisi] = useState<'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak'>('Baik');
  const [catatanKondisiInput, setCatatanKondisiInput] = useState<string>('');

  const loadContents = useCallback(async () => {
    if (!boxIdOrKode) return;
    try {
      setLoading(true);
      setLoadError(null);
      const [resContents, boxes, prods] = await Promise.all([
        stockApi.getBoxContents(boxIdOrKode),
        stockApi.listBoxes(),
        catalogApi.listProduk().catch(() => [])
      ]);
      setData(resContents);
      setAllBoxes(boxes);
      setAllProducts(prods || []);
      const otherBoxes = boxes.filter(b => b.id !== resContents.box.id);
      setTargetBoxId(otherBoxes.length > 0 ? otherBoxes[0].id : resContents.box.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat isi storage box.';
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [boxIdOrKode, showToast]);

  useEffect(() => {
    if (isOpen && boxIdOrKode) {
      setMovingTarget(null);
      setDeletingStokTarget(null);
      setEditingConditionItem(null);
      setSelectedItemIds([]);
      setSelectedSjTipeIds([]);
      setDeleteTarget(null);
      loadContents();
    } else if (!isOpen) {
      setData(null);
      setLoadError(null);
      setMovingTarget(null);
      setDeletingStokTarget(null);
      setEditingConditionItem(null);
      setSelectedItemIds([]);
      setSelectedSjTipeIds([]);
      setDeleteTarget(null);
    }
  }, [isOpen, boxIdOrKode, loadContents]);

  useEffect(() => {
    if (editingConditionItem) {
      setNewKondisi(editingConditionItem.kondisi || 'Baik');
      setCatatanKondisiInput(editingConditionItem.catatan_kondisi || '');
    }
  }, [editingConditionItem]);

  const compatibleTipeOptions = useMemo(() => {
    if (!movingTarget) return [] as Array<{ tipe: Tipe; produkNama: string }>;
    const list: Array<{ tipe: Tipe; produkNama: string }> = [];
    for (const p of allProducts) {
      for (const t of p.tipes || []) {
        if (t.mode_stok === movingTarget.mode && t.id !== movingTarget.tipeAsalId) {
          list.push({ tipe: t, produkNama: p.nama });
        }
      }
    }
    return list;
  }, [allProducts, movingTarget]);

  if (!isOpen || !boxIdOrKode) return null;

  const openMoveDialog = (target: MovingTarget) => {
    if (!data) return;
    setDeletingStokTarget(null);
    setEditingConditionItem(null);
    setMovingTarget(target);
    const otherBoxes = allBoxes.filter(b => b.id !== data.box.id);
    setTargetBoxId(otherBoxes.length > 0 ? otherBoxes[0].id : data.box.id);
    setTargetTipeId('SAME');
    setMoveQuantity(target.mode === 'jumlah' ? String(Math.max(1, target.jumlahAvailable || 1)) : '1');
    setMoveCatatan('');
  };

  const handleExecuteMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingTarget || !data) return;

    const chosenBoxId = targetBoxId || data.box.id;
    const chosenTipeId = targetTipeId !== 'SAME' ? Number(targetTipeId) : undefined;
    const sameBox = chosenBoxId === data.box.id;
    const sameTipe = !chosenTipeId || chosenTipeId === movingTarget.tipeAsalId;

    if (sameBox && sameTipe) {
      showToast('Pilih Box tujuan atau Varian Tipe tujuan yang berbeda.', 'warning');
      return;
    }

    setMovingSubmitting(true);
    try {
      const qty = parseInt(moveQuantity, 10) || 1;
      const res = await stockApi.moveUnit({
        item_ids: movingTarget.itemIds,
        tipe_asal_id: movingTarget.mode === 'jumlah' ? movingTarget.tipeAsalId : undefined,
        box_asal_id: data.box.id,
        jumlah: movingTarget.mode === 'jumlah' ? qty : undefined,
        box_tujuan_id: chosenBoxId,
        tipe_tujuan_id: chosenTipeId,
        catatan: moveCatatan.trim() || undefined
      });

      showToast(res.message, 'success');
      setMovingTarget(null);
      setSelectedItemIds([]);
      setMoveQuantity('1');
      setMoveCatatan('');
      await Promise.all([loadContents(), refreshData()]);
      if (onRefreshParent) onRefreshParent();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memindahkan item.', 'error');
    } finally {
      setMovingSubmitting(false);
    }
  };

  const handleOpenSingleStokDelete = (target: DeletingStokTarget) => {
    setMovingTarget(null);
    setEditingConditionItem(null);
    setDeletingStokTarget(target);
    setDeleteStokQty(String(Math.max(1, target.freeQty)));
  };

  const handleConfirmSingleStokDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingStokTarget || !data) return;
    const parsedQty = parseInt(deleteStokQty, 10) || 0;
    if (deletingStokTarget.freeQty <= 0) {
      setDeleteTarget({
        actionType: 'delete_stok_jumlah',
        targetId: `${deletingStokTarget.tipeId}:${deletingStokTarget.boxId}`,
        targetName: deletingStokTarget.label,
        entityLabel: 'Stok Non-SN',
        blockerMessage: `Seluruh ${deletingStokTarget.totalQty} unit di ${data.box.kode} sedang dipesan (${deletingStokTarget.reservedQty} reserved) sehingga tidak dapat dihapus.`,
        onConfirm: async () => {}
      });
      return;
    }
    if (parsedQty <= 0 || parsedQty > deletingStokTarget.freeQty) {
      showToast(`Jumlah hapus harus antara 1 sampai ${deletingStokTarget.freeQty} unit.`, 'warning');
      return;
    }

    const snapTarget = deletingStokTarget;
    setDeleteTarget({
      actionType: 'delete_stok_jumlah',
      targetId: `${snapTarget.tipeId}:${snapTarget.boxId}`,
      targetName: `${snapTarget.label} (${parsedQty} unit di ${data.box.kode})`,
      entityLabel: 'Stok Non-SN',
      blockerMessage: null,
      onConfirm: async (token) => {
        const res = await stockApi.deleteStokJumlah(snapTarget.tipeId, snapTarget.boxId, parsedQty, token);
        showToast(res.message, 'success');
        setDeletingStokTarget(null);
        setSelectedSjTipeIds((prev) => prev.filter((id) => id !== snapTarget.tipeId));
        await Promise.all([loadContents(), refreshData()]);
        onRefreshParent?.();
      }
    });
  };

  const handleConfirmBulkStokDelete = () => {
    if (!data || selectedSjTipeIds.length === 0) return;
    const entries = selectedSjTipeIds
      .map((tipeId) => data.raw_stok_jumlah.find((s) => s.tipe_id === tipeId))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    if (entries.length === 0) return;
    const blocked = entries.filter((s) => Math.max(0, Number(s.jumlah || 0) - Number(s.reserved_qty || 0)) <= 0);
    const targetKeys = entries.map((s) => `${s.tipe_id}:${s.box_id}`).sort();

    setDeleteTarget({
      actionType: 'delete_stok_jumlah',
      targetId: `bulk:${targetKeys.join(',')}`,
      targetName: `${entries.length} Entri Stok Non-SN (${data.box.kode})`,
      entityLabel: 'Stok Non-SN',
      itemCount: entries.length,
      itemLabels: entries.map((s) => {
        const free = Math.max(0, Number(s.jumlah || 0) - Number(s.reserved_qty || 0));
        return `${s.nama_produk || ''} - ${s.nama_tipe || ''} (${free} unit tersedia)`;
      }),
      blockerMessage: blocked.length > 0
        ? `Entri berikut sedang dipesan seluruhnya: ${blocked.map((b) => `${b.nama_produk} - ${b.nama_tipe}`).join(', ')}.`
        : null,
      onConfirm: async (token) => {
        const payload = entries.map((s) => ({
          tipe_id: s.tipe_id,
          box_id: s.box_id,
          jumlah: Math.max(0, Number(s.jumlah || 0) - Number(s.reserved_qty || 0))
        }));
        const res = await stockApi.deleteStokJumlahBulk(payload, token);
        showToast(res.message, 'success');
        setSelectedSjTipeIds([]);
        await Promise.all([loadContents(), refreshData()]);
        onRefreshParent?.();
      }
    });
  };

  const handleExecuteUpdateCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConditionItem) return;

    try {
      const resData = await catalogApi.updateItemCondition(
        editingConditionItem.id,
        newKondisi,
        catatanKondisiInput.trim() || undefined
      );

      showToast(String(resData.message || 'Kondisi item berhasil diperbarui.'), 'success');
      setEditingConditionItem(null);
      setCatatanKondisiInput('');
      await Promise.all([loadContents(), refreshData()]);
      if (onRefreshParent) onRefreshParent();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mengubah kondisi item.', 'error');
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

          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Loading / Error State */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            <span>Membaca isi box &amp; memetakan data barang...</span>
          </div>
        ) : loadError ? (
          <div className="p-8 text-center space-y-3 text-xs">
            <p className="text-rose-600 dark:text-rose-400 font-semibold">{loadError}</p>
            <button
              type="button"
              onClick={loadContents}
              className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang Isi Box</span>
            </button>
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
                <span className="font-bold text-slate-900 dark:text-white font-mono tabular-nums text-sm">{data.total_items} unit</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="font-medium text-slate-600 dark:text-slate-300">Stok Jumlah (Non-SN):</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono tabular-nums text-sm">{data.total_stok_jumlah} unit</span>
              </div>
            </div>

            {/* Bulk Selection Toolbar for Physical Items */}
            {canMove && data.raw_items.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedItemIds.length === data.raw_items.length) {
                      setSelectedItemIds([]);
                    } else {
                      setSelectedItemIds(data.raw_items.map((it) => it.id));
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md flex items-center gap-1.5"
                >
                  {selectedItemIds.length === data.raw_items.length ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>
                    {selectedItemIds.length === data.raw_items.length
                      ? 'Batal Pilih Item Ber-ID'
                      : `Pilih Semua Item Ber-ID (${data.raw_items.length})`}
                  </span>
                </button>

                {selectedItemIds.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const chosen = data.raw_items.filter((it) => selectedItemIds.includes(it.id));
                        const distinctTypes = Array.from(new Set(chosen.map((c) => c.tipe_id)));
                        const first = chosen[0];
                        openMoveDialog({
                          mode: 'per_id',
                          itemIds: selectedItemIds,
                          kodeIdLabel: `${chosen.length} item ber-ID terpilih`,
                          tipeAsalId: first ? first.tipe_id : 0,
                          sourceTipeLabel: distinctTypes.length === 1 && first
                            ? `${first.nama_produk} - ${first.nama_tipe}`
                            : `${distinctTypes.length} varian berbeda`
                        });
                      }}
                      className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md flex items-center gap-1.5 shadow-xs"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Pindah Box / Tipe ({selectedItemIds.length})</span>
                    </button>

                    {canManageCatalog && (
                      <button
                        type="button"
                        onClick={() => {
                          const chosen = data.raw_items.filter((it) => selectedItemIds.includes(it.id));
                          const nonActive = chosen.filter((it) => it.status !== 'aktif');
                          const sortedIds = [...selectedItemIds].map(String).sort();
                          setDeleteTarget({
                            actionType: 'delete_item',
                            targetId: `bulk:${sortedIds.join(',')}`,
                            targetName: `${chosen.length} Item Fisik`,
                            entityLabel: 'Item Fisik',
                            itemCount: chosen.length,
                            itemLabels: chosen.map((it) => `${it.kode_id} (${it.nama_produk} - ${it.nama_tipe})`),
                            blockerMessage: nonActive.length > 0
                              ? `Item berikut tidak berstatus aktif dan tidak dapat dihapus: ${nonActive.map((x) => `${x.kode_id} (${x.status})`).join(', ')}.`
                              : null,
                            onConfirm: async (token) => {
                              const res = await stockApi.deleteItemsBulk(selectedItemIds, token);
                              showToast(res.message, 'success');
                              setSelectedItemIds([]);
                              await Promise.all([loadContents(), refreshData()]);
                              onRefreshParent?.();
                            }
                          });
                        }}
                        className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-md flex items-center gap-1.5 shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Item ({selectedItemIds.length})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bulk Selection Toolbar for Non-SN (stok_jumlah) */}
            {canManageCatalog && data.raw_stok_jumlah.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSjTipeIds.length === data.raw_stok_jumlah.length) {
                      setSelectedSjTipeIds([]);
                    } else {
                      setSelectedSjTipeIds(data.raw_stok_jumlah.map((s) => s.tipe_id));
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md flex items-center gap-1.5"
                >
                  {selectedSjTipeIds.length === data.raw_stok_jumlah.length ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>
                    {selectedSjTipeIds.length === data.raw_stok_jumlah.length
                      ? 'Batal Pilih Stok Non-SN'
                      : `Pilih Semua Stok Non-SN (${data.raw_stok_jumlah.length})`}
                  </span>
                </button>

                {selectedSjTipeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmBulkStokDelete}
                    className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-md flex items-center gap-1.5 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Stok Non-SN ({selectedSjTipeIds.length})</span>
                  </button>
                )}
              </div>
            )}

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
                      {Object.entries(tipesObj).map(([tipeNama, contentObj]) => {
                        const rawSj = data.raw_stok_jumlah.find(
                          (s) => s.nama_tipe === tipeNama && s.nama_produk === produkNama
                        );
                        const sjReserved = Number(rawSj?.reserved_qty || 0);
                        const sjFree = Math.max(0, contentObj.stokJumlah - sjReserved);
                        const isSjChecked = rawSj ? selectedSjTipeIds.includes(rawSj.tipe_id) : false;

                        return (
                          <div key={tipeNama} className="bg-white dark:bg-slate-900 p-3 rounded-md border border-slate-200 dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                Varian: {tipeNama}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                                {contentObj.items.length > 0 && `${contentObj.items.length} item ber-ID`}
                                {contentObj.items.length > 0 && contentObj.stokJumlah > 0 && ' · '}
                                {contentObj.stokJumlah > 0 && `${contentObj.stokJumlah} unit stok jumlah`}
                              </span>
                            </div>

                            {/* Items List */}
                            {contentObj.items.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {contentObj.items.map((it: BoxContentItem) => {
                                  const kondisi = it.kondisi || 'Baik';
                                  const isChecked = selectedItemIds.includes(it.id);
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
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono ${
                                        isChecked
                                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500'
                                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                      }`}
                                    >
                                      {canMove && (
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            setSelectedItemIds((prev) =>
                                              prev.includes(it.id) ? prev.filter((id) => id !== it.id) : [...prev, it.id]
                                            );
                                          }}
                                          aria-label={`Pilih item ${it.kode_id}`}
                                          className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer"
                                        />
                                      )}
                                      <span className="font-bold text-slate-900 dark:text-white">{it.kode_id}</span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingConditionItem(it)}
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold border ${badgeColor} hover:opacity-80 transition-opacity`}
                                        title={it.catatan_kondisi ? `Kondisi: ${kondisi} (${it.catatan_kondisi}) - Klik untuk ubah` : `Kondisi: ${kondisi} - Klik untuk ubah`}
                                      >
                                        {kondisi}
                                      </button>
                                      {canMove && (
                                        <button
                                          type="button"
                                          onClick={() => openMoveDialog({
                                            mode: 'per_id',
                                            itemIds: [it.id],
                                            kodeIdLabel: it.kode_id,
                                            tipeAsalId: it.tipe_id,
                                            sourceTipeLabel: `${it.nama_produk} - ${it.nama_tipe}`
                                          })}
                                          className="p-0.5 text-slate-400 hover:text-emerald-500 transition-colors"
                                          title="Pindahkan item ini ke box atau tipe lain"
                                        >
                                          <ArrowRightLeft className="w-3 h-3" />
                                        </button>
                                      )}
                                      {canManageCatalog && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeleteTarget({
                                              actionType: 'delete_item',
                                              targetId: it.id,
                                              targetName: it.kode_id,
                                              entityLabel: 'Item Fisik',
                                              blockerMessage: it.status !== 'aktif'
                                                ? `Item "${it.kode_id}" berstatus "${it.status}" sehingga tidak dapat dihapus.`
                                                : null,
                                              onConfirm: async (token) => {
                                                const res = await stockApi.deleteItem(it.id, token);
                                                showToast(res.message, 'success');
                                                setSelectedItemIds((prev) => prev.filter((id) => id !== it.id));
                                                await Promise.all([loadContents(), refreshData()]);
                                                onRefreshParent?.();
                                              }
                                            });
                                          }}
                                          className="p-0.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 transition-colors"
                                          title={`Hapus item ${it.kode_id}`}
                                          aria-label={`Hapus item ${it.kode_id}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Stok Jumlah Row (Non-SN) */}
                            {contentObj.stokJumlah > 0 && rawSj && (
                              <div className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded border text-[11px] ${
                                isSjChecked
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500'
                                  : 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40'
                              }`}>
                                <div className="flex items-center gap-2">
                                  {canManageCatalog && (
                                    <input
                                      type="checkbox"
                                      checked={isSjChecked}
                                      onChange={() => {
                                        setSelectedSjTipeIds((prev) =>
                                          prev.includes(rawSj.tipe_id)
                                            ? prev.filter((id) => id !== rawSj.tipe_id)
                                            : [...prev, rawSj.tipe_id]
                                        );
                                      }}
                                      aria-label={`Pilih stok non-SN ${produkNama} ${tipeNama}`}
                                      className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 cursor-pointer"
                                    />
                                  )}
                                  <span className="font-medium text-emerald-900 dark:text-emerald-300">
                                    Total Stok Jumlah: <strong className="font-mono tabular-nums">{contentObj.stokJumlah} unit</strong>
                                    {sjReserved > 0 && (
                                      <span className="ml-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                                        ({sjFree} bebas · {sjReserved} dipesan)
                                      </span>
                                    )}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {canMove && (
                                    <button
                                      type="button"
                                      onClick={() => openMoveDialog({
                                        mode: 'jumlah',
                                        tipeAsalId: rawSj.tipe_id,
                                        sourceTipeLabel: `${produkNama} - ${tipeNama}`,
                                        jumlahAvailable: sjFree
                                      })}
                                      disabled={sjFree <= 0}
                                      className="px-2 py-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                      <span>Pindah Box / Tipe</span>
                                    </button>
                                  )}

                                  {canManageCatalog && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSingleStokDelete({
                                        tipeId: rawSj.tipe_id,
                                        boxId: rawSj.box_id,
                                        label: `${produkNama} - ${tipeNama}`,
                                        totalQty: contentObj.stokJumlah,
                                        reservedQty: sjReserved,
                                        freeQty: sjFree
                                      })}
                                      className="px-2 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 rounded transition-colors flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Hapus Stok</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Sub-Dialog Pindah Box / Tipe */}
            {movingTarget && (
              <form onSubmit={handleExecuteMove} className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4" />
                    Pindah Box / Tipe: {movingTarget.kodeIdLabel || movingTarget.sourceTipeLabel}
                  </span>
                  <button type="button" onClick={() => setMovingTarget(null)} className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Lokasi Box Tujuan
                    </label>
                    <select
                      value={targetBoxId}
                      onChange={e => setTargetBoxId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold"
                    >
                      {allBoxes.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.kode}{b.id === data.box.id ? ' (Box Saat Ini)' : ''} {b.keterangan ? `- ${b.keterangan}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Varian Tipe Tujuan ({movingTarget.mode === 'per_id' ? 'Mode Ber-ID' : 'Mode Jumlah'})
                    </label>
                    <select
                      value={targetTipeId}
                      onChange={e => setTargetTipeId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    >
                      <option value="SAME">Tetap sama ({movingTarget.sourceTipeLabel})</option>
                      {compatibleTipeOptions.map(({ tipe, produkNama }) => (
                        <option key={tipe.id} value={String(tipe.id)}>
                          {produkNama} — {tipe.nama_tipe}
                        </option>
                      ))}
                    </select>
                  </div>

                  {movingTarget.mode === 'jumlah' && (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Jumlah Dipindah * (Tersedia: {movingTarget.jumlahAvailable})
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
                    placeholder="Catatan alasan relokasi box / penyesuaian tipe..."
                    value={moveCatatan}
                    onChange={e => setMoveCatatan(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-[11px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMovingTarget(null)}
                    className="px-3 py-1.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={movingSubmitting}
                    className="px-4 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                  >
                    {movingSubmitting ? 'Memindahkan...' : 'Eksekusi Pemindahan'}
                  </button>
                </div>
              </form>
            )}

            {/* Modal Sub-Dialog Hapus Sebagian/Semua Stok Jumlah Non-SN */}
            {deletingStokTarget && (
              <form onSubmit={handleConfirmSingleStokDelete} className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900 dark:text-rose-200 text-xs flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" />
                    Hapus Stok Non-SN: {deletingStokTarget.label}
                  </span>
                  <button type="button" onClick={() => setDeletingStokTarget(null)} className="text-rose-700 hover:text-rose-900 dark:text-rose-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Jumlah yang Dihapus (Maks bebas: {deletingStokTarget.freeQty} unit)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={deleteStokQty}
                      onFocus={(e) => e.target.select()}
                      onChange={e => setDeleteStokQty(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteStokQty(String(Math.max(1, deletingStokTarget.freeQty)))}
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200"
                    >
                      Pilih Semua ({deletingStokTarget.freeQty})
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-md"
                    >
                      Lanjut Konfirmasi
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Modal Sub-Dialog Ubah Kondisi Item */}
            {editingConditionItem && (
              <form onSubmit={handleExecuteUpdateCondition} className="p-4 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg space-y-3">
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
                      onChange={e => setNewKondisi(e.target.value as 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak')}
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
                    className="px-3 py-1.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-md"
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
      <ConfirmDeleteModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
