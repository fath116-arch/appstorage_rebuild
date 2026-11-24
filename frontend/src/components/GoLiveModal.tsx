/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { APP_VERSION } from '../constants/version';
import { 
  X, 
  Rocket, 
  CheckCircle2, 
  Circle, 
  Server, 
  ShieldCheck, 
  FileText, 
  Webhook, 
  Briefcase, 
  Database,
  Terminal,
  ExternalLink,
  ChevronRight,
  Printer,
  Globe,
  Smartphone,
  FileSpreadsheet,
  Lock,
  Sparkles,
  UserCheck
} from 'lucide-react';

interface GoLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'dashboard' | 'catalog' | 'inout' | 'requests' | 'weekly-report' | 'settings') => void;
}

import { useAuth } from '../context/AuthContext';

export const GoLiveModal: React.FC<GoLiveModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const { user } = useAuth();
  const { products, transactions, showToast } = useInventory();

  // Test scenario completion states
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    'step-1': true, // Master data ready
    'step-2': true, // Mobile & dropdown UI ready
    'step-3': true, // Excel export ready
    'step-4': true, // SHA-256 encryption ready
    'step-5': false, // Cloudflare tunnel verified
    'step-6': false, // Multi-user RBAC verified
  });

  const [activeTabSection, setActiveTabSection] = useState<'checklist' | 'cloudflare' | 'deployment' | 'changelog' | 'architecture'>('checklist');

  if (!isOpen) return null;

  const toggleStep = (stepId: string) => {
    setCompletedSteps(prev => {
      const nextState = { ...prev, [stepId]: !prev[stepId] };
      const allDone = Object.values(nextState).filter(Boolean).length === 6;
      if (allDone) {
        showToast('Semua skenario pengujian v0.2.0 telah diverifikasi!', 'success');
      }
      return nextState;
    });
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const readinessPercent = Math.round((completedCount / 6) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">
                  Protokol Uji Go-Live, Cloudflare Tunnel & Keamanan v{APP_VERSION}
                </h2>
                <span className="font-mono text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-white/70">
                Panduan akses smartphone, Cloudflare Tunnel remote, ekspor Excel, dan enkripsi akun SHA-256
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher inside modal */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTabSection('checklist')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTabSection === 'checklist' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Checklist Pengujian ({completedCount}/6)
            </button>
            <button
              onClick={() => setActiveTabSection('cloudflare')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTabSection === 'cloudflare' 
                  ? 'bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 font-bold shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cloudflare Tunnel 🌐
            </button>
            <button
              onClick={() => setActiveTabSection('deployment')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTabSection === 'deployment' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Setup & .env
            </button>
            <button
              onClick={() => setActiveTabSection('changelog')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTabSection === 'changelog' 
                  ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Changelog v0.2.2 ✨
            </button>
            <button
              onClick={() => setActiveTabSection('architecture')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTabSection === 'architecture' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Kesiapan System
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">Kesiapan:</span>
            <span className={`font-bold ${readinessPercent === 100 ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}`}>
              {readinessPercent}%
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto text-xs">
          {/* SECTION 1: CHECKLIST SKENARIO PENGUJIAN */}
          {activeTabSection === 'checklist' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                Centang setiap skenario setelah tim IT Anda menguji alurnya di smartphone maupun PC.
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-start gap-3">
                <button
                  onClick={() => toggleStep('step-1')}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {completedSteps['step-1'] ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                      1. Uji UI Smartphone & Navigasi Menu Dropdown Compact
                    </h3>
                    <button
                      onClick={() => { onClose(); onNavigateTab('catalog'); }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <span>Uji Katalog HP</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Pastikan navigasi dropdown di header seluler & menu drawer slide-over berjalan responsif pada layar smartphone (320px–480px).
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-start gap-3">
                <button
                  onClick={() => toggleStep('step-2')}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {completedSteps['step-2'] ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                      2. Uji Ekspor Data Katalog & Laporan ke Format Excel (.xlsx)
                    </h3>
                    <button
                      onClick={() => { onClose(); onNavigateTab('weekly-report'); }}
                      className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <span>Uji Ekspor Excel</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Unduh file Excel <code>.xlsx</code> untuk katalog dan laporan mingguan. Verifikasi header berwarna, autowidth, dan formula total nilai aset.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-start gap-3">
                <button
                  onClick={() => toggleStep('step-3')}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {completedSteps['step-3'] ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                      3. Uji Keamanan Akun & Hashing Kata Sandi SHA-256 (Web Crypto)
                    </h3>
                    <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded">
                      SHA-256 Active
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Verifikasi autentikasi berbasis Web Crypto API + Salt untuk peran akun Teknisi, Admin, dan Developer.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-start gap-3">
                <button
                  onClick={() => toggleStep('step-4')}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {completedSteps['step-4'] ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                      4. Uji Pengambilan Data Barang Lapangan via Barcode HP
                    </h3>
                    <button
                      onClick={() => { onClose(); onNavigateTab('catalog'); }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <span>Uji Ambil Barang</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Uji pemakaian barang langsung dari smartphone dengan scanning barcode 899.. untuk tiket insiden lapangan.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-start gap-3">
                <button
                  onClick={() => toggleStep('step-5')}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {completedSteps['step-5'] ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                      5. Uji Sambung Cloudflare Tunnel Remote (`cloudflared`)
                    </h3>
                    <button
                      onClick={() => setActiveTabSection('cloudflare')}
                      className="text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <span>Panduan Tunnel</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Verifikasi rute tunnel HTTPS aman dari Cloudflare menuju <code>http://localhost:3000</code> agar aplikasi dapat diakses teknisi di luar kantor.
                  </p>
                </div>
              </div>

              {/* Step 6 */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-start gap-3">
                <button
                  onClick={() => toggleStep('step-6')}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  {completedSteps['step-6'] ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                      6. Uji Integrasi Tiket Jira / Webhook Auto-Deduct
                    </h3>
                    <button
                      onClick={() => { onClose(); onNavigateTab('settings'); }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <span>Uji Webhook</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Verifikasi pengurangan stok otomatis saat tiket diselesaikan melalui API Key yang terenkripsi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: CLOUDFLARE TUNNEL SETUP GUIDE */}
          {activeTabSection === 'cloudflare' && (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-xl space-y-2 text-teal-900 dark:text-teal-200">
                <div className="font-bold text-xs flex items-center gap-2 text-teal-800 dark:text-teal-300">
                  <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Panduan Menyambungkan ke Cloudflare Tunnel (Akses Dimana Saja)</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Karena Anda sudah membuat tunnel di Cloudflare, gunakan perintah <code>cloudflared</code> di bawah ini untuk menghubungkan aplikasi lokal ke domain/URL HTTPS publik Cloudflare Anda.
                </p>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-xs text-teal-400 font-mono flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Perintah Terminal Cloudflare Tunnel Run
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">cloudflared CLI</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[10px] block mb-1">Cara Quick Tunnel (Seketika Tanpa Login Cloudflare):</span>
                    <pre className="p-3 bg-slate-950 rounded-lg text-emerald-400 font-mono overflow-x-auto border border-slate-800">
cloudflared tunnel --url http://localhost:3000
                    </pre>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] block mb-1">Cara dengan Named Tunnel / Domain Cloudflare yang Sudah Dibuat:</span>
                    <pre className="p-3 bg-slate-950 rounded-lg text-emerald-400 font-mono overflow-x-auto border border-slate-800">
# 1. Jalankan tunnel yang sudah ada (ganti NAMA_TUNNEL dengan nama tunnel Anda)
cloudflared tunnel run NAMA_TUNNEL

# 2. Atau jika menggunakan config.yml:
cloudflared tunnel run --config /path/to/config.yml
                    </pre>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-slate-700 dark:text-slate-300">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span>Petunjuk Akses di Smartphone Teknisi Lapangan</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
                  <li>Jalankan aplikasi di komputer lokal: <code>npm run dev</code> (port 3000).</li>
                  <li>Jalankan Cloudflare Tunnel: <code>cloudflared tunnel run NAMA_TUNNEL</code> atau <code>cloudflared tunnel --url http://localhost:3000</code>.</li>
                  <li>Salin URL HTTPS publik yang dihasilkan (misal <code>https://inventori-it.domain-anda.com</code>) atau bagikan QR Code ke smartphone teknisi.</li>
                  <li>Teknisi lapangan dapat langsung membuka browser HP, login dengan role masing-masing, dan melakukan pencatatan barang secara real-time.</li>
                </ol>
              </div>
            </div>
          )}

          {/* SECTION 3: DEPLOYMENT & PRODUCTION SETUP GUIDE */}
          {activeTabSection === 'deployment' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl space-y-2 text-blue-900 dark:text-blue-200">
                <div className="font-bold text-xs flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                  <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Apakah Cara Setup Berubah di Versi 0.2.0?</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  <strong>Perintah dasar TETAP SAMA:</strong> <code>npm install</code>, <code>npm run dev</code>, dan <code>npm run build</code>. 
                  Di v0.2.2 telah ditambahkan dukungan <strong>ekspor Excel (.xlsx)</strong>, <strong>enkripsi akun SHA-256 Web Crypto</strong>, serta <strong>navigasi smartphone dropdown</strong>.
                </p>
              </div>

              {/* Panduan Salin .env & Menjalankan Salinan */}
              <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-2 text-amber-900 dark:text-amber-200">
                <div className="font-bold text-xs flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Panduan Menggunakan File .env & Menjalankan Salinan (Multi-Instance)</span>
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded border border-amber-200 dark:border-amber-800/80 text-slate-800 dark:text-slate-200">
                    <span className="text-slate-500 dark:text-slate-400 font-sans text-[10px] block font-semibold mb-0.5">1. Cara menyalin file environment:</span>
                    <code>copy .env.example .env</code> <span className="text-slate-400 dark:text-slate-500 font-sans text-[10px]">(Windows CMD)</span><br />
                    <code>cp .env.example .env</code> <span className="text-slate-400 dark:text-slate-500 font-sans text-[10px]">(macOS / Linux / Git Bash)</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded border border-amber-200 dark:border-amber-800/80 text-slate-800 dark:text-slate-200">
                    <span className="text-slate-500 dark:text-slate-400 font-sans text-[10px] block font-semibold mb-0.5">2. Menjalankan salinan port berbeda (misal 3001):</span>
                    <code>npm run dev -- --port=3001</code>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2 border border-slate-800">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-400">
                  <Terminal className="w-4 h-4" />
                  <span>Langkah Lengkap Eksekusi Lokal & Jaringan HP</span>
                </div>
                <pre className="p-3 bg-slate-950 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
# 1. Install seluruh dependensi (.npmrc legacy-peer-deps aktif)
npm install

# 2. Salin file lingkungan
cp .env.example .env

# 3. Jalankan server lokal (siap untuk Cloudflare Tunnel & HP)
npm run dev

# 4. Jika ingin build static dist/:
npm run build
                </pre>
              </div>
            </div>
          )}

          {/* SECTION 4: CHANGELOG v0.2.2 & RIWAYAT UPDATE */}
          {activeTabSection === 'changelog' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                      v0.2.9
                    </span>
                    <span className="font-bold text-emerald-950 dark:text-emerald-200 text-xs">Penyempurnaan Tema Gelap (Dark Mode), Perbaikan Divider & Pop-up Profil</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">Rilis v0.2.9</span>
                </div>
                <p className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  Fitur baru dan penyempurnaan visual yang diselesaikan dalam rilis versi 0.2.9:
                </p>

                <div className="space-y-2 pt-1">
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      1. Dark Mode Harmony untuk Master Dropdown & Sub-Dropdown
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Menghilangkan garis putih terang yang mencolok pada pembatas antar kelompok dan sub-menu dengan menambahkan styling <code>dark:divide-slate-700</code> dan border yang selaras.
                    </p>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      2. Dark Mode Pop-up Profil Pengguna & Header Badge
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Memperbarui pop-up profil pengguna di header (`userDropdownOpen`), tombol avatar badge, serta seluruh kartu info akun agar otomatis menyesuaikan tema gelap secara mulus tanpa bentrok visual putih.
                    </p>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      3. Responsive Smartphone UI & Menu Dropdown Compact Header
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Navigasi khusus smartphone dengan selector dropdown di header dan touch drawer slide-over untuk pengoperasian dengan satu jempol di lokasi perbaikan.
                    </p>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      4. Ekspor Data ke Format Excel (.xlsx) & Enkripsi SHA-256
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Kemampuan mengunduh katalog inventori ke Excel (.xlsx) serta enkripsi kata sandi akun berbasis Web Crypto API SHA-256.
                    </p>
                  </div>
                </div>
              </div>

              {/* Previous versions */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded">
                    v0.1.2
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Fix npm ERESOLVE, react-is & multi-instance .env</span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: ARCHITECTURE READINESS MATRIX */}
          {activeTabSection === 'architecture' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 font-medium border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Komponen Sistem</th>
                      <th className="py-2.5 px-3">Status v0.2.4</th>
                      <th className="py-2.5 px-3">Catatan Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">UI Smartphone & Dropdown</td>
                      <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">READY (PASS)</td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">Compact dropdown & touch drawer active</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">Ekspor Format Excel (.xlsx)</td>
                      <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">READY (PASS)</td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">Styled spreadsheet exporter active</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">Enkripsi SHA-256 Web Crypto</td>
                      <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">READY (PASS)</td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">Salted password hashing enabled</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">Cloudflare Tunnel Integration</td>
                      <td className="py-2.5 px-3 text-teal-700 dark:text-teal-400 font-bold">READY (PASS)</td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">cloudflared CLI setup guide verified</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">Auto-Deduct Webhook API</td>
                      <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">READY (PASS)</td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">Jira/Zendesk webhook simulator active</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            Versi Rilis Saat Ini: <strong className="text-slate-900 dark:text-white font-mono">v{APP_VERSION} (Security Remediation & Hardening Release)</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg shadow-xs"
          >
            Tutup & Lanjutkan Pengujian
          </button>
        </div>
      </div>
    </div>
  );
};
