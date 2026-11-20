/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Smartphone, 
  QrCode, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink, 
  Wifi, 
  Globe, 
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Laptop
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

interface MobileAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
  publicTunnelUrl?: string;
}

const DEFAULT_SHARED_URL = 'https://ais-pre-2wdud2ugxodbrvaxfgwpbd-603738448697.asia-southeast1.run.app';

export const MobileAccessModal: React.FC<MobileAccessModalProps> = ({
  isOpen,
  onClose,
  embedded = false,
  publicTunnelUrl
}) => {
  const { showToast } = useInventory();
  
  // Resolve current active URL or cloud shared URL
  const [selectedUrlType, setSelectedUrlType] = useState<'cloud' | 'current' | 'custom'>('cloud');
  const [customUrl, setCustomUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [mobileOsTab, setMobileOsTab] = useState<'android' | 'ios'>('android');

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const resolvedCloudUrl = publicTunnelUrl?.trim() || DEFAULT_SHARED_URL;
  const activeTargetUrl = 
    selectedUrlType === 'cloud' 
      ? resolvedCloudUrl 
      : selectedUrlType === 'current' 
        ? currentOrigin 
        : (customUrl || currentOrigin);

  useEffect(() => {
    if (!embedded && !isOpen) return;

    let isMounted = true;
    QRCode.toDataURL(activeTargetUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [embedded, isOpen, activeTargetUrl]);

  if (!embedded && !isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeTargetUrl);
      setIsCopied(true);
      showToast('Link berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      showToast('Gagal menyalin link. Silakan salin manual.', 'error');
    }
  };

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(
      `Halo Tim IT Lapangan! Silakan buka aplikasi FieldOps IT untuk cek stok & pengujian go-live:\n${activeTargetUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  const innerCard = (
    <div 
      className={embedded
        ? 'bg-white dark:bg-slate-900 rounded-xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors'
        : 'bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 transition-colors'
      }
      role={embedded ? undefined : 'dialog'}
      aria-modal={embedded ? undefined : 'true'}
      aria-labelledby="mobile-modal-title"
    >
      {/* Modal Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 dark:from-emerald-800 dark:to-teal-900 px-6 py-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-xs">
            <Smartphone className="w-5 h-5 text-emerald-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="mobile-modal-title" className="text-lg font-bold">
                Buka &amp; Uji di HP Pengguna
              </h2>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                PWA Ready
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              Scan QR Code atau bagikan link ke teknisi untuk pengujian langsung lewat browser ponsel
            </p>
          </div>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
            aria-label="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Section: QR Code & Direct Link */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left: QR Code Box */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-md relative group">
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="QR Code Akses HP" 
                    className="w-48 h-48 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-xs font-mono">
                    Memuat QR...
                  </div>
                )}
                <div className="absolute inset-0 bg-emerald-600/10 opacity-0 group-hover:opacity-100 transition rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="bg-slate-900/80 text-white text-[11px] px-2 py-1 rounded shadow">
                    Scan via Kamera HP
                  </span>
                </div>
              </div>
              <span className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Arahkan kamera HP ke QR Code
              </span>
            </div>

            {/* Right: URL Options & Actions */}
            <div className="md:col-span-7 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Pilih Sumber Link Pengujian:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedUrlType('cloud')}
                    className={`px-3 py-2 rounded-lg border text-left flex items-start gap-2 transition ${
                      selectedUrlType === 'cloud'
                        ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-semibold ring-1 ring-emerald-600 dark:ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <div>Cloud Shared URL</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Siap diakses dari jaringan manapun</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUrlType('current')}
                    className={`px-3 py-2 rounded-lg border text-left flex items-start gap-2 transition ${
                      selectedUrlType === 'current'
                        ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-semibold ring-1 ring-emerald-600 dark:ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Laptop className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <div>URL Sesi Saat Ini</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Mengikuti browser aktif</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* URL Display Box */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Link Akses Browser HP:
                </label>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                  <span className="truncate">{activeTargetUrl}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition active:scale-95"
                >
                  {isCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? 'Tersalin!' : 'Salin Link'}
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] text-white font-semibold text-xs hover:bg-[#20bd5a] shadow-sm transition active:scale-95"
                  title="Bagikan ke WhatsApp Group Teknisi"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Kirim ke WhatsApp
                </button>

                <a
                  href={activeTargetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs transition"
                  title="Buka di tab baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Guide Section: How to Add to Home Screen (PWA Style) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Cara Memasang di Layar Utama HP (Terasa Seperti Aplikasi Native)
              </h3>
              <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
                <button
                  onClick={() => setMobileOsTab('android')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    mobileOsTab === 'android'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Android (Chrome)
                </button>
                <button
                  onClick={() => setMobileOsTab('ios')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    mobileOsTab === 'ios'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  iPhone (Safari)
                </button>
              </div>
            </div>

            {mobileOsTab === 'android' ? (
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2 text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span>Buka link di browser <strong>Google Chrome</strong> di HP Anda.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>Tekan menu <strong>Titik Tiga (⋮)</strong> di pojok kanan atas browser.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <span>Pilih opsi <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Instal Aplikasi"</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    4
                  </span>
                  <span>Aplikasi kini muncul di menu HP dengan icon resmi tanpa alamat URL browser!</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2 text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span>Buka link menggunakan browser <strong>Safari</strong> di iPhone/iPad.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>Tekan tombol <strong>Bagikan / Share</strong> (ikon kotak dengan panah ke atas di bagian bawah).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <span>Gulir ke bawah dan pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    4
                  </span>
                  <span>Tekan <strong>Tambah</strong> di pojok kanan atas untuk menyelesaikan.</span>
                </div>
              </div>
            )}
          </div>

          {/* Test Scenarios Checklist for Mobile Field Techs */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 rounded-xl p-4">
            <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Rekomendasi Skenario Uji di HP Teknisi:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                <span>Cari barang via Barcode / SKU dengan keyboard HP</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                <span>Buka fitur <strong>"Tas Lapangan"</strong> sebelum berangkat</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                <span>Simulasi catat barang keluar saat di lokasi tiket</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                <span>Cek ketersediaan stok cadangan di mobil operasional</span>
              </div>
            </div>
          </div>
        </div>

        {!embedded && (
          <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Tidak memerlukan instalasi dari Google Play Store / App Store
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white font-semibold text-xs hover:bg-slate-800 dark:hover:bg-slate-600 transition"
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      {innerCard}
    </div>
  );
};
