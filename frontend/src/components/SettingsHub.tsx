/**
 * Centralized Settings Hub (Tab Setting)
 * - Developer & Admin: Full 8-card infrastructure, RBAC, WA, Integration, SN, Security, & Diagnostics access
 * - Warehouse Admin (Admin Gudang): Scoped access to genuinely useful warehouse modules (WA Alert & SN Patterns)
 * - Technician: Access restricted notice
 * - Card selection opens full-width inline view with Back button
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BellRing,
  ChevronRight,
  Cloud,
  Database,
  Lock,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Users,
  Webhook,
  LucideIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SettingsSectionId, useInventory } from '../context/InventoryContext';
import { isAdminOrDev, isWarehouseManager } from '../utils/permissions';
import {
  CliScriptEntry,
  SystemCheckReport,
  SystemMaskedSettings,
  setupApi
} from '../services/setupApi';
import { SystemCheckPanel } from './settings/SystemCheckPanel';
import { DatabaseSetupPanel } from './settings/DatabaseSetupPanel';
import { TunnelSetupPanel } from './settings/TunnelSetupPanel';
import { WhatsAppConfigModal } from './WhatsAppConfigModal';
import { TicketIntegrationHub } from './TicketIntegrationHub';
import { UserRoleSwitcher } from './UserRoleSwitcher';
import { SNPatternSettingsModal } from './SNPatternSettingsModal';
import { SecurityReportModal } from './SecurityReportModal';

interface SettingCardConfig {
  id: SettingsSectionId;
  title: string;
  description: string;
  icon: LucideIcon;
  metaLabel: string;
  adminOnly: boolean;
  warehouseAllowed: boolean;
}

const SETTING_CARDS: SettingCardConfig[] = [
  {
    id: 'check',
    title: 'Status & Cek Koneksi Sistem',
    description: 'Diagnostik langsung berkas .env, koneksi MariaDB, Akun Admin, Gateway WA, Cloudflare Tunnel, serta daftar perintah CLI setup.',
    icon: Activity,
    metaLabel: 'Diagnostik & CLI',
    adminOnly: true,
    warehouseAllowed: false
  },
  {
    id: 'database',
    title: 'Database MariaDB & Backup',
    description: 'Pengaturan koneksi .env MariaDB, uji ping & muat ulang pool runtime, serta unduh file cadangan inventori JSON.',
    icon: Database,
    metaLabel: 'setup:db · Backup',
    adminOnly: true,
    warehouseAllowed: false
  },
  {
    id: 'tunnel',
    title: 'Cloudflare Tunnel & Akses HP',
    description: 'Kelola token Cloudflare Tunnel di .env, validasi struktur token, uji URL publik, dan bagikan QR Code PWA HP.',
    icon: Cloud,
    metaLabel: 'setup:tunnel · QR',
    adminOnly: true,
    warehouseAllowed: false
  },
  {
    id: 'whatsapp',
    title: 'Notifikasi WhatsApp Alert',
    description: 'Atur penerima alert stok menipis, jam aktif, ambang batas berjenjang, daftar pantauan, uji koneksi, dan log pengiriman.',
    icon: BellRing,
    metaLabel: 'setup:wa · Ambang',
    adminOnly: false,
    warehouseAllowed: true
  },
  {
    id: 'integration',
    title: 'Integrasi Tiket Eksternal',
    description: 'Kelola API Key webhook sistem tiket lapangan, jalankan simulator auto-deduct, dan tinjau log sinkronisasi.',
    icon: Webhook,
    metaLabel: 'Webhook & Key',
    adminOnly: true,
    warehouseAllowed: false
  },
  {
    id: 'users',
    title: 'Akun Pengguna & Matriks Peran',
    description: 'Persetujuan pendaftaran akun baru, buat akun server, reset kata sandi, ubah status akun, dan tinjau matriks RBAC.',
    icon: Users,
    metaLabel: 'setup:admin · RBAC',
    adminOnly: true,
    warehouseAllowed: false
  },
  {
    id: 'sn-patterns',
    title: 'Pengaturan Pola Serial Number',
    description: 'Konfigurasi pola identifikasi (#, A, ?, *) dan normalisasi barcode Serial Number untuk perangkat gudang.',
    icon: QrCode,
    metaLabel: 'Barcode SN',
    adminOnly: false,
    warehouseAllowed: true
  },
  {
    id: 'security',
    title: 'Laporan Audit Keamanan',
    description: 'Tinjauan temuan keamanan aplikasi, progres remidiasi administratif, serta catatan optimasi performa server.',
    icon: ShieldAlert,
    metaLabel: 'Audit & Remidiasi',
    adminOnly: true,
    warehouseAllowed: false
  }
];

export const SettingsHub: React.FC = () => {
  const { user } = useAuth();
  const { activeSettingsSection, setActiveSettingsSection } = useInventory();

  const isDevOrAdmin = isAdminOrDev(user?.role);
  const canAccessSettings = isWarehouseManager(user?.role);

  const [settings, setSettings] = useState<SystemMaskedSettings | null>(null);
  const [report, setReport] = useState<SystemCheckReport | null>(null);
  const [cliScripts, setCliScripts] = useState<CliScriptEntry[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const visibleCards = useMemo(() => {
    if (isDevOrAdmin) return SETTING_CARDS;
    if (canAccessSettings) return SETTING_CARDS.filter((c) => c.warehouseAllowed);
    return [];
  }, [isDevOrAdmin, canAccessSettings]);

  const loadSetupStatus = useCallback(async () => {
    if (!isDevOrAdmin) return;
    setIsLoadingStatus(true);
    try {
      const res = await setupApi.getStatus();
      setSettings(res.settings);
      setReport(res.report);
      setCliScripts(res.cliScripts);
    } catch {
      // Non-fatal; individual panels remain usable
    } finally {
      setIsLoadingStatus(false);
    }
  }, [isDevOrAdmin]);

  useEffect(() => {
    loadSetupStatus();
  }, [loadSetupStatus]);

  const handleRunCheck = async (publicUrl?: string) => {
    if (!isDevOrAdmin) return;
    setIsLoadingStatus(true);
    try {
      const res = await setupApi.runCheck(publicUrl);
      setSettings(res.settings);
      setReport(res.report);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  if (!canAccessSettings) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Akses Halaman Setting Dibatasi
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Menu Setting hanya tersedia untuk peran Developer, Admin, serta modul gudang terpilih untuk Admin Gudang.
        </p>
      </div>
    );
  }

  const activeCard = visibleCards.find((c) => c.id === activeSettingsSection) || null;

  // Full inline view when a card is selected
  if (activeSettingsSection) {
    if (!activeCard) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <button
            type="button"
            onClick={() => setActiveSettingsSection(null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Setting</span>
          </button>
          <div className="text-xs text-amber-700 dark:text-amber-300">
            Modul pengaturan ini hanya dapat diakses oleh peran Admin atau Developer.
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Top Workspace Navigation Bar with Back Button */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSettingsSection(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setActiveSettingsSection(null)}
                className="hover:text-slate-900 dark:hover:text-white font-medium"
              >
                Setting
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-bold text-slate-900 dark:text-white">{activeCard.title}</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            {activeCard.metaLabel}
          </div>
        </div>

        {/* Full-Width Inline Module Content */}
        <div>
          {activeSettingsSection === 'check' && isDevOrAdmin && (
            <SystemCheckPanel
              settings={settings}
              report={report}
              cliScripts={cliScripts}
              isChecking={isLoadingStatus}
              onRunCheck={handleRunCheck}
            />
          )}

          {activeSettingsSection === 'database' && isDevOrAdmin && (
            <DatabaseSetupPanel settings={settings} onUpdated={loadSetupStatus} />
          )}

          {activeSettingsSection === 'tunnel' && isDevOrAdmin && (
            <TunnelSetupPanel settings={settings} onUpdated={loadSetupStatus} />
          )}

          {activeSettingsSection === 'whatsapp' && (
            <WhatsAppConfigModal embedded isOpen onClose={() => setActiveSettingsSection(null)} />
          )}

          {activeSettingsSection === 'integration' && isDevOrAdmin && (
            <TicketIntegrationHub />
          )}

          {activeSettingsSection === 'users' && isDevOrAdmin && (
            <UserRoleSwitcher embedded isOpen onClose={() => setActiveSettingsSection(null)} />
          )}

          {activeSettingsSection === 'sn-patterns' && (
            <SNPatternSettingsModal embedded isOpen onClose={() => setActiveSettingsSection(null)} />
          )}

          {activeSettingsSection === 'security' && isDevOrAdmin && (
            <SecurityReportModal embedded isOpen onClose={() => setActiveSettingsSection(null)} />
          )}
        </div>
      </div>
    );
  }

  const getCardLiveSummary = (cardId: SettingsSectionId): string | null => {
    if (!isDevOrAdmin || !report) return null;
    if (cardId === 'check') {
      return report.overallStatus === 'ready'
        ? 'Semua koneksi utama terhubung'
        : report.overallStatus === 'partial'
        ? 'Sebagian komponen perlu perhatian'
        : 'Perlu konfigurasi awal';
    }
    if (cardId === 'database') {
      return report.checks.find((c) => c.key === 'database')?.summary || null;
    }
    if (cardId === 'tunnel') {
      return report.checks.find((c) => c.key === 'tunnel')?.summary || null;
    }
    if (cardId === 'whatsapp') {
      return report.checks.find((c) => c.key === 'whatsapp')?.summary || null;
    }
    if (cardId === 'users') {
      return report.checks.find((c) => c.key === 'admin')?.summary || null;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white font-display">
            Pengaturan Sistem &amp; Integrasi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isDevOrAdmin
              ? 'Pusat konfigurasi infrastruktur (.env), integrasi layanan, akun, pola barcode, dan diagnostik sistem.'
              : 'Pengaturan operasional gudang yang tersedia untuk Admin Gudang (Notifikasi Stok WhatsApp & Pola Serial Number).'}
          </p>
        </div>

        {isDevOrAdmin && (
          <button
            type="button"
            onClick={() => handleRunCheck()}
            disabled={isLoadingStatus}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            <span>{isLoadingStatus ? 'Memeriksa...' : 'Cek Status Koneksi'}</span>
          </button>
        )}
      </div>

      {/* System Health Quick Strip (Admin & Developer Only) */}
      {isDevOrAdmin && report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {report.checks
            .filter((c) => c.key !== 'admin')
            .map((chk) => (
              <button
                key={chk.key}
                type="button"
                onClick={() =>
                  setActiveSettingsSection(
                    chk.key === 'database'
                      ? 'database'
                      : chk.key === 'whatsapp'
                      ? 'whatsapp'
                      : chk.key === 'tunnel'
                      ? 'tunnel'
                      : 'check'
                  )
                }
                className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3.5 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <span>{chk.label}</span>
                  <span
                    className={`font-semibold ${
                      chk.status === 'connected'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : chk.status === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {chk.status === 'connected' ? 'Siap' : chk.status === 'warning' ? 'Perhatian' : 'Belum'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate font-mono tabular-nums">
                  {chk.summary}
                </div>
              </button>
            ))}
        </div>
      )}

      {/* Setting Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          const liveSummary = getCardLiveSummary(card.id);

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveSettingsSection(card.id)}
              className="group text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-emerald-600/70 rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-emerald-600 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {card.metaLabel}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate pr-2">
                  {liveSummary || (card.adminOnly ? 'Admin & Developer' : 'Admin, Developer & Admin Gudang')}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-emerald-400 shrink-0">
                  <span>Buka</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
