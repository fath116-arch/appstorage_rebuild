/**
 * Technician Requests, Reservation, Pickup, Mandatory Return & Held Tools View
 * FieldOps IT — Single Canonical Flow
 */

import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  XCircle,
  PackageCheck,
  RotateCcw,
  Clock,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Wrench,
  Search,
  X
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { requestApi, RequestRecord, RequestTimelineEntry } from '../../services/requestApi';
import { canActOnBehalf, canManageRequests } from '../../utils/permissions';
import { formatDurationSince, formatWibDateTime, getCurrentWibDateTimeLocalInput, wibLocalInputToUtcIso } from '../../utils/timezone';
import { getErrorMessage } from '../../utils/errorUtils';

const STATUS_LABELS: Record<string, string> = {
  diajukan: 'Diajukan',
  menunggu: 'Menunggu',
  disetujui: 'Disetujui (Dipesan)',
  diambil: 'Diambil / Dipakai',
  dikembalikan: 'Dikembalikan',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan'
};

export const TechnicianRequestsView: React.FC = () => {
  const { user } = useAuth();
  const { products, boxes, requests, heldItems, actors, refreshData, showToast } = useInventory();

  const isManager = canManageRequests(user?.role);
  const allowOnBehalf = canActOnBehalf(user?.role);

  const [subTab, setSubTab] = useState<'requests' | 'held'>('requests');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Timeline expand cache
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);
  const [timelines, setTimelines] = useState<Record<string, RequestTimelineEntry[]>>({});
  const [loadingTimelineId, setLoadingTimelineId] = useState<string | null>(null);

  // Create Request Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reqProdId, setReqProdId] = useState<number | ''>('');
  const [reqTipeId, setReqTipeId] = useState<number | ''>('');
  const [reqBoxId, setReqBoxId] = useState<string>('');
  const [reqKodeId, setReqKodeId] = useState<string>('');
  const [reqJumlah, setReqJumlah] = useState<string>('1');
  const [reqAlasan, setReqAlasan] = useState<string>('');
  const [reqActorId, setReqActorId] = useState<string>('');
  const [reqOnBehalfReason, setReqOnBehalfReason] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // Return Modal
  const [returnTarget, setReturnTarget] = useState<RequestRecord | null>(null);
  const [returnBoxId, setReturnBoxId] = useState<string>('');
  const [returnCondition, setReturnCondition] = useState<'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak'>('Baik');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [returnOccurredLocal, setReturnOccurredLocal] = useState<string>(() => getCurrentWibDateTimeLocalInput());
  const [returning, setReturning] = useState(false);

  // Pickup Modal (confirm WIB time)
  const [pickupTarget, setPickupTarget] = useState<RequestRecord | null>(null);
  const [pickupOccurredLocal, setPickupOccurredLocal] = useState<string>(() => getCurrentWibDateTimeLocalInput());
  const [pickupNotes, setPickupNotes] = useState<string>('');
  const [pickingUp, setPickingUp] = useState(false);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === Number(reqProdId)) || null;
  }, [products, reqProdId]);

  const tipesForProduct = useMemo(() => selectedProduct?.tipes || [], [selectedProduct]);
  const selectedTipe = useMemo(
    () => tipesForProduct.find((t) => t.id === Number(reqTipeId)) || null,
    [tipesForProduct, reqTipeId]
  );

  const openCreateModal = () => {
    const firstProd = products[0];
    const firstTipe = firstProd?.tipes?.[0];
    setReqProdId(firstProd?.id || '');
    setReqTipeId(firstTipe?.id || '');
    setReqBoxId(firstTipe?.sebaran_box?.[0]?.box_id || boxes[0]?.id || '');
    setReqKodeId('');
    setReqJumlah('1');
    setReqAlasan('');
    setReqActorId(user?.id || '');
    setReqOnBehalfReason('');
    setIsCreateOpen(true);
  };

  const handleToggleTimeline = async (reqId: string) => {
    if (expandedTimelineId === reqId) {
      setExpandedTimelineId(null);
      return;
    }
    setExpandedTimelineId(reqId);
    setLoadingTimelineId(reqId);
    try {
      const data = await requestApi.getTimeline(reqId);
      setTimelines((prev) => ({ ...prev, [reqId]: data }));
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoadingTimelineId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTipeId || !reqAlasan.trim()) {
      showToast('Pilih produk/tipe dan isi alasan permohonan.', 'warning');
      return;
    }
    const isOnBehalf = Boolean(allowOnBehalf && user && reqActorId && reqActorId !== user.id);
    if (isOnBehalf && reqOnBehalfReason.trim().length < 3) {
      showToast('Alasan pengajuan atas nama teknisi lain wajib diisi.', 'warning');
      return;
    }

    setCreating(true);
    try {
      await requestApi.create({
        tipe_id: Number(reqTipeId),
        box_id: reqBoxId || undefined,
        kode_id: reqKodeId.trim() || undefined,
        jumlah: parseInt(reqJumlah, 10) || 1,
        alasan: reqAlasan.trim(),
        actor_id: isOnBehalf ? reqActorId : undefined,
        on_behalf_reason: isOnBehalf ? reqOnBehalfReason.trim() : undefined
      });
      showToast('Permohonan barang berhasil diajukan.', 'success');
      setIsCreateOpen(false);
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (req: RequestRecord) => {
    setBusyId(req.id);
    try {
      const res = await requestApi.approve(req.id, {
        target_box_id: req.box_id || boxes[0]?.id
      });
      showToast(res.message || 'Request disetujui dan stok direservasi.', 'success');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: RequestRecord) => {
    const reason = window.prompt(`Alasan penolakan untuk ${req.id} (opsional):`, '') ?? '';
    setBusyId(req.id);
    try {
      const res = await requestApi.reject(req.id, { catatan_penolakan: reason || undefined });
      showToast(res.message || 'Request ditolak.', 'info');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (req: RequestRecord) => {
    setBusyId(req.id);
    try {
      const res = await requestApi.cancel(req.id, 'Dibatalkan oleh pengguna');
      showToast(res.message || 'Request dibatalkan dan reservasi dilepaskan.', 'info');
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupTarget) return;
    setPickingUp(true);
    try {
      const res = await requestApi.pickup(pickupTarget.id, {
        occurred_at: wibLocalInputToUtcIso(pickupOccurredLocal),
        catatan: pickupNotes.trim() || undefined
      });
      showToast(res.message || 'Pengambilan barang berhasil dicatat.', 'success');
      setPickupTarget(null);
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setPickingUp(false);
    }
  };

  const openReturnDialog = (req: RequestRecord) => {
    setReturnTarget(req);
    setReturnBoxId(req.box_id || boxes[0]?.id || '');
    setReturnCondition('Baik');
    setReturnNotes('');
    setReturnOccurredLocal(getCurrentWibDateTimeLocalInput());
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget || !returnBoxId) {
      showToast('Pilih storage box tujuan pengembalian.', 'warning');
      return;
    }
    setReturning(true);
    try {
      const res = await requestApi.returnRequest(returnTarget.id, {
        return_box_id: returnBoxId,
        return_condition: returnCondition,
        return_notes: returnNotes.trim() || undefined,
        occurred_at: wibLocalInputToUtcIso(returnOccurredLocal)
      });
      showToast(res.message || 'Pengembalian barang berhasil dicatat.', 'success');
      setReturnTarget(null);
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setReturning(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'diajukan') {
          if (r.status !== 'diajukan' && r.status !== 'menunggu') return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        (r.nama_produk && r.nama_produk.toLowerCase().includes(q)) ||
        (r.nama_tipe && r.nama_tipe.toLowerCase().includes(q)) ||
        (r.kode_id && r.kode_id.toLowerCase().includes(q)) ||
        (r.nama_pemohon && r.nama_pemohon.toLowerCase().includes(q)) ||
        (r.alasan && r.alasan.toLowerCase().includes(q))
      );
    });
  }, [requests, statusFilter, searchQuery]);

  const filteredHeld = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return heldItems;
    return heldItems.filter(
      (h) =>
        h.id.toLowerCase().includes(q) ||
        (h.nama_produk && h.nama_produk.toLowerCase().includes(q)) ||
        (h.nama_tipe && h.nama_tipe.toLowerCase().includes(q)) ||
        (h.kode_id && h.kode_id.toLowerCase().includes(q)) ||
        (h.nama_pemohon && h.nama_pemohon.toLowerCase().includes(q))
    );
  }, [heldItems, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Permohonan Barang &amp; Alat di Tangan Teknisi</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Alur terpadu: Ajukan · Reservasi Stok (Dipesan) · Ambil · Pengembalian Alat · Audit Timeline (WIB)
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 self-start sm:self-center shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Barang / Alat</span>
        </button>
      </div>

      {/* Subtab Bar & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setSubTab('requests')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              subTab === 'requests'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Daftar Request ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('held')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              subTab === 'held'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Barang di Tangan Teknisi ({heldItems.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari ID request, teknisi, SN, produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 w-64"
            />
          </div>

          {subTab === 'requests' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="all">Semua Status</option>
              <option value="diajukan">Diajukan</option>
              <option value="disetujui">Disetujui (Dipesan)</option>
              <option value="diambil">Diambil</option>
              <option value="dikembalikan">Dikembalikan</option>
              <option value="ditolak">Ditolak</option>
              <option value="dibatalkan">Dibatalkan</option>
            </select>
          )}
        </div>
      </div>

      {/* Subtab 1: Daftar Request & Timeline */}
      {subTab === 'requests' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Belum ada data permohonan yang sesuai filter.
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isOpenTimeline = expandedTimelineId === req.id;
              const isBusy = busyId === req.id;
              const isPending = req.status === 'diajukan' || req.status === 'menunggu';
              const isApproved = req.status === 'disetujui';
              const isPickedUp = req.status === 'diambil';
              const isOwner = user && (req.pemohon_id === user.id || req.actor_id === user.id);

              return (
                <div key={req.id} className="p-4 space-y-3 text-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{req.id}</span>
                        <span className="text-slate-400">·</span>
                        <span
                          className={`font-bold ${
                            isPending
                              ? 'text-amber-600 dark:text-amber-400'
                              : isApproved
                              ? 'text-sky-600 dark:text-sky-400'
                              : isPickedUp
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : req.status === 'dikembalikan'
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {STATUS_LABELS[req.status] || req.status.toUpperCase()}
                        </span>
                        {req.kategori_barang === 'Alat' && (
                          <>
                            <span className="text-slate-400">·</span>
                            <span className="font-sans font-semibold text-amber-700 dark:text-amber-300">
                              Alat (Wajib Kembali)
                            </span>
                          </>
                        )}
                      </div>

                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {req.nama_produk} — {req.nama_tipe}
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {req.kode_id ? `SN: ${req.kode_id}` : `${req.jumlah} ${req.tipe_stok || 'unit'}`}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span>
                          Pemohon: <strong className="text-slate-800 dark:text-slate-200">{req.nama_pemohon || req.pemohon_id}</strong>
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono tabular-nums">{formatWibDateTime(req.dibuat_pada)}</span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Alasan: {req.alasan}
                        {req.catatan_penolakan ? ` · Catatan Tolak: ${req.catatan_penolakan}` : ''}
                        {req.return_condition ? ` · Kondisi Kembali: ${req.return_condition} (Box ${req.return_box_kode || req.return_box_id})` : ''}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {isManager && isPending && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleApprove(req)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Setujui &amp; Reservasi</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleReject(req)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        </>
                      )}

                      {isManager && isApproved && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setPickupTarget(req);
                            setPickupOccurredLocal(getCurrentWibDateTimeLocalInput());
                            setPickupNotes('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-semibold flex items-center gap-1"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Catat Pengambilan</span>
                        </button>
                      )}

                      {isManager && isPickedUp && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openReturnDialog(req)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Kembalikan Barang</span>
                        </button>
                      )}

                      {(isManager || isOwner) && (isPending || isApproved) && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleCancel(req)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                        >
                          Batalkan
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleTimeline(req.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium flex items-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Timeline</span>
                        {isOpenTimeline ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Timeline */}
                  {isOpenTimeline && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Riwayat Aktivitas Request {req.id} (WIB)
                      </div>
                      {loadingTimelineId === req.id ? (
                        <div className="text-[11px] text-slate-400">Memuat timeline...</div>
                      ) : (timelines[req.id] || []).length === 0 ? (
                        <div className="text-[11px] text-slate-400">Belum ada log aktivitas tercatat.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {(timelines[req.id] || []).map((entry) => (
                            <div
                              key={entry.id_aktivitas}
                              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
                            >
                              <div>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {entry.id_aktivitas}
                                </span>{' '}
                                <span className="text-slate-400">·</span>{' '}
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
                                  {entry.aksi.replace(/_/g, ' ')}
                                </span>
                                <span className="text-slate-400"> · </span>
                                <span className="text-slate-700 dark:text-slate-300">
                                  Pelaku: <strong>{entry.actor_nama || entry.nama_pelaku || '-'}</strong>
                                  {entry.is_on_behalf && entry.recorded_by_nama
                                    ? ` (Dicatat oleh ${entry.recorded_by_nama})`
                                    : ''}
                                </span>
                                {entry.catatan && (
                                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">{entry.catatan}</div>
                                )}
                              </div>
                              <div className="font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                                {formatWibDateTime(entry.occurred_at || entry.waktu)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Subtab 2: Barang di Tangan Teknisi */}
      {subTab === 'held' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {filteredHeld.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Tidak ada alat atau barang yang sedang dipegang teknisi saat ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="py-3 px-4">Teknisi</th>
                    <th className="py-3 px-4">Produk &amp; Tipe</th>
                    <th className="py-3 px-4">SN / Jumlah</th>
                    <th className="py-3 px-4">Diambil (WIB)</th>
                    <th className="py-3 px-4">Durasi Pegang</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHeld.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{h.nama_pemohon || h.pemohon_id}</div>
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{h.id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {h.nama_produk} — {h.nama_tipe}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {h.kategori_barang || 'Barang Habis Pakai'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        {h.kode_id || `${h.jumlah} ${h.tipe_stok || 'unit'}`}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {formatWibDateTime(h.taken_at || h.diproses_pada || h.dibuat_pada)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {formatDurationSince(h.taken_at || h.diproses_pada, h.held_duration_ms)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isManager ? (
                          <button
                            type="button"
                            onClick={() => openReturnDialog(h)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Kembalikan</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Serahkan ke Admin Gudang</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Ajukan Barang / Alat */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Ajukan Permohonan Barang / Peminjaman Alat
              </h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              {allowOnBehalf && (
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Atas Nama Teknisi</span>
                  </label>
                  <select
                    value={reqActorId}
                    onChange={(e) => setReqActorId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value={user?.id || ''}>{user?.name} (Diri Sendiri)</option>
                    {actors
                      .filter((a) => a.id !== user?.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.role})
                        </option>
                      ))}
                  </select>
                  {user && reqActorId && reqActorId !== user.id && (
                    <input
                      type="text"
                      required
                      placeholder="Alasan membuat request atas nama teknisi ini..."
                      value={reqOnBehalfReason}
                      onChange={(e) => setReqOnBehalfReason(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Produk *</label>
                  <select
                    value={reqProdId}
                    onChange={(e) => {
                      const pId = Number(e.target.value);
                      setReqProdId(pId);
                      const prod = products.find((p) => p.id === pId);
                      const firstT = prod?.tipes?.[0];
                      setReqTipeId(firstT?.id || '');
                      setReqBoxId(firstT?.sebaran_box?.[0]?.box_id || boxes[0]?.id || '');
                    }}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} ({p.kategori_barang || 'Habis Pakai'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tipe *</label>
                  <select
                    value={reqTipeId}
                    onChange={(e) => {
                      const tId = Number(e.target.value);
                      setReqTipeId(tId);
                      const t = tipesForProduct.find((x) => x.id === tId);
                      if (t?.sebaran_box?.[0]?.box_id) setReqBoxId(t.sebaran_box[0].box_id);
                    }}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {tipesForProduct.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nama_tipe} (Tersedia: {t.stok_tersedia ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTipe?.mode_stok === 'per_id' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SN Spesifik (Opsional — kosongkan untuk alokasi otomatis saat disetujui)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: ZTEGD1234567"
                      value={reqKodeId}
                      onChange={(e) => setReqKodeId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Jumlah Unit</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={Boolean(reqKodeId.trim())}
                      value={reqKodeId.trim() ? '1' : reqJumlah}
                      onChange={(e) => setReqJumlah(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Box Asal</label>
                    <select
                      value={reqBoxId}
                      onChange={(e) => setReqBoxId(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100"
                    >
                      {boxes.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.kode}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Jumlah</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={reqJumlah}
                      onChange={(e) => setReqJumlah(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alasan / Nomor Tiket Pemakaian *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Misal: Pemasangan pelanggan baru Cluster Melati / Peminjaman splicer lapangan..."
                  value={reqAlasan}
                  onChange={(e) => setReqAlasan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg disabled:opacity-50"
                >
                  {creating ? 'Mengajukan...' : 'Kirim Permohonan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Catat Pengambilan Barang */}
      {pickupTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Konfirmasi Pengambilan ({pickupTarget.id})
              </h3>
              <button type="button" onClick={() => setPickupTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmPickup} className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {pickupTarget.nama_produk} — {pickupTarget.nama_tipe}
                </div>
                <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  Pemohon: {pickupTarget.nama_pemohon} · {pickupTarget.kode_id || `${pickupTarget.jumlah} ${pickupTarget.tipe_stok || 'unit'}`}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Waktu Penyerahan (WIB) *
                </label>
                <input
                  type="datetime-local"
                  value={pickupOccurredLocal}
                  onChange={(e) => setPickupOccurredLocal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Penyerahan (Opsional)
                </label>
                <input
                  type="text"
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  placeholder="Misal: Diserahkan langsung di meja gudang..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPickupTarget(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pickingUp}
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50"
                >
                  {pickingUp ? 'Menyimpan...' : 'Konfirmasi Diambil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pengembalian Alat / Barang */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Catat Pengembalian ({returnTarget.id})
              </h3>
              <button type="button" onClick={() => setReturnTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmReturn} className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {returnTarget.nama_produk} — {returnTarget.nama_tipe}
                </div>
                <div className="font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  Pemegang: {returnTarget.nama_pemohon} · {returnTarget.kode_id || `${returnTarget.jumlah} unit`}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Storage Box Tujuan *
                  </label>
                  <select
                    value={returnBoxId}
                    onChange={(e) => setReturnBoxId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100"
                  >
                    {boxes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.kode}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kondisi Saat Kembali *
                  </label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Baru">Baru (Belum Terpakai)</option>
                    <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                    <option value="Rusak">Rusak</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Waktu Pengembalian (WIB) *
                </label>
                <input
                  type="datetime-local"
                  value={returnOccurredLocal}
                  onChange={(e) => setReturnOccurredLocal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Pemeriksaan Kondisi
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Misal: Kondisi lengkap, baterai normal, kabel bersih..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={returning}
                  className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
                >
                  {returning ? 'Menyimpan...' : 'Simpan Pengembalian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
