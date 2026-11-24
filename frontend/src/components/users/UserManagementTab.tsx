/**
 * Registered Users Management Tab
 * - Developer-only per-account "Atur Fitur" modal using pure ON/OFF sliders
 * - Admin can manage only Admin & Technician accounts
 */

import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  KeyRound,
  Trash2,
  Sliders,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api, UserProfile } from '../../services/api';
import {
  FEATURE_CATALOG,
  FeatureKey,
  getEffectiveFeaturePermissions,
  getRoleDisplayLabel,
  normalizeRole,
  parseFeaturePermissions
} from '../../utils/permissions';
import { getErrorMessage } from '../../utils/errorUtils';

interface UserManagementTabProps {
  currentUserId?: string;
  isDeveloper: boolean;
  usersList: UserProfile[];
  isLoadingUsers: boolean;
  onAddUserClick: () => void;
  onApprove: (userId: string, username: string) => void;
  onToggleStatus: (userId: string, currentStatus: string, username: string) => void;
  onResetPassword: (userId: string, username: string) => void;
  onDeleteUser: (userId: string, username: string) => void;
  onRefreshUsers: () => void;
  onFeatureNotice?: (type: 'error' | 'success', text: string) => void;
}

const FEATURE_CATEGORIES: Array<'Operasional & Katalog' | 'Permohonan & Laporan' | 'Pengaturan & Sistem'> = [
  'Operasional & Katalog',
  'Permohonan & Laporan',
  'Pengaturan & Sistem'
];

