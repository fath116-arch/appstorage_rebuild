/**
 * Database Configuration (.env + Live Ping + Pool Reload) & Backup Panel
 * Rendered full-width inside the Setting tab (Developer & Admin only)
 */

import React, { useEffect, useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  Terminal
} from 'lucide-react';
import {
  DbConnectionTestResult,
  SystemMaskedSettings,
  setupApi
} from '../../services/setupApi';
import { DataRestoreModal } from '../DataRestoreModal';
import { useToast } from '../../context/ToastContext';

interface DatabaseSetupPanelProps {
  settings: SystemMaskedSettings | null;
  onUpdated: () => Promise<void>;
}

export const DatabaseSetupPanel: React.FC<DatabaseSetupPanelProps> = ({
  settings,
  onUpdated
}) => {
  const { showToast } = useToast();

  const [host, setHost] = useState(settings?.database.host || 'localhost');
  const [port, setPort] = useState(String(settings?.database.port || 3306));
  const [dbName, setDbName] = useState(settings?.database.name || 'fieldops_inventory');
  const [dbUser, setDbUser] = useState(settings?.database.user || 'fieldops_user');
  const [password, setPassword] = useState('');
  const [rootPassword, setRootPassword] = useState('');
  const [reloadPool, setReloadPool] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<DbConnectionTestResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setHost(settings.database.host);
      setPort(String(settings.database.port));
      setDbName(settings.database.name);
      setDbUser(settings.database.user);
    }
  }, [settings]);

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await setupApi.saveAndTestDatabase({
        host: host.trim(),
        port,
        name: dbName.trim(),
        user: dbUser.trim(),
        password: password || undefined,
        rootPassword: rootPassword || undefined,
        reloadPool
      });

      const payload = res.data;
      if (payload?.result?.testResult) {
        setTestResult(payload.result.testResult);
      }

      if (payload?.success) {
        setStatusMessage({ ok: true, text: payload.message });
        setPassword('');
        setRootPassword('');
        showToast(payload.message, 'success');
      } else {
        setStatusMessage({ ok: false, text: payload?.message || 'Koneksi ke MariaDB gagal.' });
        showToast(payload?.message || 'Koneksi ke MariaDB gagal.', 'warning');
      }
      await onUpdated();
    } catch {
      setStatusMessage({ ok: false, text: 'Gagal menyimpan atau menguji koneksi database.' });
      showToast('Gagal menyimpan atau menguji koneksi database.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSaveAndTest}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Konfigurasi Koneksi MariaDB (.env)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Simpan parameter database ke berkas .env lokal, uji koneksi langsung, dan muat ulang pool aktif server.
              </p>
            </div>
          </div>

          <div className="text-xs font-mono tabular-nums text-right">
            <div className={settings?.database.runtimeActiveMariaDb ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
              {settings?.database.runtimeActiveMariaDb ? '● Pool MariaDB Aktif' : '● Mode Memori Lokal (Fallback)'}
            </div>
            <div className="text-[11px] text-slate-400">
              CLI: npm run setup:db
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Host MariaDB (<code className="font-mono">DB_HOST</code>)
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="localhost atau mariadb"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Port (<code className="font-mono">DB_PORT</code>)
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="3306"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Database (<code className="font-mono">DB_NAME</code>)
            </label>
            <input
              type="text"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="fieldops_inventory"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Username (<code className="font-mono">DB_USER</code>)
            </label>
            <input
              type="text"
              value={dbUser}
              onChange={(e) => setDbUser(e.target.value)}
              placeholder="fieldops_user"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password User (<code className="font-mono">DB_PASSWORD</code>)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={settings?.database.password.hasValue ? `Tersimpan (${settings.database.password.masked})` : 'Masukkan password baru...'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Kosongkan untuk mempertahankan password tersimpan.
            </span>
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password Root Docker (<code className="font-mono">DB_ROOT_PASSWORD</code>, Opsional)
            </label>
            <input
              type="password"
              value={rootPassword}
              onChange={(e) => setRootPassword(e.target.value)}
              placeholder={settings?.database.rootPassword.hasValue ? `Tersimpan (${settings.database.rootPassword.masked})` : 'Opsional untuk container MariaDB'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={reloadPool}
              onChange={(e) => setReloadPool(e.target.checked)}
              className="rounded text-emerald-600"
            />
            <span>Muat ulang pool koneksi runtime &amp; jalankan migrasi jika terhubung</span>
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Menyimpan & Menguji...' : 'Simpan ke .env & Uji Koneksi'}</span>
          </button>
        </div>

        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              statusMessage.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}
          >
            {statusMessage.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-semibold">{statusMessage.text}</div>
              {testResult && testResult.connected && (
                <div className="font-mono text-[11px] opacity-90 tabular-nums">
                  Server: {testResult.serverVersion || 'MariaDB'} · Latency: {testResult.latencyMs} ms · Tabel: {testResult.tableCount} · Skema Inti: {testResult.hasCoreTables ? 'Lengkap' : `Belum lengkap (${testResult.missingCoreTables.join(', ')})`}
                </div>
              )}
              {!statusMessage.ok && (
                <div className="text-[11px] flex items-center gap-1.5 opacity-90">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Alternatif terminal: <code className="font-mono">npm run setup:db</code></span>
                </div>
              )}
            </div>
          </div>
        )}
      </form>

      {/* Embedded Inventory Backup & Restore */}
      <DataRestoreModal embedded isOpen onClose={() => {}} />
    </div>
  );
};
