/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TabType, useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Package,
  ArrowLeftRight,
  FileText,
  Boxes,
  Webhook,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Download,
  LayoutDashboard,
  Smartphone,
  ShieldCheck,
  FileSpreadsheet,
  Briefcase,
  UserCheck,
  Wrench,
  Database,
  LogOut,
  MessageSquare,
  Printer,
  LucideIcon
} from 'lucide-react';
import { exportInventoryToExcel } from '../utils/excelExporter';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeSelector } from './ThemeSelector';
import { isAdminOrDev } from '../utils/permissions';
import { getErrorMessage } from '../utils/errorUtils';

interface NavbarProps {
  onOpenChecklist: () => void;
  onOpenUserModal: () => void;
  onOpenDownload: () => void;
  onOpenGoLive: () => void;
  onOpenMobileAccess: () => void;
  onOpenWhatsApp?: () => void;
  onOpenSecurityReport?: () => void;
  onOpenRestore?: () => void;
  onOpenLabelPrint?: () => void;
  onOpenSNPatterns?: () => void;
}

interface NavTabConfig {
  id: TabType;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  showOnDesktop: boolean;
  showOnMobile: boolean;
}

interface ToolsItemConfig {
  id: string;
  label: string;
  masterLabel?: string;
  icon: LucideIcon;
  iconColorClass: string;
  masterTextClass: string;
  adminOnly?: boolean;
  onClick: () => void;
  visible?: boolean;
}

const PRIMARY_TABS: NavTabConfig[] = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Dashboard', icon: LayoutDashboard, showOnDesktop: true, showOnMobile: true },
  { id: 'catalog', label: 'Katalog', mobileLabel: 'Katalog', icon: Package, showOnDesktop: true, showOnMobile: true },
  { id: 'inout', label: 'Masuk/Keluar', mobileLabel: 'Masuk/Keluar', icon: ArrowLeftRight, showOnDesktop: true, showOnMobile: true },
  { id: 'weekly-report', label: 'Laporan', mobileLabel: 'Laporan', icon: FileText, showOnDesktop: true, showOnMobile: true },
  { id: 'integration', label: 'Integrasi', mobileLabel: 'Integrasi', icon: Webhook, showOnDesktop: false, showOnMobile: true },
];

