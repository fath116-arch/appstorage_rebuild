/**
 * User Approvals Tab
 */

import React from 'react';
import { Clock, CheckCircle2, UserCheck, UserX } from 'lucide-react';
import { UserProfile } from '../../services/api';
import { getRoleDisplayLabel, normalizeRole } from '../../utils/permissions';

interface UserApprovalsTabProps {
  pendingUsers: UserProfile[];
  isDeveloper?: boolean;
  onRefresh: () => void;
  onApprove: (userId: string, username: string) => void;
  onReject: (userId: string, username: string) => void;
}

export const UserApprovalsTab: React.FC<UserApprovalsTabProps> = ({
  pendingUsers,
  isDeveloper = false,
  onRefresh,
  onApprove,
  onReject
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Permohonan Akun Menunggu Persetujuan</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isDeveloper
              ? 'Kelola persetujuan akun tertunda untuk seluruh peran.'
              : 'Peran Admin dapat menyetujui atau menolak akun Admin & Teknisi yang berstatus menunggu.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          Segarkan Data
        </button>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="p-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tidak ada permohonan akun yang menunggu persetujuan.
          </div>
          <div className="text-[11px] text-slate-400">
            Semua permohonan akun telah diproses.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((u) => {
            const normRole = normalizeRole(u.role);
            const canProcess = isDeveloper || normRole !== 'developer';
            return (
              <div
                key={u.id}
                className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-900 dark:text-white font-semibold">{u.name}</strong>
                    <span className="font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[11px]">
                      @{u.username}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      normRole === 'developer'
                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                        : normRole === 'admin'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      Peran: {getRoleDisplayLabel(u.role)}
                    </span>
                    <span className="bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 font-bold px-2 py-0.5 rounded text-[10px]">
                      Menunggu Persetujuan
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                    <span>Email: {u.email}</span>
                    <span>&bull;</span>
                    <span>Divisi: {u.department || 'IT Operations'}</span>
                    {u.created_at && (
                      <>
                        <span>&bull;</span>
                        <span>Daftar: {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                </div>

                {canProcess ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApprove(u.id, u.username)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Setujui Akun</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(u.id, u.username)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Tolak</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">Khusus Developer</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

