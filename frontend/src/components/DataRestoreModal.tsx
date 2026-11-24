/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { isAdminOrDev, isFeatureEnabled } from '../utils/permissions';
import { 
  RotateCcw, 
  X, 
  Database, 
  HardDrive, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Download,
  Server
} from 'lucide-react';

import { getAuthHeaders } from '../services/httpClient';

interface DataRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  embedded?: boolean;
}

export const DataRestoreModal: React.FC<DataRestoreModalProps> = ({ isOpen, onClose, embedded = false }) => {
  const { showToast } = useInventory();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const downloadUrl = '/api/backup/inventory/download';

  const isAuthorized = isFeatureEnabled(user, 'setup_database') || isAdminOrDev(user?.role) || Boolean(user?.is_master_admin);

  if (!embedded && !isOpen) return null;

  const handleDownloadBackup = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(downloadUrl, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error('Gagal mengunduh file cadangan inventaris.');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      link.download = match ? match[1] : `backup_inventory_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      showToast('File cadangan inventaris (.json) berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengunduh file cadangan.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const innerContent = (
    <div className={embedded
      ? 'w-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-200'
      : 'relative w-full max-w-2xl flex flex-col glass rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800/80 overflow-hidden text-slate-800 dark:text-slate-200'
    }>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/60 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-display">
                  Backup Data &amp; Pemulihan Server
                </h2>
                <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  MariaDB 11.x
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pengelolaan cadangan data barang, mutasi stok, dan kategori terisolasi tanpa akun pengguna.
              </p>
            </div>
          </div>

          {!embedded && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {!isAuthorized ? (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 space-y-3 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">Hak Akses Terbatas</h3>
                <p className="text-xs mt-1 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                  Operasi backup dan pemulihan data hanya dapat diakses oleh peran <strong>Developer</strong> atau <strong>Admin</strong> yang berwenang.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Option 1: Download Server Backup */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">Unduh Cadangan Inventaris (JSON)</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Mengekspor data barang master, kategori, dan transaksi aktif secara terisolasi tanpa data sensitif akun.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadBackup}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>{isLoading ? 'Menyiapkan File...' : 'Unduh File Backup Terkini'}</span>
                </button>
              </div>

              {/* Option 2: Isolated Data Notice */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Aturan Pemulihan Server &amp; Hashing PBKDF2</span>
                </div>
                <p className="leading-relaxed">
                  File cadangan ini sesuai dengan prinsip invarian sistem: data inventaris (barang, transaksi, kategori) dan akun pengguna disimpan dalam 2 file yang sepenuhnya terpisah.
                </p>
              </div>
            </>
          )}
        </div>

        {!embedded && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-700 text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
  );

  if (embedded) {
    return innerContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      {innerContent}
    </div>
  );
};
