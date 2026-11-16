/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { isAdminOrDev } from '../utils/permissions';
import { apiFetch } from '../services/httpClient';
import { stockApi } from '../services/stockApi';
import { getErrorMessage } from '../utils/errorUtils';
import { formatWibDate, formatWibTimeOnly, getCurrentWibYear } from '../utils/timezone';
import {
  Send,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Plus,
  Trash2,
  Server
} from 'lucide-react';

interface TicketApiKey {
  id: string;
  name: string;
  system: string;
  key: string;
  allowedActions: string[];
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

interface BackendApiKeyRow {
  id: string;
  name: string;
  system_name: string;
  is_active: boolean | number;
  created_at: string;
  last_used_at?: string | null;
}

interface IntegrationLogItem {
  id: string;
  timestamp: string;
  ticketId: string;
  ticketTitle: string;
  systemName: string;
  technicianName: string;
  itemsRequested: Array<{ name: string; quantity: number }>;
  httpStatus: number;
  message: string;
}

interface SimAffectedItem {
  itemId: string;
  quantity: number;
  name: string;
}

type SimResponsePayload =
  | {
      ticket_id: string;
      status: 'PROCESSED_AND_DEDUCTED';
      auto_deducted: boolean;
      timestamp: string;
      items?: SimAffectedItem[];
    }
  | {
      error: string;
      ticket_id: string;
      timestamp: string;
      details: string;
    };

interface SimResponseState {
  status: 'SUCCESS' | 'FAILED';
  code: number;
  message: string;
  payload?: SimResponsePayload;
}

export const TicketIntegrationHub: React.FC = () => {
  const { user } = useAuth();
  const { products, refreshData } = useInventory();
  const { showToast } = useToast();
  const canManageKeys = isAdminOrDev(user?.role);
  const currentYear = getCurrentWibYear();

  const [apiKeys, setApiKeys] = useState<TicketApiKey[]>([]);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageKeys) return;
    let active = true;
    apiFetch<{ success: boolean; keys?: BackendApiKeyRow[] }>('/api/tickets/keys')
      .then((res) => {
        if (!active || !res.success || !Array.isArray(res.keys)) return;
        const mapped: TicketApiKey[] = res.keys.map((k) => ({
          id: k.id,
          name: k.name,
          system: k.system_name,
          key: 'fops_••••••••••••••••••••••••',
          allowedActions: ['inventory.read', 'tickets.consume'],
          createdAt: k.created_at,
          lastUsedAt: k.last_used_at || undefined,
          isActive: Boolean(k.is_active),
        }));
        setApiKeys(mapped);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [canManageKeys]);

  // Flatten canonical variants available for ticket consumption simulation
  const variantOptions = useMemo(() => {
    const list: Array<{
      sku: string;
      tipeId: number;
      boxId?: string;
      name: string;
      avail: number;
      unit: string;
    }> = [];
    for (const p of products) {
      for (const t of p.tipes || []) {
        const sku = t.prefix_id || `TIPE-${t.id}`;
        const firstBox = t.sebaran_box?.[0];
        list.push({
          sku,
          tipeId: t.id,
          boxId: firstBox?.box_id,
          name: `${p.nama} - ${t.nama_tipe}`,
          avail: Number(t.stok_tersedia || 0),
          unit: p.tipe_stok || 'unit',
        });
      }
    }
    return list;
  }, [products]);

  const [integrationLogs, setIntegrationLogs] = useState<IntegrationLogItem[]>([]);
  const [integrationTab, setIntegrationTab] = useState<'simulator' | 'keys' | 'docs' | 'logs'>('simulator');

  const [selectedSystem, setSelectedSystem] = useState('Jira Service Management');
  const [simTicketId, setSimTicketId] = useState(() => `TCK-${currentYear}-${Math.floor(2000 + Math.random() * 7000)}`);
  const [simTicketTitle, setSimTicketTitle] = useState('Perbaikan Jaringan LAN & Penggantian Perangkat di Ruang Operasional');
  const [simTechnician, setSimTechnician] = useState(user?.name || 'Teknisi Lapangan');

  const [simSelectedItems, setSimSelectedItems] = useState<Array<{ sku: string; quantity: number }>>([]);
  const [lastSimResponse, setLastSimResponse] = useState<SimResponseState | null>(null);

  useEffect(() => {
    if (simSelectedItems.length === 0 && variantOptions.length > 0) {
      const firstAvail = variantOptions.find(v => v.avail > 0) || variantOptions[0];
      if (firstAvail) {
        setSimSelectedItems([{ sku: firstAvail.sku, quantity: 1 }]);
      }
    }
  }, [variantOptions, simSelectedItems.length]);

  const [isAddingKey, setIsAddingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeySystem, setNewKeySystem] = useState('Zendesk IT Helpdesk');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'javascript' | 'python'>('curl');

  const generateApiKey = async (name: string, system: string, allowedActions: string[]) => {
    if (canManageKeys) {
      try {
        const res = await apiFetch<{
          success: boolean;
          apiKey?: string;
          keyId?: string;
        }>('/api/tickets/keys', {
          method: 'POST',
          body: JSON.stringify({ name, systemName: system }),
        });

        if (res.success && res.apiKey) {
          const newKey: TicketApiKey = {
            id: res.keyId || `key-${Date.now()}`,
            name,
            system,
            key: res.apiKey,
            allowedActions,
            createdAt: new Date().toISOString(),
            isActive: true,
          };
          setApiKeys(prev => [newKey, ...prev]);
          setNewlyCreatedKey(res.apiKey);
          showToast('API Key server berhasil dibuat. Salin token sekarang.', 'success');
          return;
        }
      } catch (err: unknown) {
        showToast(getErrorMessage(err, 'Gagal membuat API Key server.'), 'error');
      }
    }
  };

  const deleteApiKey = (id: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  const toggleApiKey = (id: string) => {
    setApiKeys(prev => prev.map(k => (k.id === id ? { ...k, isActive: !k.isActive } : k)));
  };

  const consumeStockFromTicket = async (data: {
    ticketId: string;
    ticketTitle: string;
    systemName: string;
    technicianName: string;
    items: Array<{ sku: string; quantity: number }>;
  }) => {
    try {
      const bulkItems: Array<{ tipeId: number; boxId?: string; jumlah: number }> = [];
      const affected: SimAffectedItem[] = [];

      for (const s of data.items) {
        const found = variantOptions.find(v => v.sku === s.sku);
        if (!found) {
          throw new Error(`Kode varian "${s.sku}" tidak ditemukan di katalog.`);
        }
        if (found.avail < s.quantity) {
          throw new Error(`Stok "${found.name}" tidak mencukupi (Tersedia: ${found.avail}, Diminta: ${s.quantity}).`);
        }
        bulkItems.push({ tipeId: found.tipeId, boxId: found.boxId, jumlah: s.quantity });
        affected.push({ itemId: found.sku, quantity: s.quantity, name: found.name });
      }

      await stockApi.outBulk({
        items: bulkItems,
        reference_number: data.ticketId,
        recipient_destination: `${data.technicianName} (${data.systemName})`,
        catatan: `${data.systemName}: ${data.ticketTitle}`,
      });
      await refreshData();

      const newLog: IntegrationLogItem = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ticketId: data.ticketId,
        ticketTitle: data.ticketTitle,
        systemName: data.systemName,
        technicianName: data.technicianName,
        itemsRequested: affected.map(m => ({ name: m.name, quantity: m.quantity })),
        httpStatus: 200,
        message: `Stok berhasil dikurangi untuk ${affected.length} varian suku cadang.`,
      };
      setIntegrationLogs(prev => [newLog, ...prev]);

      return {
        success: true,
        message: `Stok berhasil dikurangi untuk tiket ${data.ticketId}`,
        affectedItems: affected,
      };
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err, 'Gagal memproses tiket.');
      const failLog: IntegrationLogItem = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ticketId: data.ticketId,
        ticketTitle: data.ticketTitle,
        systemName: data.systemName,
        technicianName: data.technicianName,
        itemsRequested: data.items.map(i => ({ name: i.sku, quantity: i.quantity })),
        httpStatus: 400,
        message: errMsg,
      };
      setIntegrationLogs(prev => [failLog, ...prev]);
      return {
        success: false,
        message: errMsg,
      };
    }
  };

  const handleAddItemToSim = () => {
    const unused = variantOptions.find(v => !simSelectedItems.some(s => s.sku === v.sku)) || variantOptions[0];
    if (unused) {
      setSimSelectedItems(prev => [...prev, { sku: unused.sku, quantity: 1 }]);
    }
  };

  const handleRemoveItemFromSim = (index: number) => {
    setSimSelectedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSimItem = (index: number, field: 'sku' | 'quantity', val: string | number) => {
    setSimSelectedItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: field === 'quantity' ? Number(val) : String(val),
      };
      return copy;
    });
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (simSelectedItems.length === 0) {
      showToast('Pilih minimal 1 varian suku cadang yang digunakan untuk tiket ini.', 'warning');
      return;
    }

    const result = await consumeStockFromTicket({
      ticketId: simTicketId,
      ticketTitle: simTicketTitle,
      systemName: selectedSystem,
      technicianName: simTechnician,
      items: simSelectedItems,
    });

    if (result.success) {
      setLastSimResponse({
        status: 'SUCCESS',
        code: 200,
        message: result.message,
        payload: {
          ticket_id: simTicketId,
          status: 'PROCESSED_AND_DEDUCTED',
          auto_deducted: true,
          timestamp: new Date().toISOString(),
          items: result.affectedItems,
        },
      });
      setSimTicketId(`TCK-${currentYear}-${Math.floor(2000 + Math.random() * 7000)}`);
    } else {
      setLastSimResponse({
        status: 'FAILED',
        code: 400,
        message: result.message,
        payload: {
          error: 'INSUFFICIENT_STOCK_OR_NOT_FOUND',
          ticket_id: simTicketId,
          timestamp: new Date().toISOString(),
          details: result.message,
        },
      });
    }
  };

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    await generateApiKey(newKeyName.trim(), newKeySystem, ['inventory.read', 'tickets.consume']);
    setNewKeyName('');
    setIsAddingKey(false);
  };

  const sampleActiveKey =
    newlyCreatedKey ||
    apiKeys.find(k => k.isActive && !k.key.includes('••••'))?.key ||
    'fops_live_token_example';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Integrasi Eksternal</span>
              <span aria-hidden="true">·</span>
              <span>REST API &amp; Webhook Gateway</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">Auto-Deduct Engine</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Koneksi Sistem Tiket Eksternal &amp; API Gateway
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
              Sambungkan aplikasi ke helpdesk eksternal seperti Jira, Zendesk, atau GLPI untuk memotong stok katalog secara otomatis saat tiket ditutup.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs font-medium self-start md:self-auto shrink-0 flex-wrap">
            {([
              { id: 'simulator', label: 'Simulasi Langsung' },
              { id: 'keys', label: `API Keys (${apiKeys.length})` },
              { id: 'docs', label: 'Dokumentasi API' },
              { id: 'logs', label: `Audit Log (${integrationLogs.length})` }
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setIntegrationTab(tab.id)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  integrationTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: SIMULATOR */}
      {integrationTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Simulasi Auto-Deduct Tiket Lapangan</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Uji langsung pemotongan stok varian dari katalog tunggal.
              </p>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Sistem Tiket Sumber</label>
                  <select
                    value={selectedSystem}
                    onChange={e => setSelectedSystem(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="Jira Service Management">Jira Service Management</option>
                    <option value="Zendesk IT Support">Zendesk Helpdesk</option>
                    <option value="GLPI Helpdesk On-Prem">GLPI IT Asset Management</option>
                    <option value="ServiceNow Incident API">ServiceNow Incident</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Nomor Tiket Insiden</label>
                  <input
                    type="text"
                    value={simTicketId}
                    onChange={e => setSimTicketId(e.target.value)}
                    required
                    className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Deskripsi / Judul Tiket</label>
                <input
                  type="text"
                  value={simTicketTitle}
                  onChange={e => setSimTicketTitle(e.target.value)}
                  required
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Teknisi yang Mengerjakan</label>
                <input
                  type="text"
                  value={simTechnician}
                  onChange={e => setSimTechnician(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-800 dark:text-slate-200">
                    Varian Suku Cadang yang Digunakan
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemToSim}
                    className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Barang</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  {variantOptions.length === 0 ? (
                    <div className="p-3 text-center text-slate-400">Belum ada varian di katalog.</div>
                  ) : (
                    simSelectedItems.map((selected, idx) => {
                      const currentObj = variantOptions.find(v => v.sku === selected.sku);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs"
                        >
                          <select
                            value={selected.sku}
                            onChange={e => handleUpdateSimItem(idx, 'sku', e.target.value)}
                            className="flex-1 py-1 px-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                          >
                            {variantOptions.map(v => (
                              <option key={v.tipeId} value={v.sku}>
                                [{v.sku}] {v.name} (Tersedia: {v.avail} {v.unit})
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min={1}
                            value={selected.quantity}
                            onChange={e => handleUpdateSimItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-16 py-1 px-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                          />

                          <span className="text-[11px] text-slate-400 dark:text-slate-500 w-12 text-left">
                            {currentObj?.unit || 'unit'}
                          </span>

                          {simSelectedItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromSim(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={variantOptions.length === 0}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:bg-slate-400 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Sinyal Tiket &amp; Potong Stok</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="font-mono text-xs font-semibold text-slate-200">Live Response Inspector</span>
                </div>
                {lastSimResponse && (
                  <span
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                      lastSimResponse.status === 'SUCCESS'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-red-950 text-red-400 border border-red-800'
                    }`}
                  >
                    HTTP {lastSimResponse.code}
                  </span>
                )}
              </div>

              {lastSimResponse ? (
                <div className="space-y-3">
                  <div
                    className={`p-3 rounded-lg text-xs leading-relaxed ${
                      lastSimResponse.status === 'SUCCESS'
                        ? 'bg-emerald-900/30 border border-emerald-800/60 text-emerald-300'
                        : 'bg-red-900/30 border border-red-800/60 text-red-300'
                    }`}
                  >
                    {lastSimResponse.message}
                  </div>
                  <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56 leading-tight border border-slate-800">
                    {JSON.stringify(lastSimResponse.payload, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <Server className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="font-medium">Menunggu Permintaan Tiket</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: API KEYS */}
      {integrationTab === 'keys' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Manajemen Kunci Akses (API Keys)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bearer Token otentikasi untuk sistem helpdesk eksternal.
              </p>
            </div>
            {canManageKeys && (
              <button
                onClick={() => setIsAddingKey(true)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 rounded-lg flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Buat API Key Baru</span>
              </button>
            )}
          </div>

          {isAddingKey && (
            <form onSubmit={handleCreateApiKey} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Aplikasi / Kunci</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Zendesk Production Webhook"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Target Sistem</label>
                  <select
                    value={newKeySystem}
                    onChange={e => setNewKeySystem(e.target.value)}
                    className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="Jira Service Management">Jira Service Management</option>
                    <option value="Zendesk IT Helpdesk">Zendesk IT Helpdesk</option>
                    <option value="GLPI IT Support">GLPI IT Support</option>
                    <option value="Custom Script">Custom Script</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingKey(false)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
                >
                  Batal
                </button>
                <button type="submit" className="px-4 py-1.5 text-white bg-slate-900 dark:bg-emerald-600 rounded-md font-semibold">
                  Buat Kunci Sekarang
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                <tr>
                  <th className="py-3 px-4">Nama Token &amp; Sistem</th>
                  <th className="py-3 px-4">API Token Key</th>
                  <th className="py-3 px-4">Terakhir Digunakan (WIB)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada API Key aktif di server.
                    </td>
                  </tr>
                ) : (
                  apiKeys.map(key => (
                    <tr key={key.id}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{key.name}</div>
                        <div className="text-[11px] text-slate-400">{key.system}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-[11px]">
                            {key.key.slice(0, 14)}••••••••
                          </span>
                          <button
                            onClick={() => handleCopyKey(key.key, key.id)}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          >
                            {copiedKeyId === key.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {key.lastUsedAt ? formatWibDate(key.lastUsedAt) : 'Belum dipakai'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleApiKey(key.id)}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            key.isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
                          }`}
                        >
                          {key.isActive ? 'AKTIF' : 'NONAKTIF'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => deleteApiKey(key.id)} className="p-1 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DOCS */}
      {integrationTab === 'docs' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-6 text-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Dokumentasi REST API &amp; Webhook</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Endpoint tunggal untuk memotong stok katalog saat tiket eksternal diselesaikan.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 font-mono font-bold text-white bg-blue-600 rounded text-[11px]">POST</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">/api/tickets/consume</span>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              {(['curl', 'javascript', 'python'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => setActiveCodeLang(lang)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                    activeCodeLang === lang
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white font-bold'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <pre className="p-3.5 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{activeCodeLang === 'curl' ? `curl -X POST "https://api.fieldops-it.internal/api/tickets/consume" \\
  -H "Authorization: Bearer ${sampleActiveKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ticketId": "TCK-${currentYear}-9480",
    "ticketTitle": "Penggantian Perangkat Ruang Operasional",
    "systemName": "Jira Service Management",
    "technicianName": "Budi Santoso",
    "items": [
      { "sku": "TIPE-1", "quantity": 1 }
    ]
  }'` : activeCodeLang === 'javascript' ? `const response = await fetch('/api/tickets/consume', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${sampleActiveKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ticketId: 'TCK-${currentYear}-9480',
    ticketTitle: 'Penggantian Perangkat Ruang Operasional',
    systemName: 'Zendesk IT Support',
    technicianName: 'Budi Santoso',
    items: [{ sku: 'TIPE-1', quantity: 1 }]
  })
});` : `import requests

response = requests.post(
    "https://api.fieldops-it.internal/api/tickets/consume",
    headers={"Authorization": "Bearer ${sampleActiveKey}"},
    json={
        "ticketId": "TCK-${currentYear}-9480",
        "ticketTitle": "Penggantian Perangkat Ruang Operasional",
        "systemName": "GLPI Helpdesk",
        "technicianName": "Budi Santoso",
        "items": [{"sku": "TIPE-1", "quantity": 1}],
    },
)`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: LOGS */}
      {integrationTab === 'logs' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Log Audit Simulasi &amp; Webhook</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                <tr>
                  <th className="py-3 px-4">Waktu (WIB)</th>
                  <th className="py-3 px-4">No. Tiket</th>
                  <th className="py-3 px-4">Sistem Pengirim</th>
                  <th className="py-3 px-4">Teknisi</th>
                  <th className="py-3 px-4">Suku Cadang</th>
                  <th className="py-3 px-4 text-center">Status HTTP</th>
                  <th className="py-3 px-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {integrationLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada panggilan simulasi pada sesi ini.
                    </td>
                  </tr>
                ) : (
                  integrationLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatWibTimeOnly(log.timestamp)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{log.ticketId}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{log.ticketTitle}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{log.systemName}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">{log.technicianName}</td>
                      <td className="py-3 px-4 max-w-xs">
                        {log.itemsRequested.map((ir, i) => (
                          <div key={i} className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                            <span className="font-mono font-bold">{ir.quantity}x</span> {ir.name}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold text-[11px] ${
                            log.httpStatus === 200 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {log.httpStatus === 200 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {log.httpStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-[11px] max-w-xs truncate">
                        {log.message}
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
  );
};
