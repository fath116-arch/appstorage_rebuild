/**
 * User Activity Logs Tab (Inside Kelola User Card)
 * Menampilkan log login, logout, keamanan sesi, dan manajemen akun user
 * secara terpisah dari Riwayat Barang Masuk & Barang Keluar.
 * Akses: Admin & Developer yang memiliki izin users_manage.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  KeyRound,
  LogIn,
  LogOut,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Sliders
} from 'lucide-react';
import { api, UserActivityCategory, UserActivityLogEntry } from '../../services/api';
import { formatWibDateTime } from '../../utils/timezone';
import { getRoleDisplayLabel } from '../../utils/permissions';
import { getErrorMessage } from '../../utils/errorUtils';

interface UserActivityLogsTabProps {
  refreshTrigger?: number;
}

interface ActionMeta {
  label: string;
  toneClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTION_META_MAP: Record<string, ActionMeta> = {
  login: {
    label: 'Login Masuk',
    toneClass: 'text-emerald-700 dark:text-emerald-400',
    icon: LogIn
  },
  logout: {
    label: 'Logout Keluar',
    toneClass: 'text-slate-600 dark:text-slate-300',
    icon: LogOut
  },
  cabut_sesi_otomatis: {
    label: 'Cabut Sesi Otomatis',
    toneClass: 'text-amber-700 dark:text-amber-400',
    icon: ShieldAlert
  },
  deteksi_token_reuse: {
    label: 'Anomali Token Reuse',
    toneClass: 'text-rose-700 dark:text-rose-400',
    icon: AlertTriangle
  },
  cabut_seluruh_sesi_admin: {
    label: 'Cabut Sesi Admin',
    toneClass: 'text-amber-700 dark:text-amber-400',
    icon: ShieldAlert
  },
  buat_akun: {
    label: 'Buat Akun Baru',
    toneClass: 'text-emerald-700 dark:text-emerald-400',
    icon: UserPlus
  },
  setujui_akun: {
    label: 'Setujui Akun',
    toneClass: 'text-emerald-700 dark:text-emerald-400',
    icon: UserCheck
  },
  tolak_akun: {
    label: 'Tolak Akun',
    toneClass: 'text-rose-700 dark:text-rose-400',
    icon: UserX
  },
  ubah_status_akun: {
    label: 'Ubah Status Akun',
    toneClass: 'text-amber-700 dark:text-amber-400',
    icon: Activity
  },
  ubah_akses_fitur: {
    label: 'Atur Akses Fitur',
    toneClass: 'text-blue-700 dark:text-blue-400',
    icon: Sliders
  },
  reset_sandi: {
    label: 'Reset Kata Sandi',
    toneClass: 'text-amber-700 dark:text-amber-400',
    icon: KeyRound
  },
  hapus_akun: {
    label: 'Hapus Akun',
    toneClass: 'text-rose-700 dark:text-rose-400',
    icon: UserMinus
  }
};

const CATEGORY_TABS: Array<{ id: UserActivityCategory; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'auth', label: 'Login & Logout' },
  { id: 'session', label: 'Keamanan Sesi' },
  { id: 'account', label: 'Manajemen Akun' }
];

export const UserActivityLogsTab: React.FC<UserActivityLogsTabProps> = ({ refreshTrigger = 0 }) => {
  const [logs, setLogs] = useState<UserActivityLogEntry[]>([]);
  const [category, setCategory] = useState<UserActivityCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const items = await api.getUserActivityLogs({
        category,
        limit: 200
      });
      setLogs(items);
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, 'Gagal memuat log aktivitas pengguna.'));
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, refreshTrigger]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((item) => {
      const hay = [
        item.id_aktivitas,
        item.aksi,
        item.actor_nama || item.nama_pelaku || '',
        item.username_pelaku || '',
        item.catatan || ''
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, searchQuery]);

  const summaryCounts = useMemo(() => {
    let authCount = 0;
    let sessionCount = 0;
    let accountCount = 0;
    for (const item of logs) {
      if (item.category === 'auth') authCount++;
      else if (item.category === 'session') sessionCount++;
      else accountCount++;
    }
    return {
      total: logs.length,
      authCount,
      sessionCount,
      accountCount
    };
  }, [logs]);

  return (
    <div className="space-y-4">
      {/* Header & Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700/80">
        <div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            Log Aktivitas User, Sesi &amp; Manajemen Akun
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Terpisah dari Riwayat Barang Masuk &amp; Barang Keluar · Zona Waktu WIB (Asia/Jakarta)
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums flex-wrap">
          <span>
            Total: <strong className="text-slate-900 dark:text-white">{summaryCounts.total}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            Auth: <strong className="text-emerald-700 dark:text-emerald-400">{summaryCounts.authCount}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            Sesi: <strong className="text-amber-700 dark:text-amber-400">{summaryCounts.sessionCount}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            Akun: <strong className="text-blue-700 dark:text-blue-400">{summaryCounts.accountCount}</strong>
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, @username, ID AKT-..., IP, atau catatan..."
            className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs px-1 cursor-pointer"
              aria-label="Hapus pencarian"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs border border-slate-200/70 dark:border-slate-800">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  category === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Muat ulang log aktivitas user"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-semibold hover:bg-rose-700 shrink-0 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Table / List */}
      <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
        {isLoading && logs.length === 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="px-4 py-3 flex items-center justify-between gap-4 animate-pulse">
                <div className="space-y-1.5 w-36">
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-28" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded w-20" />
                </div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-28" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded flex-1" />
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2.5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {searchQuery || category !== 'all'
                ? 'Tidak ada log aktivitas user yang sesuai dengan filter pencarian.'
                : 'Belum ada aktivitas login, logout, sesi, atau manajemen akun yang tercatat.'}
            </p>
            {(searchQuery || category !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategory('all');
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[52vh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                <tr>
                  <th className="py-2.5 px-4 whitespace-nowrap">Waktu (WIB)</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Aktivitas</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Pelaku / User</th>
                  <th className="py-2.5 px-4">Rincian &amp; Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.map((log) => {
                  const meta = ACTION_META_MAP[log.aksi] || {
                    label: log.aksi.replace(/_/g, ' '),
                    toneClass: 'text-slate-700 dark:text-slate-300',
                    icon: Activity
                  };
                  const Icon = meta.icon;
                  const actorName = log.actor_nama || log.nama_pelaku || log.pelaku_id;

                  return (
                    <tr
                      key={log.id_aktivitas || log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors align-top"
                    >
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-300">
                        <div>{formatWibDateTime(log.occurred_at || log.waktu)}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {log.id_aktivitas}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${meta.toneClass}`}>
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {actorName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          {log.username_pelaku && (
                            <span className="font-mono">@{log.username_pelaku}</span>
                          )}
                          {log.username_pelaku && log.role_pelaku && <span aria-hidden="true">·</span>}
                          {log.role_pelaku && (
                            <span>{getRoleDisplayLabel(log.role_pelaku)}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 leading-relaxed min-w-[240px]">
                        {log.catatan || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
