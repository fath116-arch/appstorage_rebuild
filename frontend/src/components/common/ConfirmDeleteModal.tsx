/**
 * Reusable Tier-3 Deletion & Dependency Blocker Confirmation Modal
 * Requires typing "delete" (case-insensitive) for single or bulk deletion.
 */

import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Lock, X, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

export interface DeleteConfirmTarget {
  actionType: 'delete_kind' | 'delete_product' | 'delete_box' | 'delete_attribute' | 'delete_item';
  targetId: string;
  targetName: string;
  entityLabel: string;
  itemCount?: number;
  itemLabels?: string[];
  blockerMessage?: string | null;
  onConfirm: (confirmationToken: string) => Promise<void>;
}

interface ConfirmDeleteModalProps {
  target: DeleteConfirmTarget | null;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ target, onClose }) => {
  const [typedConfirm, setTypedConfirm] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTypedConfirm('');
    setReauthPassword('');
    setNeedsReauth(false);
    setErrorMsg(null);
    setSubmitting(false);
  }, [target]);

  if (!target) return null;

  const isMatched = typedConfirm.trim().toLowerCase() === 'delete';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (target.blockerMessage) return;

    if (!isMatched) {
      setErrorMsg('Ketik kata "delete" untuk melanjutkan penghapusan.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const tokenRes = await api.requestConfirmationToken({
        actionType: target.actionType,
        targetId: target.targetId,
        targetName: target.targetName,
        objectNameTyped: typedConfirm.trim(),
        reauthPassword: reauthPassword || undefined
      });

      if (!tokenRes.success) {
        if (tokenRes.requiresReauth) {
          setNeedsReauth(true);
        }
        setErrorMsg(tokenRes.message || 'Konfirmasi gagal.');
        return;
      }

      if (!tokenRes.token) {
        setErrorMsg('Token konfirmasi tidak diterima dari server.');
        return;
      }

      await target.onConfirm(tokenRes.token);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses penghapusan.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${target.blockerMessage ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'}`}>
              {target.blockerMessage ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {target.blockerMessage ? `Tidak Dapat Menghapus ${target.entityLabel}` : `Hapus ${target.entityLabel}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {target.itemCount && target.itemCount > 1
                  ? `${target.itemCount} item terpilih`
                  : target.targetName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {target.blockerMessage ? (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 leading-relaxed">
              {target.blockerMessage}
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Kosongkan stok / selesaikan atau pindahkan data terkait terlebih dahulu sebelum menghapus {target.entityLabel.toLowerCase()} ini.
            </p>
            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg"
              >
                Mengerti
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300">
              Data yang dihapus akan dicatat ke Audit Log{target.actionType !== 'delete_attribute' ? ' dan dipindahkan ke Kotak Sampah (retensi 14 hari)' : ''}.
            </div>

            {target.itemLabels && target.itemLabels.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-h-28 overflow-y-auto space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400">Daftar target penghapusan:</div>
                {target.itemLabels.slice(0, 8).map((lbl, idx) => (
                  <div key={idx} className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate">
                    • {lbl}
                  </div>
                ))}
                {target.itemLabels.length > 8 && (
                  <div className="text-[10px] text-slate-500 italic">
                    +{target.itemLabels.length - 8} item lainnya
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ketik <code className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">delete</code> untuk konfirmasi:
              </label>
              <input
                type="text"
                autoFocus
                required
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                placeholder="delete"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {needsReauth && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Verifikasi Ulang Kata Sandi Akun Anda *</span>
                </label>
                <input
                  type="password"
                  required
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Masukkan kata sandi akun..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !isMatched}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{submitting ? 'Menghapus...' : `Hapus ${target.entityLabel}`}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
