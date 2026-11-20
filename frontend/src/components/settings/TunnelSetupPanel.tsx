/**
 * Cloudflare Tunnel (.env Token + Validation + URL Probe) & Mobile QR Access Panel
 * Rendered full-width inside the Setting tab (Developer & Admin only)
 */

import React, { useEffect, useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  Trash2,
  Terminal
} from 'lucide-react';
import {
  PublicUrlProbe,
  SystemMaskedSettings,
  TunnelTokenInspection,
  setupApi
} from '../../services/setupApi';
import { MobileAccessModal } from '../MobileAccessModal';
import { useToast } from '../../context/ToastContext';

interface TunnelSetupPanelProps {
  settings: SystemMaskedSettings | null;
  onUpdated: () => Promise<void>;
}

export const TunnelSetupPanel: React.FC<TunnelSetupPanelProps> = ({
  settings,
  onUpdated
}) => {
  const { showToast } = useToast();

  const [tokenInput, setTokenInput] = useState('');
  const [publicUrlInput, setPublicUrlInput] = useState(settings?.tunnel.publicUrl || '');
  const [testPublicUrl, setTestPublicUrl] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [lastResult, setLastResult] = useState<{
    message: string;
    inspection: TunnelTokenInspection;
    publicUrlProbe?: PublicUrlProbe;
    dockerHint: string;
  } | null>(null);

  useEffect(() => {
    if (settings) {
      setPublicUrlInput(settings.tunnel.publicUrl || '');
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await setupApi.saveAndTestTunnel({
        token: tokenInput.trim() || undefined,
        publicUrl: publicUrlInput.trim(),
        testPublicUrl: Boolean(testPublicUrl && publicUrlInput.trim())
      });
      setLastResult({
        message: res.message,
        inspection: res.result.inspection,
        publicUrlProbe: res.result.publicUrlProbe,
        dockerHint: res.result.dockerHint
      });
      setTokenInput('');
      showToast(res.message, res.result.inspection.validFormat ? 'success' : 'info');
      await onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi Cloudflare Tunnel.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearToken = async () => {
    setIsSaving(true);
    try {
      const res = await setupApi.saveAndTestTunnel({ clearToken: true });
      setLastResult({
        message: res.message,
        inspection: res.result.inspection,
        dockerHint: res.result.dockerHint
      });
      setConfirmClear(false);
      showToast('Token Cloudflare Tunnel dihapus dari .env.', 'info');
      await onUpdated();
    } catch {
      showToast('Gagal menghapus token Tunnel.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const activeInspection = lastResult?.inspection || settings?.tunnel.inspection;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Konfigurasi Cloudflare Tunnel (.env)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atur <code className="font-mono">CLOUDFLARE_TUNNEL_TOKEN</code> dan URL publik HTTPS tanpa membuka port router.
              </p>
            </div>
          </div>

          <div className="text-xs font-mono text-right">
            <div className={activeInspection?.validFormat ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
              {activeInspection?.validFormat ? '● Token Valid' : '● Token Belum Diatur / Invalid'}
            </div>
            <div className="text-[11px] text-slate-400">CLI: npm run setup:tunnel</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Token Tunnel (<code className="font-mono">CLOUDFLARE_TUNNEL_TOKEN</code>)
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={settings?.tunnel.token.hasValue ? `Tersimpan (${settings.tunnel.token.masked})` : 'Tempel token eyJhIjo... dari Zero Trust'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Kosongkan jika hanya ingin mengubah atau menguji URL publik.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              URL Publik Tunnel (<code className="font-mono">CLOUDFLARE_PUBLIC_URL</code>, Opsional)
            </label>
            <input
              type="url"
              value={publicUrlInput}
              onChange={(e) => setPublicUrlInput(e.target.value)}
              placeholder="https://stok.domainanda.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono"
            />
            <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={testPublicUrl}
                onChange={(e) => setTestPublicUrl(e.target.checked)}
                className="rounded text-emerald-600"
              />
              <span>Uji jangkauan endpoint <code className="font-mono">/api/health</code> setelah menyimpan</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            {settings?.tunnel.token.hasValue && (
              confirmClear ? (
                <div className="inline-flex items-center gap-2 text-xs">
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">Hapus token tunnel dari .env?</span>
                  <button
                    type="button"
                    onClick={handleClearToken}
                    disabled={isSaving}
                    className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold hover:bg-rose-700"
                  >
                    Ya, Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Token</span>
                </button>
              )
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan ke .env & Validasi'}</span>
          </button>
        </div>

        {(lastResult || activeInspection?.configured) && (
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs space-y-2">
            <div className="flex items-start gap-2">
              {activeInspection?.validFormat ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {lastResult?.message || activeInspection?.reason}
                </div>
                {activeInspection?.tunnelId && (
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    Tunnel ID: {activeInspection.tunnelId} · Account: {activeInspection.accountTagPreview}
                  </div>
                )}
                {lastResult?.publicUrlProbe && (
                  <div className={`font-mono text-[11px] tabular-nums ${lastResult.publicUrlProbe.reachable ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {lastResult.publicUrlProbe.reachable
                      ? `URL Publik Terjangkau: ${lastResult.publicUrlProbe.url} (${lastResult.publicUrlProbe.latencyMs} ms)`
                      : `URL Publik Gagal Dijangkau: ${lastResult.publicUrlProbe.error}`}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <Terminal className="w-3.5 h-3.5 shrink-0" />
              <span>
                Sinkron Docker Container: <code className="font-mono text-slate-900 dark:text-slate-200">docker compose up -d --force-recreate cloudflared</code>
              </span>
            </div>
          </div>
        )}
      </form>

      {/* Embedded Mobile Access & QR Code Guide */}
      <MobileAccessModal
        embedded
        isOpen
        onClose={() => {}}
        publicTunnelUrl={publicUrlInput.trim() || undefined}
      />
    </div>
  );
};
