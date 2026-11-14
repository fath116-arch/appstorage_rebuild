/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, UserProfile } from '../services/api';
import { isAdminOrDev, isDeveloperRole } from '../utils/permissions';
import { getErrorMessage } from '../utils/errorUtils';
import { RoleMatrixTab } from './users/RoleMatrixTab';
import { UserApprovalsTab } from './users/UserApprovalsTab';
import { UserManagementTab } from './users/UserManagementTab';
import { CreateUserTab } from './users/CreateUserTab';
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
  Clock
} from 'lucide-react';

interface UserRoleSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserRoleSwitcher: React.FC<UserRoleSwitcherProps> = ({
  isOpen,
  onClose
}) => {
  const { user, logout } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'matrix' | 'approvals' | 'users' | 'add'>('matrix');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isDeveloper = isDeveloperRole(user?.role);
  const hasAdminAccess = isAdminOrDev(user?.role);

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
  }, [hasAdminAccess]);

  useEffect(() => {
    if (isOpen && hasAdminAccess) {
      loadUsers();
    }
  }, [isOpen, hasAdminAccess, loadUsers]);

  if (!isOpen) return null;

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
    if (!window.confirm(`Yakin ingin menolak pendaftaran akun "${username}"?`)) return;
    try {
      const res = await api.rejectUser(userId);
      if (res.success) {
        showNotice('success', `Pendaftaran akun "${username}" telah DITOLAK.`);
        loadUsers();
      } else {
        showNotice('error', res.message || 'Gagal menolak akun.');
      }
    } catch (err: unknown) {
      showNotice('error', getErrorMessage(err, 'Gagal menolak akun.'));
    }
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
    if (!window.confirm(`Hapus permanen akun "${username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await api.deleteUser(userId);
      if (res.success) {
        showNotice('success', `Akun "${username}" berhasil dihapus secara permanen.`);
        loadUsers();
      } else {
        showNotice('error', res.message || 'Gagal menghapus akun.');
      }
    } catch (err: unknown) {
      showNotice('error', getErrorMessage(err, 'Gagal menghapus akun.'));
    }
  };

  const handleAdminResetPassword = async (userId: string, username: string) => {
    const pass = window.prompt(`Masukkan Kata Sandi Baru untuk akun "@${username}":`);
    if (!pass || pass.trim().length === 0) return;
    try {
      const res = await api.adminResetPassword(userId, pass.trim());
      if (res.success) {
        showNotice('success', `Kata sandi akun "@${username}" berhasil direset.`);
      } else {
        showNotice('error', res.message || 'Gagal mereset kata sandi.');
      }
    } catch (err: unknown) {
      showNotice('error', getErrorMessage(err, 'Gagal mereset kata sandi.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95">

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
                <span className="text-[10px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-300 dark:border-cyan-800">
                  Developer &amp; Admin Full Access
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Persetujuan akun di bawah Admin dikelola langsung di sini.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                user.role === 'developer' ? 'bg-cyan-600' : user.role === 'admin' ? 'bg-emerald-600' : user.role === 'supervisor' ? 'bg-purple-600' : 'bg-blue-600'
              }`}>
                {user.role === 'developer' ? <Code2 className="w-5 h-5" /> : user.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{user.name}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    @{user.username}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    user.role === 'developer'
                      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                      : user.role === 'admin'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300'
                  }`}>
                    {user.role} (Full Access)
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
            </>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[58vh] overflow-y-auto space-y-6">
          {activeTab === 'matrix' && (
            <RoleMatrixTab currentUserRole={user?.role} />
          )}

          {activeTab === 'approvals' && (
            <UserApprovalsTab
              pendingUsers={pendingUsers}
              onRefresh={loadUsers}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementTab
              currentUserId={user?.id}
              usersList={usersList}
              isLoadingUsers={isLoadingUsers}
              onAddUserClick={() => setActiveTab('add')}
              onApprove={handleApprove}
              onToggleStatus={handleToggleStatus}
              onResetPassword={handleAdminResetPassword}
              onDeleteUser={handleDeleteUser}
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
        </div>

        {/* Footer */}
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
      </div>
    </div>
  );
};