export const UserManagementTab: React.FC<UserManagementTabProps> = ({
  currentUserId,
  isDeveloper,
  usersList,
  isLoadingUsers,
  onAddUserClick,
  onApprove,
  onToggleStatus,
  onResetPassword,
  onDeleteUser,
  onRefreshUsers,
  onFeatureNotice
}) => {
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [draftState, setDraftState] = useState<Record<FeatureKey, boolean> | null>(null);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const openFeatureModal = (u: UserProfile) => {
    setModalError(null);
    setEditingUser(u);
    setDraftState(getEffectiveFeaturePermissions(u.role, u.feature_permissions));
  };

  const closeFeatureModal = () => {
    setEditingUser(null);
    setDraftState(null);
    setModalError(null);
  };

  const handleToggleFeature = (key: FeatureKey, enabled: boolean) => {
    setDraftState((prev) => (prev ? { ...prev, [key]: enabled } : prev));
  };

  const handleResetToRoleDefaults = async () => {
    if (!editingUser) return;
    setIsSavingFeatures(true);
    setModalError(null);
    try {
      const res = await api.updateUserFeatures(editingUser.id, null);
      if (!res.success) {
        setModalError(res.message || 'Gagal mereset hak akses fitur.');
        return;
      }
      onRefreshUsers();
      onFeatureNotice?.(
        'success',
        `Hak akses fitur "@${editingUser.username}" dikembalikan ke bawaan peran ${getRoleDisplayLabel(editingUser.role)}.`
      );
      closeFeatureModal();
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, 'Gagal menghubungi server.'));
    } finally {
      setIsSavingFeatures(false);
    }
  };

  const handleSaveFeatures = async () => {
    if (!editingUser || !draftState) return;
    setIsSavingFeatures(true);
    setModalError(null);
    try {
      const defaults = getEffectiveFeaturePermissions(editingUser.role, null);
      const hasAnyDiff = FEATURE_CATALOG.some((def) => draftState[def.key] !== defaults[def.key]);
      const payload = hasAnyDiff ? { ...draftState } : null;

      const res = await api.updateUserFeatures(editingUser.id, payload);
      if (!res.success) {
        setModalError(res.message || 'Gagal menyimpan pengaturan fitur.');
        return;
      }
      onRefreshUsers();
      onFeatureNotice?.('success', `Pengaturan fitur akun "@${editingUser.username}" berhasil disimpan!`);
      closeFeatureModal();
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, 'Gagal menghubungi server.'));
    } finally {
      setIsSavingFeatures(false);
    }
  };

  const groupedCatalog = useMemo(() => {
    return FEATURE_CATEGORIES.map((category) => ({
      category,
      items: FEATURE_CATALOG.filter((f) => f.category === category)
    }));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            Daftar Seluruh Akun Pengguna Terdaftar
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isDeveloper
              ? 'Kelola akun pengguna serta aktif/nonaktifkan fitur per akun menggunakan slider ON/OFF.'
              : 'Admin hanya dapat mengelola akun Admin & Teknisi. Akun Developer dilindungi.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddUserClick}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ Tambah Akun</span>
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {isLoadingUsers ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Memuat data pengguna...
          </div>
        ) : usersList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada data pengguna.
          </div>
        ) : (
          usersList.map((u) => {
            const isSelf = currentUserId === u.id;
            const normRole = normalizeRole(u.role);
            const canManageTarget = isDeveloper || normRole !== 'developer';
            const customOverridesCount = Object.keys(parseFeaturePermissions(u.feature_permissions)).length;

            return (
              <div key={u.id} className="p-3.5 bg-white dark:bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-900 dark:text-white font-semibold">{u.name}</strong>
                    <span className="font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                      @{u.username}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded">
                        Anda
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      normRole === 'developer'
                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                        : normRole === 'admin'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {getRoleDisplayLabel(u.role)}
                    </span>
                    {normRole !== 'developer' && customOverridesCount > 0 && (
                      <span className="text-[10px] font-mono font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded">
                        Fitur Kustom
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{u.email}</span>
                    <span>&bull;</span>
                    <span>{u.department}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    u.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : u.status === 'PENDING_APPROVAL'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      : u.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {u.status === 'PENDING_APPROVAL' ? 'Menunggu Approval' : u.status}
                  </span>

                  {/* Developer-only per-account Feature Sliders button for non-developer users */}
                  {isDeveloper && normRole !== 'developer' && (
                    <button
                      type="button"
                      onClick={() => openFeatureModal(u)}
                      className="px-2.5 py-1 rounded bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                      title="Atur fitur yang dapat diakses akun ini (Developer Only)"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Atur Fitur</span>
                    </button>
                  )}

                  {canManageTarget && (
                    <>
                      {u.status === 'PENDING_APPROVAL' ? (
                        <button
                          type="button"
                          onClick={() => onApprove(u.id, u.username)}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] cursor-pointer"
                        >
                          Setujui
                        </button>
                      ) : !isSelf && (
                        <button
                          type="button"
                          onClick={() => onToggleStatus(u.id, u.status, u.username)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            u.status === 'ACTIVE'
                              ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200'
                              : 'bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onResetPassword(u.id, u.username)}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Reset Kata Sandi"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => onDeleteUser(u.id, u.username)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Developer-only Per-Account Feature Slider Modal */}
      {editingUser && draftState && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Atur Fitur Akun: {editingUser.name} (@{editingUser.username})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Peran Dasar: <strong>{getRoleDisplayLabel(editingUser.role)}</strong> &bull; Gunakan slider ON/OFF untuk mengizinkan atau membatasi fitur secara spesifik.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFeatureModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-5 mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Slider List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {groupedCatalog.map((group) => (
                <div key={group.category} className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                    {group.category}
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                    {group.items.map((item) => {
                      const isChecked = Boolean(draftState[item.key]);
                      return (
                        <div
                          key={item.key}
                          className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {item.label}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.description}
                            </div>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleToggleFeature(item.key, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                            <span className={`ml-2.5 font-mono text-[11px] font-bold w-8 ${
                              isChecked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {isChecked ? 'ON' : 'OFF'}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetToRoleDefaults}
                disabled={isSavingFeatures}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Bawaan Peran</span>
              </button>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeFeatureModal}
                  disabled={isSavingFeatures}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveFeatures}
                  disabled={isSavingFeatures}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSavingFeatures ? 'Menyimpan...' : 'Simpan Pengaturan Fitur'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

