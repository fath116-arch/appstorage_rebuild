/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
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
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  Printer
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { exportInventoryToExcel } from '../utils/excelExporter';
import { PWAInstallButton } from './PWAInstallButton';

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
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenChecklist, 
  onOpenUserModal, 
  onOpenDownload,
  onOpenGoLive,
  onOpenMobileAccess,
  onOpenWhatsApp,
  onOpenSecurityReport,
  onOpenRestore,
  onOpenLabelPrint
}) => {
  const { 
    activeTab, 
    setActiveTab, 
    items,
    refreshData,
    showToast,
    VERSION,
  } = useInventory();
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode } = useTheme();

  const isDevOrAdmin = user?.role === 'developer' || user?.role === 'admin';

  // Dropdown states
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

  // Expanded sub-dropdown sections in master menu
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

  // Calculate low & out of stock
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
    } catch (e: any) {
      showToast('Gagal menyinkronkan data: ' + e.message, 'error');
    }
  };

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
                className="flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-900/5 dark:hover:bg-slate-800/60 transition-all group border border-transparent"
                aria-label="Buka Menu Dropdown Aplikasi"
                title="Klik untuk membuka Menu Navigasi & Kelompok Fitur"
              >
                <img 
                  src="/assets/logo-full.webp" 
                  alt="FieldOps IT ASSET & INVENTORY" 
                  className="h-8 sm:h-9 w-auto object-contain max-w-[200px] sm:max-w-[260px] dark:brightness-110 group-hover:scale-[1.02] transition-transform" 
                />
                <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${appMenuOpen ? 'rotate-180 text-slate-900 dark:text-white' : 'group-hover:text-slate-900 dark:group-hover:text-white'}`} />
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
                            <button
                              onClick={() => { setActiveTab('catalog'); closeAllDropdowns(); }}
                              className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                activeTab === 'catalog' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                <span>Katalog Inventaris</span>
                              </div>
                              {lowOrOutCount > 0 && (
                                <span className="text-[10px] font-mono font-bold bg-amber-500 text-white px-1.5 py-0.2 rounded-full">
                                  {lowOrOutCount} alert
                                </span>
                              )}
                            </button>

                            <button
                              onClick={() => { setActiveTab('inout'); closeAllDropdowns(); }}
                              className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                                activeTab === 'inout' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                              }`}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Barang Masuk / Keluar</span>
                            </button>

                            <button
                              onClick={() => { setActiveTab('categories'); closeAllDropdowns(); }}
                              className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                                activeTab === 'categories' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                              }`}
                            >
                              <Boxes className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>Kategori &amp; Lokasi Rak</span>
                            </button>
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
                            <button
                              onClick={() => { setActiveTab('weekly-report'); closeAllDropdowns(); }}
                              className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                                activeTab === 'weekly-report' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Laporan Pergerakan Mingguan</span>
                            </button>

                            <button
                              onClick={() => { setActiveTab('integration'); closeAllDropdowns(); }}
                              className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                                activeTab === 'integration' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                              }`}
                            >
                              <Webhook className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              <span>Integrasi Tiket Lapangan</span>
                            </button>

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
                            {isDevOrAdmin && (
                              <button
                                onClick={() => { closeAllDropdowns(); onOpenSecurityReport?.(); }}
                                className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-700/60 font-medium"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Laporan Keamanan Audit</span>
                              </button>
                            )}

                            <button
                              onClick={() => { closeAllDropdowns(); onOpenWhatsApp?.(); }}
                              className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700/60 font-medium"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Notifikasi WA Stok Menipis</span>
                            </button>

                            <button
                              onClick={() => { closeAllDropdowns(); handleExportExcelQuick(); }}
                              className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700/60 font-medium"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Ekspor Katalog Excel (.xlsx)</span>
                            </button>

                            <button
                              onClick={() => { closeAllDropdowns(); onOpenLabelPrint?.(); }}
                              className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700/60 font-medium"
                            >
                              <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Cetak Label Batch A4</span>
                            </button>

                            <button
                              onClick={() => { closeAllDropdowns(); onOpenMobileAccess(); }}
                              className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700/60 font-medium"
                            >
                              <Smartphone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              <span>Panduan Cloudflare &amp; Akses HP</span>
                            </button>

                            <button
                              onClick={() => { closeAllDropdowns(); onOpenDownload(); }}
                              className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700/60 font-medium"
                            >
                              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Download Source Code (.ZIP)</span>
                            </button>

                            {isDevOrAdmin && onOpenRestore && (
                              <button
                                onClick={() => { closeAllDropdowns(); onOpenRestore(); }}
                                className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700/60 font-medium"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Data Backup &amp; Restore</span>
                              </button>
                            )}
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
                    <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Pilih Mode Tampilan (Theme)</span>
                        <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded font-semibold capitalize">{themeMode}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-slate-200/80 dark:bg-slate-950 p-1 rounded-xl text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => setThemeMode('light')}
                          className={`py-1 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                            themeMode === 'light'
                              ? 'bg-white text-slate-900 font-bold shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                          title="Mode Terang (Light Mode)"
                        >
                          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Terang</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setThemeMode('dark')}
                          className={`py-1 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                            themeMode === 'dark'
                              ? 'bg-slate-900 text-white font-bold shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                          title="Mode Gelap (Dark Mode)"
                        >
                          <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Gelap</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setThemeMode('system')}
                          className={`py-1 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                            themeMode === 'system'
                              ? 'bg-white text-slate-900 font-bold shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                          title="Ikuti Sistem Perangkat (System)"
                        >
                          <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>Sistem</span>
                        </button>
                      </div>
                    </div>

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
              <button
                onClick={() => { setActiveTab('dashboard'); closeAllDropdowns(); }}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => { setActiveTab('catalog'); closeAllDropdowns(); }}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'catalog'
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-slate-800'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Katalog</span>
                {lowOrOutCount > 0 && (
                  <span className="text-[10px] font-mono font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                    {lowOrOutCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('inout'); closeAllDropdowns(); }}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'inout'
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-slate-800'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Masuk/Keluar</span>
              </button>

              <button
                onClick={() => { setActiveTab('weekly-report'); closeAllDropdowns(); }}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'weekly-report'
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Laporan</span>
              </button>
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
                  title="Menu Peralatan &amp; Tools System"
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

                      {/* Database: Developer & Admin ONLY */}
                      {isDevOrAdmin && (
                        <button
                          onClick={() => { closeAllDropdowns(); onOpenRestore?.(); }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-slate-800 dark:text-slate-200"
                        >
                          <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Database &amp; Restore</span>
                        </button>
                      )}

                      {/* Audit: Developer & Admin ONLY */}
                      {isDevOrAdmin && (
                        <button
                          onClick={() => { closeAllDropdowns(); onOpenSecurityReport?.(); }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-slate-800 dark:text-slate-200"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Laporan Keamanan Audit</span>
                        </button>
                      )}

                      {/* WA Alert: All roles */}
                      <button
                        onClick={() => { closeAllDropdowns(); onOpenWhatsApp?.(); }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-slate-800 dark:text-slate-200"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Notifikasi WA Alert</span>
                      </button>

                      {/* Akses HP: All roles */}
                      <button
                        onClick={() => { closeAllDropdowns(); onOpenMobileAccess?.(); }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-slate-800 dark:text-slate-200"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Akses HP &amp; Cloudflare</span>
                      </button>

                      {/* Ekspor Excel: All roles */}
                      <button
                        onClick={() => { closeAllDropdowns(); handleExportExcelQuick(); }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-slate-800 dark:text-slate-200"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Ekspor Katalog Excel (.xlsx)</span>
                      </button>

                      {/* Cetak Label Quick Access: All roles */}
                      <button
                        onClick={() => { closeAllDropdowns(); onOpenLabelPrint?.(); }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors font-medium text-slate-800 dark:text-slate-200"
                      >
                        <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Cetak Label Batch A4</span>
                      </button>
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
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span>Tema Tampilan</span>
                            <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1 rounded capitalize">{themeMode}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-950 p-1 rounded-lg text-[11px] font-medium">
                            <button
                              type="button"
                              onClick={() => setThemeMode('light')}
                              className={`py-0.5 px-1.5 rounded flex items-center justify-center gap-1 transition-all ${
                                themeMode === 'light' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <Sun className="w-3 h-3 text-amber-500" />
                              <span>Terang</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setThemeMode('dark')}
                              className={`py-0.5 px-1.5 rounded flex items-center justify-center gap-1 transition-all ${
                                themeMode === 'dark' ? 'bg-slate-900 text-white font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <Moon className="w-3 h-3 text-indigo-400" />
                              <span>Gelap</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setThemeMode('system')}
                              className={`py-0.5 px-1.5 rounded flex items-center justify-center gap-1 transition-all ${
                                themeMode === 'system' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <Monitor className="w-3 h-3 text-blue-500" />
                              <span>Sistem</span>
                            </button>
                          </div>
                        </div>

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
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 text-[11px] font-medium transition-colors ${
            activeTab === 'dashboard' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 mb-0.5 ${activeTab === 'dashboard' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 text-[11px] font-medium relative transition-colors ${
            activeTab === 'catalog' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package className={`w-5 h-5 mb-0.5 ${activeTab === 'catalog' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`} />
          <span>Katalog</span>
          {lowOrOutCount > 0 && (
            <span className="absolute top-1 right-3.5 w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('inout')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 text-[11px] font-medium transition-colors ${
            activeTab === 'inout' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ArrowLeftRight className={`w-5 h-5 mb-0.5 ${activeTab === 'inout' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`} />
          <span>Masuk/Keluar</span>
        </button>

        <button
          onClick={() => setActiveTab('weekly-report')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 text-[11px] font-medium transition-colors ${
            activeTab === 'weekly-report' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className={`w-5 h-5 mb-0.5 ${activeTab === 'weekly-report' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`} />
          <span>Laporan</span>
        </button>

        <button
          onClick={() => setActiveTab('integration')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 text-[11px] font-medium transition-colors ${
            activeTab === 'integration' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Webhook className={`w-5 h-5 mb-0.5 ${activeTab === 'integration' ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`} />
          <span>Integrasi</span>
        </button>
      </nav>
    </>
  );
};
