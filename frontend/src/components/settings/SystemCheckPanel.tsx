/**
 * System Connection Diagnostics & CLI Scripts Panel
 * Rendered full-width inside the Setting tab (Developer & Admin only)
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Terminal,
  Copy,
  Check,
  Globe,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  CliScriptEntry,
  LoginDiagnosticResult,
  SystemCheckReport,
  SystemMaskedSettings,
  setupApi
} from '../../services/setupApi';
import { useToast } from '../../context/ToastContext';

interface SystemCheckPanelProps {
  settings: SystemMaskedSettings | null;
  report: SystemCheckReport | null;
  cliScripts: CliScriptEntry[];
  isChecking: boolean;
  onRunCheck: (publicUrl?: string) => Promise<void>;
}

export const SystemCheckPanel: React.FC<SystemCheckPanelProps> = ({
  settings,
  report,
  cliScripts,
  isChecking,
  onRunCheck
}) => {
  const { showToast } = useToast();
  const [publicUrlInput, setPublicUrlInput] = useState(settings?.tunnel.publicUrl || '');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [testUsername, setTestUsername] = useState('developer');
  const [testPassword, setTestPassword] = useState('');
  const [showTestPassword, setShowTestPassword] = useState(false);
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [loginDiag, setLoginDiag] = useState<LoginDiagnosticResult | null>(null);

  const handleRunLoginDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = testUsername.trim();
    if (!cleanUsername) {
      showToast('Masukkan username yang ingin diuji.', 'error');
      return;
    }
    setIsTestingLogin(true);
    try {
      const res = await setupApi.testLogin({
        username: cleanUsername,
        password: testPassword !== '' ? testPassword : undefined
      });
      setLoginDiag(res.diagnostic);
      showToast(
        res.diagnostic.overallSuccess
          ? `Diagnostik login "${cleanUsername}" lulus seluruh tahapan.`
          : `Diagnostik login "${cleanUsername}" menemukan kendala yang perlu ditindaklanjuti.`,
        res.diagnostic.overallSuccess ? 'success' : 'error'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menjalankan diagnostik login.';
      showToast(msg, 'error');
    } finally {
      setIsTestingLogin(false);
    }
  };

  const handleCopyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      showToast(`Perintah "${cmd}" disalin ke clipboard.`, 'success');
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch {
      showToast('Gagal menyalin perintah.', 'error');
    }
  };

  const getStatusBadge = (status: 'connected' | 'warning' | 'unconfigured') => {
    if (status === 'connected') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Terhubung</span>
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Perhatian</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
        <XCircle className="w-4 h-4 shrink-0" />
        <span>Belum Diatur</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Live Diagnostics Trigger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Pemeriksaan Koneksi &amp; Kesiapan Sistem
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Menguji berkas lingkungan .env, MariaDB live ping, akun Admin aktif, Gateway WhatsApp, dan Cloudflare Tunnel.
            </p>
            {settings?.envSourceSummary && (
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-1">
                Sumber .env: {settings.envSourceSummary}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onRunCheck(publicUrlInput.trim() || undefined)}
            disabled={isChecking}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Memeriksa Koneksi...' : 'Cek Semua Koneksi'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 items-end">
          <div className="sm:col-span-8">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Uji Jangkauan URL Publik Cloudflare Tunnel (Opsional)
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={publicUrlInput}
                onChange={(e) => setPublicUrlInput(e.target.value)}
                placeholder="https://stok.domainanda.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>
          <div className="sm:col-span-4 flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums py-2">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {report?.checkedAt
                  ? `Terakhir dicek: ${new Date(report.checkedAt).toLocaleTimeString('id-ID')}`
                  : 'Belum dicek'}
              </span>
            </span>
          </div>
        </div>

        {/* Diagnostics Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-4">Komponen Sistem</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Ringkasan &amp; Detail</th>
                <th className="py-2.5 px-4 text-right">Perintah CLI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(report?.checks || []).map((item) => (
                <tr key={item.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 align-top">
                    {item.label}
                  </td>
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    {getStatusBadge(item.status)}
                    {item.latencyMs !== undefined && (
                      <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                        {item.latencyMs} ms
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 align-top space-y-1">
                    <div className="font-semibold text-slate-900 dark:text-white">{item.summary}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.details}
                    </div>
                    {item.hint && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-400">
                        Saran: {item.hint}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right align-top whitespace-nowrap">
                    {item.cliCommand ? (
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(item.cliCommand!)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Salin perintah setup CLI"
                      >
                        {copiedCmd === item.cliCommand ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{item.cliCommand}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!report || report.checks.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    Memuat hasil diagnostik sistem...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Login & Session Diagnostic */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Diagnostik Tes Login &amp; Kesiapan Sesi Akun
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Menguji pencarian akun di tabel <code className="font-mono">users</code>, status <code className="font-mono">ACTIVE</code>, kecocokan kata sandi PBKDF2, dan uji tulis tabel <code className="font-mono">sessions</code> / <code className="font-mono">sesi</code> MariaDB secara aman.
            </p>
          </div>
        </div>

        <form onSubmit={handleRunLoginDiagnostic} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Username Akun
            </label>
            <input
              type="text"
              value={testUsername}
              onChange={(e) => setTestUsername(e.target.value)}
              placeholder="developer"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Kata Sandi (Opsional, isi untuk cek kecocokan hash)
            </label>
            <div className="relative">
              <input
                type={showTestPassword ? 'text' : 'password'}
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="Kosongkan untuk cek akun & struktur sesi saja"
                className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowTestPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={showTestPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showTestPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isTestingLogin}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isTestingLogin ? 'Menguji...' : 'Uji Login & Sesi'}</span>
            </button>
          </div>
        </form>

        {loginDiag && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/70 dark:bg-slate-950/60">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                {loginDiag.overallSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                )}
                <span>
                  Hasil Diagnostik: @{loginDiag.username} ({loginDiag.runtimeMode === 'mariadb' ? 'MariaDB' : 'Memori Lokal'})
                </span>
              </div>
              {loginDiag.userSummary && (
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Peran: {loginDiag.userSummary.role} · Status: {loginDiag.userSummary.status}
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {loginDiag.steps.map((step) => (
                <div key={step.key} className="px-4 py-2.5 flex items-start gap-2.5 text-xs">
                  {step.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{step.label}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {loginDiag.recommendation && (
              <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200/80 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Saran Perbaikan:</span> {loginDiag.recommendation}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CLI Command Reference */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Daftar Skrip CLI Server &amp; Setup
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Jalankan perintah berikut di terminal server (atau via <code className="font-mono">docker compose exec backend ...</code>).
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {cliScripts.map((script) => (
            <div
              key={script.command}
              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs font-bold text-slate-900 dark:text-emerald-400">
                    {script.command}
                  </code>
                  <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500">
                    · {script.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{script.summary}</p>
                {script.flags && (
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-500 break-all">
                    Contoh: {script.command} {script.flags}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopyCommand(script.command)}
                className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                {copiedCmd === script.command ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>Salin</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
