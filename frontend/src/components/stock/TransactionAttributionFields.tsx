/**
 * Transaction Attribution & Time Fields (Atas Nama, Alasan, Waktu Kejadian WIB, & Hubungkan Request)
 * Shared by StockInputModal and StockInOutModal
 */

import React, { useEffect, useState } from 'react';
import { UserCheck, Clock, Link2, CheckCircle2, AlertCircle, Unlink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { requestApi, RequestRecord } from '../../services/requestApi';
import { canActOnBehalf, canOverrideOccurredAtLimit } from '../../utils/permissions';
import { formatWibDateTime, wibLocalInputToUtcIso } from '../../utils/timezone';

interface TransactionAttributionFieldsProps {
  mode: 'IN' | 'OUT';
  actorId: string;
  onActorIdChange: (id: string) => void;
  onBehalfReason: string;
  onBehalfReasonChange: (val: string) => void;
  occurredAtLocal: string;
  onOccurredAtLocalChange: (val: string) => void;
  selectedRequest: RequestRecord | null;
  onSelectRequest: (req: RequestRecord | null) => void;
  onTimeValidationChange?: (errorMsg: string | null) => void;
}

export const TransactionAttributionFields: React.FC<TransactionAttributionFieldsProps> = ({
  mode,
  actorId,
  onActorIdChange,
  onBehalfReason,
  onBehalfReasonChange,
  occurredAtLocal,
  onOccurredAtLocalChange,
  selectedRequest,
  onSelectRequest,
  onTimeValidationChange
}) => {
  const { user } = useAuth();
  const { actors } = useInventory();
  const [openRequests, setOpenRequests] = useState<RequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const allowOnBehalf = canActOnBehalf(user?.role);
  const allowBackdateOverride = canOverrideOccurredAtLimit(user?.role);
  const isOnBehalf = Boolean(user && actorId && actorId !== user.id);

  // Validate occurredAtLocal on change
  const timeError = React.useMemo(() => {
    if (!occurredAtLocal) return 'Waktu kejadian wajib diisi.';
    const utcIso = wibLocalInputToUtcIso(occurredAtLocal);
    const parsed = new Date(utcIso);
    if (Number.isNaN(parsed.getTime())) return 'Format waktu kejadian tidak valid.';
    const now = Date.now();
    if (parsed.getTime() > now + 2 * 60 * 1000) {
      return 'Waktu kejadian tidak boleh di masa depan.';
    }
    const maxPastMs = 7 * 24 * 60 * 60 * 1000;
    if (!allowBackdateOverride && now - parsed.getTime() > maxPastMs) {
      return 'Admin Gudang maksimal mencatat mundur 7 hari. Gunakan Admin/Developer untuk koreksi lebih lama.';
    }
    return null;
  }, [occurredAtLocal, allowBackdateOverride]);

  useEffect(() => {
    onTimeValidationChange?.(timeError);
  }, [timeError, onTimeValidationChange]);

  // Fetch open requests when target actor changes in OUT mode
  useEffect(() => {
    let mounted = true;
    if (mode !== 'OUT' || !allowOnBehalf || !actorId) {
      setOpenRequests([]);
      return;
    }

    setLoadingRequests(true);
    requestApi
      .listOpenForActor(actorId)
      .then((list) => {
        if (mounted) setOpenRequests(list);
      })
      .catch(() => {
        if (mounted) setOpenRequests([]);
      })
      .finally(() => {
        if (mounted) setLoadingRequests(false);
      });

    return () => {
      mounted = false;
    };
  }, [mode, allowOnBehalf, actorId]);

  const actorOptions = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string; username: string }>();
    if (user) {
      map.set(user.id, {
        id: user.id,
        name: user.name,
        role: user.role,
        username: user.username
      });
    }
    for (const a of actors) {
      map.set(a.id, a);
    }
    return Array.from(map.values());
  }, [actors, user]);

  return (
    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Pelaku / Atas Nama */}
        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Atas Nama (Pelaku Lapangan) *</span>
          </label>
          {allowOnBehalf ? (
            <select
              value={actorId}
              onChange={(e) => {
                onActorIdChange(e.target.value);
                onSelectRequest(null);
              }}
              className="w-full px-2.5 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium"
            >
              {actorOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role}){user && a.id === user.id ? ' — Diri Sendiri' : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              readOnly
              disabled
              value={`${user?.name || '-'} (${user?.role || 'technician'})`}
              className="w-full px-2.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 cursor-not-allowed"
            />
          )}
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
            Dicatat oleh: <strong className="text-slate-700 dark:text-slate-300">{user?.name}</strong>
          </span>
        </div>

        {/* Waktu Kejadian (WIB) */}
        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Waktu Kejadian (WIB) *</span>
          </label>
          <input
            type="datetime-local"
            value={occurredAtLocal}
            onChange={(e) => onOccurredAtLocalChange(e.target.value)}
            className={`w-full px-2.5 py-2 bg-white dark:bg-slate-950 border rounded-lg font-mono text-slate-900 dark:text-slate-100 ${
              timeError
                ? 'border-rose-500 focus:ring-rose-500'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          />
          {timeError ? (
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-1 block">
              {timeError}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
              Disimpan UTC, ditampilkan WIB · Maks {allowBackdateOverride ? 'tak terbatas' : '7 hari'}
            </span>
          )}
        </div>
      </div>

      {/* Alasan Atas Nama (Wajib jika berbeda dengan user login) */}
      {isOnBehalf && (
        <div>
          <label className="block font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Alasan Mencatat Atas Nama Orang Lain * (Wajib min. 3 karakter)
          </label>
          <input
            type="text"
            required
            placeholder="Misal: Teknisi sedang berada di lokasi pemasangan / serah terima gudang..."
            value={onBehalfReason}
            onChange={(e) => onBehalfReasonChange(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-800 rounded-lg text-slate-900 dark:text-slate-100"
          />
        </div>
      )}

      {/* 1-Click Hubungkan ke Request (Saat OUTPUT dan actor punya request terbuka) */}
      {mode === 'OUT' && allowOnBehalf && (loadingRequests || openRequests.length > 0 || selectedRequest) && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {selectedRequest ? (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200 truncate">
                    Terhubung ke {selectedRequest.id} · {selectedRequest.nama_produk} ({selectedRequest.nama_tipe})
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                    {selectedRequest.kode_id ? `SN: ${selectedRequest.kode_id}` : `Qty: ${selectedRequest.jumlah} ${selectedRequest.tipe_stok || 'unit'}`} · Status: {selectedRequest.status.toUpperCase()}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectRequest(null)}
                className="px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded flex items-center gap-1 shrink-0 hover:bg-slate-100"
              >
                <Unlink className="w-3 h-3" />
                <span>Lepas</span>
              </button>
            </div>
          ) : loadingRequests ? (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Memeriksa permohonan terbuka milik teknisi...
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                <AlertCircle className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Teknisi ini memiliki {openRequests.length} request terbuka — hubungkan 1 klik:</span>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {openRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {req.nama_produk} — {req.nama_tipe}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        {req.id} · {req.kode_id || `${req.jumlah} ${req.tipe_stok || 'unit'}`} · {req.status.toUpperCase()} · {formatWibDateTime(req.dibuat_pada)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectRequest(req)}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-md flex items-center gap-1 shrink-0"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Hubungkan ke Request</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
