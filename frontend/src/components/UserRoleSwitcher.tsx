/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, UserProfile } from '../services/api';
import { getRoleDisplayLabel, isDeveloperRole, isFeatureEnabled, normalizeRole } from '../utils/permissions';
import { getErrorMessage } from '../utils/errorUtils';
import { RoleMatrixTab } from './users/RoleMatrixTab';
import { UserApprovalsTab } from './users/UserApprovalsTab';
import { UserManagementTab } from './users/UserManagementTab';
import { CreateUserTab } from './users/CreateUserTab';
import { UserActivityLogsTab } from './users/UserActivityLogsTab';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Server,
  LogOut,
  UserPlus,
  Users,
  AlertCircle,
  Code2,
  Clock,
  Activity
} from 'lucide-react';

interface UserRoleSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export const UserRoleSwitcher: React.FC<UserRoleSwitcherProps> = ({
  isOpen,
  onClose,
  embedded = false
}) => {
  const { user, logout } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'matrix' | 'approvals' | 'users' | 'add' | 'logs'>('matrix');
  const [logsRefreshCounter, setLogsRefreshCounter] = useState(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: 'reject' | 'delete' | 'reset-password';
    userId: string;
    username: string;
  } | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  const isDeveloper = isDeveloperRole(user?.role);
  const hasAdminAccess = isFeatureEnabled(user, 'users_manage');

  const showNotice = useCallback((type: 'error' | 'success', text: string) => {
    setActionNotice({ type, text });
    setTimeout(() => setActionNotice(null), 4000);
  }, []);

  const loadUsers = useCallback(() => {
    if (!hasAdminAccess) return;
    setIsLoadingUsers(true);
    api.getUsers()
      .then(res => setUsersList(res))
      .catch(() => {})
      .finally(() => setIsLoadingUsers(false));
    setLogsRefreshCounter((c) => c + 1);
  }, [hasAdminAccess]);

  useEffect(() => {
    if ((embedded || isOpen) && hasAdminAccess) {
      loadUsers();
    }
  }, [embedded, isOpen, hasAdminAccess, loadUsers]);

  if (!embedded && !isOpen) return null;

  const pendingUsers = usersList.filter(u => u.status === 'PENDING_APPROVAL');

  const handleApprove = async (userId: string, username: string) => {
    try {
      const res = await api.approveUser(userId);
      if (res.success) {
        showNotice('success', `Akun "${username}" telah disetujui dan kini AKTIF.`);
        loadUsers();
      } else {
        showNotice('error', res.message || 'Gagal menyetujui akun.');
      }
    } catch (err: unknown) {
      showNotice('error', getErrorMessage(err, 'Gagal menyetujui akun.'));
    }
  };

  const handleReject = async (userId: string, username: string) => {
    setPendingAction({ type: 'reject', userId, username });
  };

  const handleToggleStatus = async (userId: string, currentStatus: string, username: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await api.updateUserStatus(userId, nextStatus);
      if (res.success) {
        showNotice('success', `Status akun "${username}" berhasil diubah menjadi ${nextStatus}.`);
        loadUsers();
      } else {
        showNotice('error', res.message || 'Gagal mengubah status akun.');
      }
    } catch (err: unknown) {
      showNotice('error', getErrorMessage(err, 'Gagal mengubah status.'));
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    setPendingAction({ type: 'delete', userId, username });
  };

  const handleAdminResetPassword = async (userId: string, username: string) => {
    setResetPasswordValue('');
    setPendingAction({ type: 'reset-password', userId, username });
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    const { type, userId, username } = pendingAction;
    try {
      if (type === 'reject') {
        const res = await api.rejectUser(userId);
        if (res.success) {
          showNotice('success', `Pendaftaran akun "${username}" telah DITOLAK.`);
          loadUsers();
        } else {
          showNotice('error', res.message || 'Gagal menolak akun.');
        }
      } else if (type === 'delete') {
        const res = await api.deleteUser(userId);
        if (res.success) {
          showNotice('success', `Akun "${username}" berhasil dihapus secara permanen.`);
          loadUsers();
        } else {
          showNotice('error', res.message || 'Gagal menghapus akun.');
        }
      } else if (type === 'reset-password') {
        if (!resetPasswordValue.trim()) {
          showNotice('error', 'Kata sandi baru tidak boleh kosong.');
          return;
        }
        const res = await api.adminResetPassword(userId, resetPasswordValue.trim());
        if (res.success) {
          showNotice('success', `Kata sandi akun "@${username}" berhasil direset.`);
        } else {
          showNotice('error', res.message || 'Gagal mereset kata sandi.');
        }
      }
    } catch (err: unknown) {
      showNotice('error', getErrorMessage(err, 'Gagal memproses aksi akun.'));
    } finally {
      setPendingAction(null);
      setResetPasswordValue('');
    }
  };

  const innerCard = (
    <div className={embedded
      ? 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full overflow-hidden'
      : 'bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95'
    }>

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-100 border border-slate-200 dark:border-slate-300/50 flex items-center justify-center p-1 shadow-xs overflow-hidden shrink-0">
            <img src="/logo.webp" alt="FieldOps IT Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
                Manajemen Akun, Peran &amp; Persetujuan
              </h3>
              <span className="text-[10px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-800">
                Server RBAC
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isDeveloper
                ? 'Kelola semua akun, persetujuan, dan aktif/nonaktifkan fitur per akun.'
                : 'Pembuatan dan persetujuan akun Admin & Teknisi dikelola di sini.'}
            </p>
          </div>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Inline Confirmation / Reset Password Banner */}
      {pendingAction && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
          <div className="font-semibold text-amber-900 dark:text-amber-200">
            {pendingAction.type === 'reject' && `Konfirmasi tolak pendaftaran akun "@${pendingAction.username}"?`}
            {pendingAction.type === 'delete' && `Konfirmasi hapus permanen akun "@${pendingAction.username}"? Tindakan ini tidak dapat dibatalkan.`}
            {pendingAction.type === 'reset-password' && `Masukkan kata sandi baru untuk akun "@${pendingAction.username}":`}
          </div>
          {pendingAction.type === 'reset-password' && (
            <input
              type="password"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              placeholder="Kata sandi baru..."
              className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmPendingAction}
              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white font-semibold hover:bg-slate-800"
            >
              Konfirmasi
            </button>
            <button
              type="button"
              onClick={() => { setPendingAction(null); setResetPasswordValue(''); }}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Action Notice */}
      {actionNotice && (
        <div className={`mx-6 mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
          actionNotice.type === 'error'
            ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
        }`}>
          {actionNotice.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{actionNotice.text}</span>
        </div>
      )}

        {/* Current Active Session Info */}
        {user && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm text-white ${
                normalizeRole(user.role) === 'developer' ? 'bg-cyan-600' : normalizeRole(user.role) === 'admin' ? 'bg-emerald-600' : 'bg-blue-600'
              }`}>
                {normalizeRole(user.role) === 'developer' ? <Code2 className="w-5 h-5" /> : user.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{user.name}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    @{user.username}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    normalizeRole(user.role) === 'developer'
                      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                      : normalizeRole(user.role) === 'admin'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                  }`}>
                    {getRoleDisplayLabel(user.role)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                  <span>Divisi: <strong>{user.department}</strong></span>
                  <span>Status: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{user.status}</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                logout();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout Sesi</span>
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 pt-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'matrix'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Matriks Hak Akses</span>
          </button>

          {hasAdminAccess && (
            <>
              <button
                onClick={() => setActiveTab('approvals')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'approvals'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Persetujuan Akun</span>
                {pendingUsers.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                    {pendingUsers.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'users'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Daftar Pengguna ({usersList.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('add')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'add'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Buat Akun Server</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'logs'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Log Aktivitas User</span>
              </button>
            </>
          )}
        </div>

        {/* Content Body */}
        <div className={embedded ? 'p-6 space-y-6' : 'p-6 max-h-[58vh] overflow-y-auto space-y-6'}>
          {activeTab === 'matrix' && (
            <RoleMatrixTab currentUserRole={user?.role} />
          )}

          {activeTab === 'approvals' && (
            <UserApprovalsTab
              pendingUsers={pendingUsers}
              isDeveloper={isDeveloper}
              onRefresh={loadUsers}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementTab
              currentUserId={user?.id}
              isDeveloper={isDeveloper}
              usersList={usersList}
              isLoadingUsers={isLoadingUsers}
              onAddUserClick={() => setActiveTab('add')}
              onApprove={handleApprove}
              onToggleStatus={handleToggleStatus}
              onResetPassword={handleAdminResetPassword}
              onDeleteUser={handleDeleteUser}
              onRefreshUsers={loadUsers}
              onFeatureNotice={showNotice}
            />
          )}

          {activeTab === 'add' && (
            <CreateUserTab
              isDeveloper={isDeveloper}
              onUserCreated={() => {
                loadUsers();
                setTimeout(() => setActiveTab('users'), 1000);
              }}
            />
          )}

          {activeTab === 'logs' && hasAdminAccess && (
            <UserActivityLogsTab refreshTrigger={logsRefreshCounter} />
          )}
        </div>

        {!embedded && (
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" />
              <span>Satu Kantor Tunggal &bull; MariaDB 11.x Server</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-700 hover:bg-slate-800 transition-colors font-medium cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}
    </div>
  );

  if (embedded) {
    return innerCard;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {innerCard}
    </div>
  );
};
