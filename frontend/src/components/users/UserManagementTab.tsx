/**
 * Registered Users Management Tab
 */

import React from 'react';
import { UserPlus, KeyRound, Trash2 } from 'lucide-react';
import { UserProfile } from '../../services/api';

interface UserManagementTabProps {
  currentUserId?: string;
  usersList: UserProfile[];
  isLoadingUsers: boolean;
  onAddUserClick: () => void;
  onApprove: (userId: string, username: string) => void;
  onToggleStatus: (userId: string, currentStatus: string, username: string) => void;
  onResetPassword: (userId: string, username: string) => void;
  onDeleteUser: (userId: string, username: string) => void;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({
  currentUserId,
  usersList,
  isLoadingUsers,
  onAddUserClick,
  onApprove,
  onToggleStatus,
  onResetPassword,
  onDeleteUser
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            Daftar Seluruh Akun Pengguna Terdaftar
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola status akses (Aktif / Nonaktif) dan hak akses pengguna.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddUserClick}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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
            return (
              <div key={u.id} className="p-3.5 bg-white dark:bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 dark:text-white font-semibold">{u.name}</strong>
                    <span className="font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                      @{u.username}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded">
                        Anda
                      </span>
                    )}
                    <span className={`capitalize px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.role === 'developer'
                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                        : u.role === 'admin'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : u.role === 'supervisor'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{u.email}</span>
                    <span>&bull;</span>
                    <span>{u.department}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
