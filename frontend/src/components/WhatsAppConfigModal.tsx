/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * WhatsApp Gateway Configuration & Multi-Tier Watchlist Modal
 * FieldOps IT v1.2.5 Paket 6:
 * - Ambang Berjenjang (Tipe > Produk > Global)
 * - Daftar Pantauan (Watchlist) & Peringatan Dini
 * - Cooldown 15 Menit di Backend & Ringkasan Konsolidasi
 * - Filter Stok Rusak (Item Rusak tidak dihitung)
 * - Role Access: Teknisi Read-Only
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { 
  whatsappService, 
  WhatsAppConfigData, 
  ThresholdMatrixItem, 
  WaLogItem 
} from '../services/whatsappService';
import { 
  X, 
  Send, 
  Settings, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  Sparkles, 
  ListFilter, 
  Clock, 
  ShieldAlert, 
  Eye, 
  Plus, 
  Trash2, 
  BellRing, 
  Lock,
  RefreshCw
} from 'lucide-react';

interface WhatsAppConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppConfigModal: React.FC<WhatsAppConfigModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const { showToast } = useInventory();

  // Role Permissions: developer, admin, warehouse_admin can edit; technician is read-only
  const canEdit = user?.role === 'developer' || user?.role === 'admin' || user?.role === 'warehouse_admin';

  const [activeTab, setActiveTab] = useState<'config' | 'thresholds' | 'logs'>('config');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Configuration state
  const [config, setConfig] = useState<WhatsAppConfigData>({
    isEnabled: true,
    cooldownMinutes: 15,
    alertOnOutOfStock: true,
    alertOnLowStock: true,
    alertOnEarlyWarning: true,
    globalLowStockThreshold: 3,
    globalEarlyWarningThreshold: 5,
    recipients: ['081290008888'],
    apiUrl: 'https://api.fonnte.com/send',
    apiToken: '',
    activeHoursStart: '',
    activeHoursEnd: ''
  });

  const [recipientInput, setRecipientInput] = useState('');
  const [thresholdMatrix, setThresholdMatrix] = useState<ThresholdMatrixItem[]>([]);
  const [logs, setLogs] = useState<WaLogItem[]>([]);
  const [filterWatchlistOnly, setFilterWatchlistOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item for custom threshold editing
  const [editingItem, setEditingItem] = useState<ThresholdMatrixItem | null>(null);
  const [customLowStock, setCustomLowStock] = useState<number | ''>('');
  const [customEarlyWarning, setCustomEarlyWarning] = useState<number | ''>('');
  const [customWatchlist, setCustomWatchlist] = useState<boolean>(false);
  const [customLevel, setCustomLevel] = useState<'tipe' | 'produk'>('tipe');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cfg, thresh, lg] = await Promise.all([
        whatsappService.getConfig(),
        whatsappService.getThresholds(),
        whatsappService.getLogs(50)
      ]);
      setConfig(cfg);
      setThresholdMatrix(thresh);
      setLogs(lg);
    } catch {
      showToast('Gagal memuat data konfigurasi WhatsApp.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  // Add Recipient (Deduplicated)
  const handleAddRecipient = () => {
    const clean = recipientInput.trim();
    if (!clean) return;

    if (config.recipients.includes(clean)) {
      showToast(`Penerima "${clean}" sudah ada di daftar.`, 'warning');
      return;
    }

    setConfig(prev => ({
      ...prev,
      recipients: [...prev.recipients, clean]
    }));
    setRecipientInput('');
  };

  const handleRemoveRecipient = (target: string) => {
    setConfig(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== target)
    }));
  };

  // Save Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      showToast('Anda tidak memiliki hak akses untuk mengubah pengaturan.', 'error');
      return;
    }

    if (config.cooldownMinutes < 1) {
      showToast('Jeda antar alert (cooldown) minimal 1 menit dan tidak boleh 0.', 'error');
      return;
    }

    setLoading(true);
    const res = await whatsappService.updateConfig(config);
    setLoading(false);

    if (res.success) {
      showToast('Konfigurasi WA Alert & Jeda 15 Menit berhasil disimpan!', 'success');
      loadData();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Test Message with Cooldown Handling
  const handleTestConnection = async () => {
    if (!canEdit) return;

    setTesting(true);
    setTestResult(null);
    const result = await whatsappService.testConnection();
    setTesting(false);

    if (result.success) {
      setTestResult(`✓ ${result.message}`);
      showToast(result.message, 'success');
      whatsappService.getLogs().then(setLogs);
    } else {
      setTestResult(`✗ ${result.message}`);
      showToast(result.message, 'error');
    }
  };

  // Dispatch Consolidated Alert
  const handleDispatchConsolidatedAlert = async () => {
    if (!canEdit) return;

    setLoading(true);
    const res = await whatsappService.sendConsolidatedAlert(true);
    setLoading(false);

    if (res.sent) {
      showToast(res.message || 'Ringkasan alert berhasil dikirim!', 'success');
      loadData();
    } else if (res.inCooldown) {
      showToast(res.message || 'Jeda pengiriman 15 menit masih aktif.', 'warning');
    } else {
      showToast(res.message || 'Gagal memicu pengiriman alert.', 'info');
    }
  };

  // Open Edit Threshold Modal
  const handleOpenEditThreshold = (item: ThresholdMatrixItem) => {
    if (!canEdit) return;
    setEditingItem(item);
    setCustomLevel('tipe');
    setCustomLowStock(item.lowStockThreshold);
    setCustomEarlyWarning(item.earlyWarningThreshold);
    setCustomWatchlist(item.isWatchlist);
  };

  // Save Custom Threshold
  const handleSaveCustomThreshold = async () => {
    if (!editingItem || !canEdit) return;

    const targetId = customLevel === 'tipe' ? editingItem.tipeId : editingItem.produkId;
    const res = await whatsappService.setThreshold({
      level: customLevel,
      targetId,
      lowStockThreshold: customLowStock === '' ? null : Number(customLowStock),
      earlyWarningThreshold: customEarlyWarning === '' ? null : Number(customEarlyWarning),
      isWatchlist: customWatchlist
    });

    if (res.success) {
      showToast(`Ambang khusus (${customLevel}) berhasil disimpan!`, 'success');
      setEditingItem(null);
      loadData();
    } else {
      showToast(res.message, 'error');
    }
  };

  // Filter Threshold Items
  const filteredThresholdItems = thresholdMatrix.filter(it => {
    if (filterWatchlistOnly && !it.isWatchlist) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        it.produkNama.toLowerCase().includes(q) ||
        it.tipeNama.toLowerCase().includes(q) ||
        it.kodeTipe.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Pengaturan WhatsApp Alert (Gateway Fonnte)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ambang Berjenjang (Tipe &gt; Produk &gt; Global), Jeda 15 Menit, dan Daftar Pantauan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Warning Banner if Technician (Read-Only) */}
        {!canEdit && (
          <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 shrink-0">
            <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Peran Anda saat ini (<strong className="font-semibold">{user?.role}</strong>) hanya diizinkan untuk melihat riwayat log WhatsApp (Read-Only). Pengaturan dilindungi untuk Developer, Admin, dan Admin Gudang.
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900 shrink-0">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Pengaturan &amp; Jeda 15 Menit</span>
          </button>

          <button
            onClick={() => setActiveTab('thresholds')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'thresholds'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Ambang Berjenjang &amp; Daftar Pantauan</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Pengiriman ({logs.length})</span>
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-5">
          
          {/* TAB 1: CONFIGURATION & COOLDOWN */}
          {activeTab === 'config' && (
            <form onSubmit={handleSaveConfig} className="space-y-5">
              
              {/* Saklar Master & Cooldown Strip */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      Status Otomasi WhatsApp Gateway
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                      Saklar utama pengiriman alert otomatis saat ada mutasi stok atau request disetujui.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.isEnabled}
                      onChange={e => setConfig(prev => ({ ...prev, isEnabled: e.target.checked }))}
                      disabled={!canEdit}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                    <span className="ml-2.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      {config.isEnabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  {/* Cooldown 15 Menit */}
                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Jeda Minimum Antar Alert (Menit) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={config.cooldownMinutes}
                        onChange={e => setConfig(prev => ({ ...prev, cooldownMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                        disabled={!canEdit}
                        required
                        className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      />
                      <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Default 15 menit (tidak boleh 0). Seluruh alert dalam rentang ini digabung jadi 1 pesan ringkasan.
                    </span>
                  </div>

                  {/* Jam Aktif Pengiriman Opsional */}
                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Jam Aktif Pengiriman (Opsional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={config.activeHoursStart || ''}
                        onChange={e => setConfig(prev => ({ ...prev, activeHoursStart: e.target.value }))}
                        disabled={!canEdit}
                        className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <input
                        type="time"
                        value={config.activeHoursEnd || ''}
                        onChange={e => setConfig(prev => ({ ...prev, activeHoursEnd: e.target.value }))}
                        disabled={!canEdit}
                        className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Kosongkan untuk mengizinkan pengiriman 24 jam penuh.
                    </span>
                  </div>
                </div>
              </div>

              {/* Tiga Jenis Pesan Otomatis (Checkbox Kejadian) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Kejadian Alert yang Dikirim (Otomatis dari Data Stok)
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Pesan disusun murni dari data stok tanpa teks bebas. Item berkondisi Rusak tidak dihitung sebagai stok tersedia.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.alertOnOutOfStock}
                      onChange={e => setConfig(prev => ({ ...prev, alertOnOutOfStock: e.target.checked }))}
                      disabled={!canEdit}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">🚨 Stok Habis</span>
                      <span className="text-[11px] text-slate-500">Stok fisik tersedia = 0 unit</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.alertOnLowStock}
                      onChange={e => setConfig(prev => ({ ...prev, alertOnLowStock: e.target.checked }))}
                      disabled={!canEdit}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">⚠️ Stok Menipis</span>
                      <span className="text-[11px] text-slate-500">Stok &le; ambang batas menipis</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.alertOnEarlyWarning}
                      onChange={e => setConfig(prev => ({ ...prev, alertOnEarlyWarning: e.target.checked }))}
                      disabled={!canEdit}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">ℹ️ Peringatan Dini</span>
                      <span className="text-[11px] text-slate-500">Khusus barang di daftar pantauan</span>
                    </div>
                  </label>
                </div>

                {/* Nilai Ambang Global Bawaan */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Ambang Menipis Global Bawaan
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.globalLowStockThreshold}
                      onChange={e => setConfig(prev => ({ ...prev, globalLowStockThreshold: Math.max(1, parseInt(e.target.value) || 1) }))}
                      disabled={!canEdit}
                      className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Dipakai bila produk &amp; tipe tidak memiliki ambang khusus.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Ambang Peringatan Dini Global Bawaan
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.globalEarlyWarningThreshold}
                      onChange={e => setConfig(prev => ({ ...prev, globalEarlyWarningThreshold: Math.max(1, parseInt(e.target.value) || 1) }))}
                      disabled={!canEdit}
                      className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Dipakai untuk item daftar pantauan yang tidak punya ambang khusus.
                    </span>
                  </div>
                </div>
              </div>

              {/* Daftar Penerima Bebas Duplikat (Grup / Nomor) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      Daftar Penerima WhatsApp (Bebas Duplikat)
                    </h3>
                    <p className="text-slate-500 text-[11px]">
                      Mendukung nomor HP individual (misal: <code>081290008888</code>) dan ID Grup WhatsApp Fonnte (misal: <code>1203630...@g.us</code>).
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {config.recipients.length} target aktif
                  </span>
                </div>

                {canEdit && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Masukkan nomor HP atau ID Grup WhatsApp Fonnte..."
                      value={recipientInput}
                      onChange={e => setRecipientInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRecipient();
                        }
                      }}
                      className="flex-1 py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddRecipient}
                      className="px-3.5 py-2 font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah</span>
                    </button>
                  </div>
                )}

                {/* Recipient Badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {config.recipients.map((rec, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      <span>{rec}</span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(rec)}
                          className="text-slate-400 hover:text-red-500 ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Fonnte API Key & Gateway URL */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Kredensial Gateway Fonnte
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Endpoint API Fonnte
                    </label>
                    <input
                      type="url"
                      value={config.apiUrl}
                      onChange={e => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                      disabled={!canEdit}
                      className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Token API Fonnte
                    </label>
                    <input
                      type="password"
                      placeholder={config.maskedToken || 'Masukkan token API Fonnte...'}
                      value={config.apiToken}
                      onChange={e => setConfig(prev => ({ ...prev, apiToken: e.target.value }))}
                      disabled={!canEdit}
                      className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Token disimpan aman dan tidak diekspos secara publik.
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testing}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{testing ? 'Menguji...' : 'Kirim Pesan Uji'}</span>
                    </button>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleDispatchConsolidatedAlert}
                      disabled={loading}
                      className="px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg flex items-center gap-1.5 transition-colors border border-emerald-200 dark:border-emerald-800"
                    >
                      <BellRing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Kirim Ringkasan Sekarang</span>
                    </button>
                  )}

                  {testResult && (
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {testResult}
                    </span>
                  )}
                </div>

                {canEdit && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg shadow-xs transition-colors"
                  >
                    {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* TAB 2: HIERARCHICAL THRESHOLDS & WATCHLIST */}
          {activeTab === 'thresholds' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Matriks Ambang Berjenjang: Tipe &gt; Produk &gt; Global
                  </h3>
                  <p className="text-slate-500 text-xs">
                    Sistem otomatis memilih ambang yang paling spesifik. Item berkondisi Rusak tidak dihitung sebagai stok tersedia.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Cari produk / tipe..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <button
                    onClick={() => setFilterWatchlistOnly(!filterWatchlistOnly)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      filterWatchlistOnly
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Daftar Pantauan Saja
                  </button>
                </div>
              </div>

              {/* Table of Resolved Thresholds */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Produk &amp; Varian Tipe</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3 text-right">Stok Tersedia</th>
                      <th className="py-2.5 px-3">Ambang Menipis</th>
                      <th className="py-2.5 px-3">Ambang Dini</th>
                      <th className="py-2.5 px-3 text-center">Daftar Pantauan</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      {canEdit && <th className="py-2.5 px-3 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredThresholdItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          Tidak ada produk atau tipe yang cocok dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredThresholdItems.map(item => (
                        <tr key={`${item.produkId}_${item.tipeId}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {item.produkNama}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {item.tipeNama} [{item.kodeTipe}]
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {item.kategoriBarang}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                            {item.availableStock} unit
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              &le; {item.lowStockThreshold}
                            </span>
                            <span className="text-[10px] text-slate-500 block italic">
                              {item.lowStockSource}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              &le; {item.earlyWarningThreshold}
                            </span>
                            <span className="text-[10px] text-slate-500 block italic">
                              {item.earlyWarningSource}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.isWatchlist ? (
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                Pantau Aktif
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`font-bold text-[11px] ${
                              item.currentStatus === 'HABIS'
                                ? 'text-red-700 dark:text-red-400'
                                : item.currentStatus === 'MENIPIS'
                                ? 'text-amber-700 dark:text-amber-400'
                                : item.currentStatus === 'PERINGATAN_DINI'
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}>
                              {item.currentStatus}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenEditThreshold(item)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded"
                              >
                                Ubah Ambang
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Edit Ambang Khusus */}
              {editingItem && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60">
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 w-full max-w-md shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        Atur Ambang Khusus: {editingItem.produkNama}
                      </h4>
                      <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block font-semibold mb-1">Tingkat Penyetelan Ambang</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setCustomLevel('tipe')}
                            className={`py-1.5 px-3 rounded text-xs font-bold border ${
                              customLevel === 'tipe'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            Per Varian Tipe ({editingItem.tipeNama})
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomLevel('produk')}
                            className={`py-1.5 px-3 rounded text-xs font-bold border ${
                              customLevel === 'produk'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            Per Produk Induk ({editingItem.produkNama})
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Ambang Stok Menipis</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Kosongkan untuk pakai global"
                          value={customLowStock}
                          onChange={e => setCustomLowStock(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-900 border rounded"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Ambang Peringatan Dini (Watchlist)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Kosongkan untuk pakai global"
                          value={customEarlyWarning}
                          onChange={e => setCustomEarlyWarning(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-900 border rounded"
                        />
                      </div>

                      <label className="flex items-center gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customWatchlist}
                          onChange={e => setCustomWatchlist(e.target.checked)}
                          className="rounded text-emerald-600"
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Masukkan ke Daftar Pantauan (Watchlist Peringatan Dini)
                        </span>
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCustomThreshold}
                        className="px-4 py-1.5 font-bold text-white bg-slate-900 dark:bg-emerald-600 rounded"
                      >
                        Simpan Ambang
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DELIVERY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Riwayat Log Pengiriman WhatsApp
                  </h3>
                  <p className="text-slate-500 text-xs">
                    Catatan pengiriman riil via Fonnte Gateway beserta pemicu dan status pengiriman.
                  </p>
                </div>
                <button
                  onClick={() => whatsappService.getLogs(50).then(setLogs)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Segarkan Log</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">Waktu</th>
                      <th className="py-2.5 px-3">Pemicu</th>
                      <th className="py-2.5 px-3">Penerima</th>
                      <th className="py-2.5 px-3">Ringkasan Pesan</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                          Belum ada riwayat pengiriman alert WhatsApp.
                        </td>
                      </tr>
                    ) : (
                      logs.map(lg => (
                        <tr key={lg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {new Date(lg.sent_at).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 font-sans">
                            {lg.trigger_type}
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate" title={lg.recipients}>
                            {lg.recipients}
                          </td>
                          <td className="py-2.5 px-3 max-w-md font-sans text-slate-700 dark:text-slate-300">
                            <div>{lg.message_snippet}</div>
                            {lg.fonnte_response && (
                              <div className="text-[10px] text-slate-400 font-mono italic">
                                Gateway: {lg.fonnte_response}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            {lg.fonnte_status === 'SUCCESS' ? (
                              <span className="text-emerald-700 dark:text-emerald-400">BERHASIL</span>
                            ) : lg.fonnte_status === 'SIMULATED' ? (
                              <span className="text-blue-700 dark:text-blue-400">SIMULASI</span>
                            ) : lg.fonnte_status === 'COOLDOWN_QUEUED' ? (
                              <span className="text-amber-700 dark:text-amber-400">DIANTREKAN</span>
                            ) : (
                              <span className="text-red-700 dark:text-red-400">GAGAL</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>FieldOps IT Fonnte Gateway Integration</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
