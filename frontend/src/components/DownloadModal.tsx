/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { downloadProjectZip, downloadJsonBackup } from '../utils/projectDownloader';
import { 
  X, 
  Download, 
  FileCode, 
  Database, 
  CheckCircle2, 
  Terminal, 
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import { useAuth } from '../context/AuthContext';

export const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { 
    products, 
    jenisList, 
    transactions, 
    showToast,
  } = useInventory();
  const [isZipping, setIsZipping] = useState(false);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      showToast('Sedang membundel seluruh source code proyek...', 'info');
      await downloadProjectZip({
        products,
        jenisList,
        transactions,
        currentUser: user
      });
      showToast('File ZIP source code berhasil diunduh!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membundel file zip', 'error');
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadBackup = () => {
    downloadJsonBackup({
      products,
      jenisList,
      transactions,
      currentUser: user
    });
    showToast('File backup database JSON berhasil diunduh!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Download Source Code & Data Aplikasi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unduh paket lengkap proyek untuk dijalankan di laptop atau server lokal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          {/* Option 1: Full Source Code ZIP */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Paket Lengkap Source Code (.ZIP)
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px] leading-relaxed">
                    Berisi semua komponen React 19, TypeScript, Tailwind CSS, konfigurasi Vite, dokumentasi API, dan script siap jalan.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                fieldops-it-inventory.zip
              </span>
              <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 disabled:bg-slate-400 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isZipping ? 'Membundel...' : 'Download Source Code (.ZIP)'}</span>
              </button>
            </div>
          </div>

          {/* Option 2: Database Backup JSON */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Backup Data Suku Cadang & Mutasi (.JSON)
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px] leading-relaxed">
                    Data terkini: {products.length} produk katalog, {transactions.length} riwayat mutasi masuk/keluar, dan log integrasi tiket saat ini.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                data-backup.json
              </span>
              <button
                onClick={handleDownloadBackup}
                className="px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Data Backup (.JSON)</span>
              </button>
            </div>
          </div>

          {/* Option 3: Automated Server Backend Daily Backup (Express 5) */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 hover:border-blue-300 transition-all shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Scheduled Daily Backup (Express 5 Backend)</span>
                    <span className="font-mono text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">Otomatis 24 Jam</span>
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5 text-[11px] leading-relaxed">
                    Backup snapshot harian terjadwal di sisi server backend Express 5. Mengunduh data lengkap database Firestore langsung dari server backend.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                /api/backup/download
              </span>
              <button
                onClick={async () => {
                  try {
                    showToast('Mengunduh backup snapshot otomatis dari Express 5 Backend...', 'info');
                    window.open('/api/backup/download', '_blank');
                    showToast('Backup server berhasil diunduh!', 'success');
                  } catch (err) {
                    showToast('Gagal mengunduh backup dari server', 'error');
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Server Backup (JSON)</span>
              </button>
            </div>
          </div>

          {/* How to run locally instructions */}
          <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>Panduan Menjalankan di Komputer / Server Lokal:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>Ekstrak file <code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono">.zip</code> ke folder di komputer Anda.</li>
              <li>Buka terminal di folder tersebut lalu install dependensi:
                <pre className="mt-1 p-2 bg-slate-900 text-emerald-400 rounded font-mono text-[11px]">npm install</pre>
              </li>
              <li>Jalankan server aplikasi:
                <pre className="mt-1 p-2 bg-slate-900 text-emerald-400 rounded font-mono text-[11px]">npm run dev</pre>
              </li>
              <li>Buka browser di alamat: <code className="font-mono text-slate-800 dark:text-slate-200 font-bold">http://localhost:3000</code>.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