export const Navbar: React.FC<NavbarProps> = ({
  onOpenChecklist,
  onOpenUserModal,
  onOpenDownload,
  onOpenGoLive,
  onOpenMobileAccess,
  onOpenWhatsApp,
  onOpenSecurityReport,
  onOpenRestore,
  onOpenLabelPrint,
  onOpenSNPatterns
}) => {
  const { activeTab, setActiveTab, items, refreshData, VERSION } = useInventory();
  const { showToast } = useToast();
  const { user, logout } = useAuth();

  const isDevOrAdmin = isAdminOrDev(user?.role);

  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    stok: true,
    laporan: true,
    alat: false,
    akun: false,
  });

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const lowOrOutCount = items.filter(i => i.quantity <= (i.min_stock_alert ?? i.minStockAlert ?? 0)).length;

  const closeAllDropdowns = () => {
    setAppMenuOpen(false);
    setUserDropdownOpen(false);
    setToolsMenuOpen(false);
  };

  const handleExportExcelQuick = () => {
    exportInventoryToExcel(items);
    showToast('File Excel inventori (.xlsx) sedang diunduh!', 'success');
  };

  const handleRefresh = async () => {
    try {
      await refreshData();
      showToast('Data inventori berhasil disinkronkan dari MariaDB.', 'success');
    } catch (e: unknown) {
      showToast('Gagal menyinkronkan data: ' + getErrorMessage(e), 'error');
    }
  };

  const stockGroupLinks: Array<{ id: TabType; label: string; icon: LucideIcon; iconClass: string; showBadge?: boolean }> = [
    { id: 'catalog', label: 'Katalog Inventaris', icon: Package, iconClass: 'text-blue-600 dark:text-blue-400', showBadge: true },
    { id: 'inout', label: 'Barang Masuk / Keluar', icon: ArrowLeftRight, iconClass: 'text-emerald-600 dark:text-emerald-400' },
    { id: 'categories', label: 'Kategori & Lokasi Rak', icon: Boxes, iconClass: 'text-purple-600 dark:text-purple-400' },
  ];

  const reportGroupLinks: Array<{ id: TabType; label: string; icon: LucideIcon; iconClass: string }> = [
    { id: 'weekly-report', label: 'Laporan Pergerakan Mingguan', icon: FileText, iconClass: 'text-indigo-600 dark:text-indigo-400' },
    { id: 'integration', label: 'Integrasi Tiket Lapangan', icon: Webhook, iconClass: 'text-teal-600 dark:text-teal-400' },
  ];

  const toolsItems: ToolsItemConfig[] = [
    {
      id: 'restore',
      label: 'Database & Restore',
      masterLabel: 'Data Backup & Restore',
      icon: Database,
      iconColorClass: 'text-blue-600 dark:text-blue-400',
      masterTextClass: 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700/60',
      adminOnly: true,
      visible: Boolean(onOpenRestore),
      onClick: () => onOpenRestore?.()
    },
    {
      id: 'audit',
      label: 'Laporan Keamanan Audit',
      icon: ShieldCheck,
      iconColorClass: 'text-amber-600 dark:text-amber-400',
      masterTextClass: 'text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700/60',
      adminOnly: true,
      onClick: () => onOpenSecurityReport?.()
    },
    {
      id: 'whatsapp',
      label: 'Notifikasi WA Alert',
      masterLabel: 'Notifikasi WA Stok Menipis',
      icon: MessageSquare,
      iconColorClass: 'text-emerald-600 dark:text-emerald-400',
      masterTextClass: 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700/60',
      onClick: () => onOpenWhatsApp?.()
    },
    {
      id: 'mobile',
      label: 'Akses HP & Cloudflare',
      masterLabel: 'Panduan Cloudflare & Akses HP',
      icon: Smartphone,
      iconColorClass: 'text-teal-600 dark:text-teal-400',
      masterTextClass: 'text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700/60',
      onClick: onOpenMobileAccess
    },
    {
      id: 'excel',
      label: 'Ekspor Katalog Excel (.xlsx)',
      icon: FileSpreadsheet,
      iconColorClass: 'text-emerald-600 dark:text-emerald-400',
      masterTextClass: 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700/60',
      onClick: handleExportExcelQuick
    },
    {
      id: 'label',
      label: 'Cetak Label Batch A4',
      icon: Printer,
      iconColorClass: 'text-indigo-600 dark:text-indigo-400',
      masterTextClass: 'text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700/60',
      onClick: () => onOpenLabelPrint?.()
    },
    {
      id: 'sn-patterns',
      label: 'Pengaturan Pola SN',
      icon: Package,
      iconColorClass: 'text-emerald-600 dark:text-emerald-400',
      masterTextClass: 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700/60',
      onClick: () => onOpenSNPatterns?.()
    }
  ];

  const visibleToolsItems = toolsItems.filter(item => {
    if (item.adminOnly && !isDevOrAdmin) return false;
    if (item.visible === false) return false;
    return true;
  });

  const masterAlatItems = [
    ...visibleToolsItems.filter(t => t.id !== 'sn-patterns' && t.id !== 'restore'),
    {
      id: 'download',
      label: 'Download Source Code (.ZIP)',
      masterLabel: 'Download Source Code (.ZIP)',
      icon: Download,
      iconColorClass: 'text-blue-600 dark:text-blue-400',
      masterTextClass: 'text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700/60',
      onClick: onOpenDownload
    },
    ...visibleToolsItems.filter(t => t.id === 'restore').map(item => ({
      ...item,
      icon: RotateCcw,
      iconColorClass: 'text-emerald-600 dark:text-emerald-400'
    }))
  ];

  return (
    <>
      {/* Top Header */}
      <header className="no-print sticky top-0 z-30 glass border-b border-slate-200/60 dark:border-slate-800/80 shadow-xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">

            {/* Zone 1: Interactive Brand Logo & Full Name (Triggers Master Dropdown Menu on Click) */}
            <div className="relative">
              <button
                onClick={() => {
                  const nextState = !appMenuOpen;
                  closeAllDropdowns();
                  setAppMenuOpen(nextState);
                }}
                className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1.5 rounded-xl hover:bg-slate-900/5 dark:hover:bg-slate-800/60 transition-all group border border-transparent focus:outline-hidden"
                aria-label="Buka Menu Dropdown Aplikasi FieldOps IT"
                title="Klik untuk membuka Menu Navigasi & Kelompok Fitur"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-slate-100 border border-slate-200/90 dark:border-slate-300/50 shadow-xs flex items-center justify-center p-1 overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                  <img
                    src="/logo.webp"
                    alt="FieldOps IT Logo"
                    className="w-full h-full object-contain"
                  />
                </div>

                <span className="hidden sm:inline-block font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight leading-none font-display">
                  FieldOps IT
                </span>

                <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${appMenuOpen ? 'rotate-180 text-slate-900 dark:text-white' : 'group-hover:text-slate-700 dark:group-hover:text-slate-300'}`} />
              </button>

              {/* Master Dropdown Menu with Sub-Dropdowns */}
              {appMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={closeAllDropdowns} />
                  <div className="absolute left-0 mt-2 w-80 sm:w-88 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 transition-colors">

                    {/* Header Banner inside Dropdown */}
                    <div className="bg-slate-900 text-white p-3.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2 font-display">
                            <Database className="w-4 h-4 text-emerald-400" />
                            <span>Kantor Pusat ISP</span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Server Lokal &amp; Cloudflare Tunnel
                          </p>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                          MariaDB 11.x
                        </span>
                      </div>
                    </div>

                    {/* Scrollable Sub-dropdown List */}
                    <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1 divide-y divide-slate-200 dark:divide-slate-700/60">

                      {/* Direct Link: Dashboard Utama */}
                      <div className="pb-1">
                        <button
                          onClick={() => {
                            setActiveTab('dashboard');
                            closeAllDropdowns();
                          }}
                          className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                            activeTab === 'dashboard'
                              ? 'bg-slate-900 text-white dark:bg-slate-700 font-semibold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            <LayoutDashboard className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-bold">Dashboard Utama</div>
                            <div className={`text-[10px] ${activeTab === 'dashboard' ? 'text-slate-300' : 'text-slate-400 dark:text-slate-400'}`}>
                              Ringkasan stok &amp; aktivitas terkini
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* Kelompok Sub-Dropdown 1: Stok & Mutasi Inventaris */}
                      <div className="pt-1.5 pb-1">
                        <button
                          onClick={() => toggleSection('stok')}
                          className="w-full p-2 rounded-lg flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="uppercase tracking-wider text-[11px]">Kelompok Stok &amp; Mutasi</span>
                          </div>
                          {expandedSections.stok ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {expandedSections.stok && (
                          <div className="mt-1 ml-2 pl-2 border-l-2 border-slate-300 dark:border-slate-700 space-y-1 animate-in fade-in duration-150">
                            {stockGroupLinks.map((link) => {
                              const Icon = link.icon;
                              const isActive = activeTab === link.id;
                              return (
                                <button
                                  key={link.id}
                                  onClick={() => { setActiveTab(link.id); closeAllDropdowns(); }}
                                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                    isActive ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-3.5 h-3.5 ${link.iconClass}`} />
                                    <span>{link.label}</span>
                                  </div>
                                  {link.showBadge && lowOrOutCount > 0 && (
                                    <span className="text-[10px] font-mono font-bold bg-amber-500 text-white px-1.5 py-0.2 rounded-full">
                                      {lowOrOutCount} alert
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Kelompok Sub-Dropdown 2: Laporan & Integrasi Tiket */}
                      <div className="pt-1.5 pb-1">
                        <button
                          onClick={() => toggleSection('laporan')}
                          className="w-full p-2 rounded-lg flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="uppercase tracking-wider text-[11px]">Kelompok Laporan &amp; Tiket</span>
                          </div>
                          {expandedSections.laporan ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {expandedSections.laporan && (
                          <div className="mt-1 ml-2 pl-2 border-l-2 border-slate-300 dark:border-slate-700 space-y-1 animate-in fade-in duration-150">
                            {reportGroupLinks.map((link) => {
                              const Icon = link.icon;
                              const isActive = activeTab === link.id;
                              return (
                                <button
                                  key={link.id}
                                  onClick={() => { setActiveTab(link.id); closeAllDropdowns(); }}
                                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                                  }`}
                                >
                                  <Icon className={`w-3.5 h-3.5 ${link.iconClass}`} />
                                  <span>{link.label}</span>
                                </button>
                              );
                            })}

                            <button
                              onClick={() => { closeAllDropdowns(); onOpenChecklist(); }}
                              className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                            >
                              <Briefcase className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>Checklist Tas Lapangan Teknisi</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Kelompok Sub-Dropdown 3: Alat & Ekspor Data */}
                      <div className="pt-1.5 pb-1">
                        <button
                          onClick={() => toggleSection('alat')}
                          className="w-full p-2 rounded-lg flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            <span className="uppercase tracking-wider text-[11px]">Kelompok Alat &amp; Ekspor</span>
                          </div>
                          {expandedSections.alat ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {expandedSections.alat && (
                          <div className="mt-1 ml-2 pl-2 border-l-2 border-slate-300 dark:border-slate-700 space-y-1 animate-in fade-in duration-150">
                            {masterAlatItems.map((item) => {
                              const Icon = item.icon;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => { closeAllDropdowns(); item.onClick(); }}
                                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 font-medium ${item.masterTextClass}`}
                                >
                                  <Icon className={`w-3.5 h-3.5 ${item.iconColorClass}`} />
                                  <span>{item.masterLabel || item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Kelompok Sub-Dropdown 4: Informasi Akun & Hak Akses */}
                      {user && (
                        <div className="pt-1.5 pb-1">
                          <button
                            onClick={() => toggleSection('akun')}
                            className="w-full p-2 rounded-lg flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              <span className="uppercase tracking-wider text-[11px]">Akun &amp; Keamanan Sesi</span>
                            </div>
                            {expandedSections.akun ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          {expandedSections.akun && (
                            <div className="mt-1 ml-2 pl-2 border-l-2 border-slate-300 dark:border-slate-700 space-y-1.5 animate-in fade-in duration-150">
                              <div className="p-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{user.role} ({user.department})</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">@{user.username}</div>
                                <div className="mt-1 flex items-center justify-between">
                                  <span className="text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                                    Status: {user.status}
                                  </span>
                                  {user.is_master_admin && (
                                    <span className="text-[9px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                                      Master Admin
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => { closeAllDropdowns(); onOpenUserModal(); }}
                                className="w-full text-left p-1.5 rounded-lg text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700/60 font-medium flex items-center gap-1.5"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                <span>Matriks Hak Akses &amp; Pengguna</span>
                              </button>

                              <button
                                onClick={() => { closeAllDropdowns(); logout(); }}
                                className="w-full text-left p-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium flex items-center gap-1.5"
                              >
                                <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                <span>Keluar (Logout Sesi)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Theme Selector Section inside Dropdown */}
                    <ThemeSelector variant="default" />

                    {/* Sub Dropdown Footer Area: VERSION INFO AT THE VERY BOTTOM */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { closeAllDropdowns(); onOpenGoLive(); }}
                          className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-2 py-0.5 rounded transition-colors flex items-center gap-1.5"
                          title={`Klik untuk membuka Status Uji Versi v${VERSION}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>v{VERSION}</span>
                        </button>
                        <span className="text-[11px] text-slate-500 font-medium">FieldOps MariaDB</span>
                      </div>

                      <button
                        onClick={() => { closeAllDropdowns(); handleRefresh(); }}
                        className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        title="Muat Ulang Data Server"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Refresh</span>
                      </button>
                    </div>

                  </div>
                </>
              )}
            </div>

            {/* Zone 2: Quick Desktop Nav Links */}
            <nav className="hidden xl:flex items-center gap-2 text-xs font-semibold">
              {PRIMARY_TABS.filter(tab => tab.showOnDesktop).map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); closeAllDropdowns(); }}
                    className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-sm font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {tab.id === 'catalog' && lowOrOutCount > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                        {lowOrOutCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Zone 3: Quick Action Buttons & User Profile */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Single Office Badge */}
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800 rounded-lg whitespace-nowrap shrink-0"
                title="Satu Kantor Tunggal: MariaDB 11.x Server Lokal"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Kantor Pusat ISP</span>
              </div>

              {/* PWA In-App Install Prompt */}
              <PWAInstallButton />

              {/* Dedicated Tools Dropdown Menu for All Roles */}
              <div className="relative">
                <button
                  onClick={() => {
                    const next = !toolsMenuOpen;
                    closeAllDropdowns();
                    setToolsMenuOpen(next);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors shrink-0 shadow-2xs"
                  title="Menu Peralatan & Tools System"
                >
                  <Wrench className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Tools</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${toolsMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {toolsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={closeAllDropdowns} />
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                        Menu Tools &amp; Utilitas
                      </div>

                      {visibleToolsItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => { closeAllDropdowns(); item.onClick(); }}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-slate-800 dark:text-slate-200"
                          >
                            <Icon className={`w-3.5 h-3.5 ${item.iconColorClass}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* User Profile & Role Quick Badge */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => {
                      const next = !userDropdownOpen;
                      closeAllDropdowns();
                      setUserDropdownOpen(next);
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-900/5 dark:bg-slate-800/80 hover:bg-slate-900/10 dark:hover:bg-slate-700/80 border border-slate-900/10 dark:border-slate-700/60 rounded-full transition-all whitespace-nowrap shrink-0 shadow-2xs"
                  >
                    <div className="text-right hidden lg:block">
                      <div className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[100px]">
                        {user.name}
                      </div>
                      <div className="text-[10px] opacity-70 text-slate-600 dark:text-slate-300 truncate max-w-[100px] capitalize">
                        {user.role}
                      </div>
                    </div>
                    <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 ${
                      user.role === 'technician' ? 'bg-blue-600' : user.role === 'admin' ? 'bg-emerald-600' : 'bg-purple-600'
                    }`}>
                      {user.name ? user.name.charAt(0) : 'U'}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {userDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={closeAllDropdowns}
                      />
                      <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150 transition-colors">
                        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-bold text-slate-900 dark:text-white">{user.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{user.department}</p>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>PBKDF2</span>
                          </span>
                        </div>

                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 text-[11px] border-b border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Peran Server:</span>
                            <span className="font-bold text-slate-900 dark:text-white font-mono text-[10px] bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 rounded">{user.role.toUpperCase()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Status Akun:</span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold font-mono bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded text-[10px]">
                              {user.status}
                            </span>
                          </div>
                        </div>

                        {/* Theme Selector inside User Dropdown */}
                        <ThemeSelector variant="compact" />

                        <div className="py-1 px-1">
                          <button
                            onClick={() => {
                              closeAllDropdowns();
                              onOpenUserModal();
                            }}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg transition-colors font-medium text-slate-800 dark:text-slate-200"
                          >
                            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span>Matriks Wewenang &amp; Kelola Akun</span>
                          </button>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5 px-3 py-1.5 space-y-1">
                          <button
                            onClick={() => {
                              closeAllDropdowns();
                              handleExportExcelQuick();
                            }}
                            className="w-full text-left py-1 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold flex items-center gap-1.5"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Ekspor Katalog ke Excel (.xlsx)</span>
                          </button>
                          <button
                            onClick={() => {
                              closeAllDropdowns();
                              onOpenDownload();
                            }}
                            className="w-full text-left py-1 text-xs text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-semibold flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download ZIP Project</span>
                          </button>

                          <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1">
                            <button
                              onClick={() => {
                                closeAllDropdowns();
                                logout();
                              }}
                              className="w-full text-left py-1.5 px-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg font-semibold flex items-center justify-between transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                                <span>Keluar (Logout)</span>
                              </div>
                              <span className="text-[10px] text-rose-400 font-normal">Akhiri Sesi</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* NATIVE MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-1 px-1 shadow-lg no-print transition-colors"
        aria-label="Navigasi Bawah Smartphone"
      >
        {PRIMARY_TABS.filter(tab => tab.showOnMobile).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 text-[11px] font-medium transition-colors ${
                tab.id === 'catalog' ? 'relative ' : ''
              }${
                isActive ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>{tab.mobileLabel}</span>
              {tab.id === 'catalog' && lowOrOutCount > 0 && (
                <span className="absolute top-1 right-3.5 w-2 h-2 rounded-full bg-amber-500"></span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
