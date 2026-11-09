/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { 
  Webhook, 
  Key, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Code, 
  Plus, 
  Trash2, 
  Server, 
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export const TicketIntegrationHub: React.FC = () => {
  const { user } = useAuth();
  const { items, recordBatchStockOut } = useInventory();

  // Local state for API Keys
  const [apiKeys, setApiKeys] = useState<Array<{
    id: string;
    name: string;
    system: string;
    key: string;
    allowedActions: string[];
    createdAt: string;
    lastUsedAt?: string;
    isActive: boolean;
  }>>([
    {
      id: 'key-1',
      name: 'Jira Service Management Webhook',
      system: 'Jira Service Management',
      key: 'fops_live_jira_prod_9843218739120',
      allowedActions: ['inventory.read', 'tickets.consume'],
      createdAt: '2026-01-15T08:00:00.000Z',
      lastUsedAt: '2026-03-29T14:20:00.000Z',
      isActive: true,
    },
    {
      id: 'key-2',
      name: 'Zendesk Helpdesk Connector',
      system: 'Zendesk IT Support',
      key: 'fops_live_zendesk_token_77182390123',
      allowedActions: ['inventory.read', 'tickets.consume'],
      createdAt: '2026-02-01T10:30:00.000Z',
      lastUsedAt: '2026-03-28T09:15:00.000Z',
      isActive: true,
    }
  ]);

  // Local state for Integration Audit Logs
  const [integrationLogs, setIntegrationLogs] = useState<Array<{
    id: string;
    timestamp: string;
    ticketId: string;
    ticketTitle: string;
    systemName: string;
    technicianName: string;
    itemsRequested: Array<{ name: string; quantity: number }>;
    httpStatus: number;
    message: string;
  }>>([
    {
      id: 'log-1',
      timestamp: new Date().toISOString(),
      ticketId: 'TCK-2026-8812',
      ticketTitle: 'Penggantian Switch Hub Ruang IT',
      systemName: 'Jira Service Management',
      technicianName: 'Budi Santoso',
      itemsRequested: [{ name: 'Patch Cord Cat6 2m', quantity: 2 }],
      httpStatus: 200,
      message: 'Pengurangan stok berhasil dicatat otomatis.'
    }
  ]);

  const generateApiKey = (name: string, system: string, allowedActions: string[]) => {
    const newKey = {
      id: `key-${Date.now()}`,
      name,
      system,
      key: `fops_live_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`,
      allowedActions,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    setApiKeys(prev => [newKey, ...prev]);
  };

  const deleteApiKey = (id: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  const toggleApiKey = (id: string) => {
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: !k.isActive } : k));
  };

  const consumeStockFromTicket = async (data: {
    ticketId: string;
    ticketTitle: string;
    systemName: string;
    technicianName: string;
    items: Array<{ sku: string; quantity: number }>;
  }) => {
    try {
      const mappedItems = data.items.map(s => {
        const found = items.find(it => it.sku === s.sku);
        return {
          itemId: found?.id || '',
          quantity: s.quantity,
          name: found?.name || s.sku,
        };
      });

      const invalid = mappedItems.find(m => !m.itemId);
      if (invalid) {
        throw new Error(`SKU ${invalid.name} tidak ditemukan di katalog.`);
      }

      await recordBatchStockOut({
        items: mappedItems.map(m => ({ itemId: m.itemId, quantity: m.quantity })),
        referenceNumber: data.ticketId,
        recipientOrDestination: `${data.technicianName} (${data.systemName})`,
        notes: data.ticketTitle,
      });

      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ticketId: data.ticketId,
        ticketTitle: data.ticketTitle,
        systemName: data.systemName,
        technicianName: data.technicianName,
        itemsRequested: mappedItems.map(m => ({ name: m.name, quantity: m.quantity })),
        httpStatus: 200,
        message: `Stok berhasil dikurangi untuk ${mappedItems.length} jenis suku cadang.`
      };
      setIntegrationLogs(prev => [newLog, ...prev]);

      return {
        success: true,
        message: `Stok berhasil dikurangi untuk tiket ${data.ticketId}`,
        affectedItems: mappedItems,
      };
    } catch (err: any) {
      const failLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ticketId: data.ticketId,
        ticketTitle: data.ticketTitle,
        systemName: data.systemName,
        technicianName: data.technicianName,
        itemsRequested: data.items.map(i => ({ name: i.sku, quantity: i.quantity })),
        httpStatus: 400,
        message: err.message || 'Gagal memproses tiket.',
      };
      setIntegrationLogs(prev => [failLog, ...prev]);
      return {
        success: false,
        message: err.message || 'Gagal memproses tiket.',
      };
    }
  };

  // Active tab within the integration hub
  const [integrationTab, setIntegrationTab] = useState<'simulator' | 'keys' | 'docs' | 'logs'>('simulator');

  // Simulator Form State
  const [selectedSystem, setSelectedSystem] = useState('Jira Service Management');
  const [simTicketId, setSimTicketId] = useState(`TCK-2026-${Math.floor(2000 + Math.random() * 7000)}`);
  const [simTicketTitle, setSimTicketTitle] = useState('Perbaikan Jaringan LAN & Penggantian Switch di Ruang Operasional');
  const [simTechnician, setSimTechnician] = useState(user?.name || 'Budi Santoso');
  
  // Multiple parts selection for simulation
  const [simSelectedItems, setSimSelectedItems] = useState<Array<{ sku: string; quantity: number }>>([
    { sku: items[2]?.sku || 'CAB-PATCH-CAT6-2M', quantity: 2 },
  ]);

  // Simulation response banner
  const [lastSimResponse, setLastSimResponse] = useState<{
    status: 'SUCCESS' | 'FAILED';
    code: number;
    message: string;
    payload?: any;
  } | null>(null);

  // New API Key form state
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeySystem, setNewKeySystem] = useState('Zendesk IT Helpdesk');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Code snippets tab state
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'javascript' | 'python'>('curl');

  // Simulator item handlers
  const handleAddItemToSim = () => {
    const unusedItem = items.find(it => !simSelectedItems.some(s => s.sku === it.sku)) || items[0];
    if (unusedItem) {
      setSimSelectedItems(prev => [...prev, { sku: unusedItem.sku, quantity: 1 }]);
    }
  };

  const handleRemoveItemFromSim = (index: number) => {
    setSimSelectedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSimItem = (index: number, field: 'sku' | 'quantity', val: any) => {
    setSimSelectedItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (simSelectedItems.length === 0) {
      alert('Pilih minimal 1 suku cadang yang digunakan untuk tiket ini.');
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
        }
      });
      // Generate new ticket ID for next test
      setSimTicketId(`TCK-2026-${Math.floor(2000 + Math.random() * 7000)}`);
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
        }
      });
    }
  };

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    generateApiKey(newKeyName.trim(), newKeySystem, ['inventory.read', 'tickets.consume']);
    setNewKeyName('');
    setIsAddingKey(false);
  };

  const sampleActiveKey = apiKeys.find((k: any) => k.isActive)?.key || 'fops_live_sample_token_abc123';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Integrasi Eksternal</span>
              <span aria-hidden="true">·</span>
              <span>REST API & Webhook Gateway</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">Auto-Deduct Engine</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Koneksi Sistem Tiket Eksternal & API Gateway
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
              Sambungkan aplikasi ini ke helpdesk eksternal seperti Jira Service Management, Zendesk, atau GLPI. Stok barang dapat otomatis berkurang seketika saat tiket perbaikan dinyatakan selesai oleh teknisi di lapangan.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs font-medium self-start md:self-auto shrink-0">
            <button
              onClick={() => setIntegrationTab('simulator')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                integrationTab === 'simulator' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Simulasi Langsung
            </button>
            <button
              onClick={() => setIntegrationTab('keys')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                integrationTab === 'keys' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              API Keys ({apiKeys.length})
            </button>
            <button
              onClick={() => setIntegrationTab('docs')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                integrationTab === 'docs' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Dokumentasi API
            </button>
            <button
              onClick={() => setIntegrationTab('logs')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                integrationTab === 'logs' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Audit Log ({integrationLogs.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: INTERACTIVE LIVE TICKET SIMULATOR */}
      {integrationTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interactive Input Form */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Simulasi Auto-Deduct Tiket Lapangan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Uji langsung payload tiket perbaikan untuk memotong stok suku cadang secara otomatis.
              </p>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Sistem Tiket Sumber
                  </label>
                  <select
                    value={selectedSystem}
                    onChange={(e) => setSelectedSystem(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                  >
                    <option value="Jira Service Management">Jira Service Management (Cloud)</option>
                    <option value="Zendesk IT Support">Zendesk Helpdesk</option>
                    <option value="GLPI Helpdesk On-Prem">GLPI IT Asset Management</option>
                    <option value="ServiceNow Incident API">ServiceNow Incident</option>
                    <option value="Aplikasi Custom IT Internal">Aplikasi Mobile Teknisi In-House</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nomor Tiket Insiden
                  </label>
                  <input
                    type="text"
                    value={simTicketId}
                    onChange={(e) => setSimTicketId(e.target.value)}
                    required
                    className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi / Judul Tiket Perbaikan
                </label>
                <input
                  type="text"
                  value={simTicketTitle}
                  onChange={(e) => setSimTicketTitle(e.target.value)}
                  required
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Teknisi yang Mengerjakan
                </label>
                <input
                  type="text"
                  value={simTechnician}
                  onChange={(e) => setSimTechnician(e.target.value)}
                  placeholder="Nama Teknisi Lapangan"
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                />
              </div>

              {/* Items consumed list */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-800 dark:text-slate-200">
                    Suku Cadang yang Digunakan pada Tiket Ini
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemToSim}
                    className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-0.5 rounded"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Barang</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  {simSelectedItems.map((selected, idx) => {
                    const currentObj = items.find(it => it.sku === selected.sku);
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <select
                          value={selected.sku}
                          onChange={(e) => handleUpdateSimItem(idx, 'sku', e.target.value)}
                          className="flex-1 py-1 px-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none"
                        >
                          {items.map(it => (
                            <option key={it.id} value={it.sku}>
                              [{it.sku}] {it.name} (Tersedia: {it.quantity} {it.unit})
                            </option>
                          ))}
                        </select>

                        <div className="w-20 shrink-0 flex items-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={selected.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              handleUpdateSimItem(idx, 'quantity', val === '' ? 1 : Math.max(1, parseInt(val, 10)));
                            }}
                            onBlur={() => {
                              if (!selected.quantity || selected.quantity <= 0) {
                                handleUpdateSimItem(idx, 'quantity', 1);
                              }
                            }}
                            className="w-full py-1 px-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none"
                          />
                        </div>

                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-sans w-12 text-left">
                          {currentObj?.unit || 'unit'}
                        </span>

                        {simSelectedItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromSim(idx)}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-rose-400 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit simulation button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Sinyal Tiket & Potong Stok Otomatis</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Live API Response & Simulation Inspector */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    Live Response Inspector
                  </span>
                </div>
                {lastSimResponse && (
                  <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                    lastSimResponse.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
                  }`}>
                    HTTP {lastSimResponse.code}
                  </span>
                )}
              </div>

              {lastSimResponse ? (
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                    lastSimResponse.status === 'SUCCESS' ? 'bg-emerald-900/30 border border-emerald-800/60 text-emerald-300' : 'bg-red-900/30 border border-red-800/60 text-red-300'
                  }`}>
                    {lastSimResponse.message}
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block mb-1">JSON Response Payload:</span>
                    <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56 leading-tight border border-slate-800">
                      {JSON.stringify(lastSimResponse.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <Server className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="font-medium">Menunggu Permintaan Tiket</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Isi formulir di sebelah kiri dan klik tombol simulasi untuk melihat respons API dan verifikasi pengurangan stok fisik secara real-time.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Helper */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Bagaimana Cara Kerjanya di Lapangan?</span>
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                1. Teknisi menyelesaikan tiket di Jira/Zendesk dan mencentang sparepart yang terpakai.<br/>
                2. Sistem tiket mengirim webhook HTTP POST ke endpoint inventori.<br/>
                3. Inventori memeriksa ketersediaan stok; jika ada, kuantitas dikurangi otomatis dan bukti transaksi diterbitkan tanpa perlu input manual ulang.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: API KEYS MANAGEMENT */}
      {integrationTab === 'keys' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Manajemen Kunci Akses (API Keys)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kunci otentikasi Bearer Token untuk menghubungkan ticketing sistem eksternal dengan aman.
              </p>
            </div>

            <button
              onClick={() => setIsAddingKey(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Buat API Key Baru</span>
            </button>
          </div>

          {/* Add Key Modal / Form */}
          {isAddingKey && (
            <form onSubmit={handleCreateApiKey} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs animate-in fade-in">
              <h3 className="font-bold text-slate-900 dark:text-white">Generate Token API Baru</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Aplikasi / Deskripsi Kunci</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Zendesk Production Webhook"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Target Sistem Tiket</label>
                  <select
                    value={newKeySystem}
                    onChange={(e) => setNewKeySystem(e.target.value)}
                    className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                  >
                    <option value="Jira Service Management">Jira Service Management</option>
                    <option value="Zendesk IT Helpdesk">Zendesk IT Helpdesk</option>
                    <option value="GLPI IT Support">GLPI IT Support</option>
                    <option value="ServiceNow">ServiceNow</option>
                    <option value="Custom In-House Script">Custom In-House Script</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingKey(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-md font-semibold"
                >
                  Buat Kunci Sekarang
                </button>
              </div>
            </form>
          )}

          {/* List of Keys */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                <tr>
                  <th className="py-3 px-4">Nama Token & Sistem</th>
                  <th className="py-3 px-4">API Token Key</th>
                  <th className="py-3 px-4">Hak Akses</th>
                  <th className="py-3 px-4">Terakhir Digunakan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {apiKeys.map((key: any) => (
                  <tr key={key.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{key.name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{key.system}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-[11px]">
                          {key.key.slice(0, 14)}••••••••••
                        </span>
                        <button
                          onClick={() => handleCopyKey(key.key, key.id)}
                          className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white rounded"
                          title="Salin Kunci Lengkap"
                        >
                          {copiedKeyId === key.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {key.allowedActions.map((act: any) => (
                          <span key={act} className="font-mono text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                            {act}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString('id-ID') : 'Belum dipakai'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleApiKey(key.id)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
                          key.isActive ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {key.isActive ? 'AKTIF' : 'NONAKTIF'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => deleteApiKey(key.id)}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-rose-400 rounded transition-colors"
                        title="Hapus API Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REST API DOCUMENTATION & SNIPPETS */}
      {integrationTab === 'docs' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-6 text-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Dokumentasi REST API & Webhook Terbuka
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Spesifikasi endpoint untuk sistem tiket eksternal guna memanggil pengurangan stok inventori secara terprogram.
            </p>
          </div>

          {/* Endpoint 1: POST /api/v1/tickets/consume */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 font-mono font-bold text-white bg-blue-600 rounded text-[11px]">
                POST
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                /api/v1/tickets/consume-part
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                (Kurangi stok barang saat tiket ditutup)
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300">
              Dipanggil oleh webhook sistem tiket (Jira/Zendesk) saat tiket beralih ke status <strong>Resolved</strong> atau <strong>Closed</strong> dengan menyertakan SKU dan kuantitas barang yang dipakai.
            </p>

            {/* Language Switcher */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => setActiveCodeLang('curl')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono ${activeCodeLang === 'curl' ? 'bg-slate-900 dark:bg-emerald-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveCodeLang('javascript')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono ${activeCodeLang === 'javascript' ? 'bg-slate-900 dark:bg-emerald-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              >
                JavaScript (Fetch)
              </button>
              <button
                onClick={() => setActiveCodeLang('python')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono ${activeCodeLang === 'python' ? 'bg-slate-900 dark:bg-emerald-600 text-white font-bold' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              >
                Python
              </button>
            </div>

            {/* Code Box */}
            <div className="relative">
              <pre className="p-3.5 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{activeCodeLang === 'curl' ? `curl -X POST "https://api.fieldops-it.internal/api/v1/tickets/consume-part" \\
  -H "Authorization: Bearer ${sampleActiveKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ticket_id": "TCK-2026-9480",
    "ticket_title": "Gangguan Koneksi LAN Ruang Direksi Lt 3",
    "system_name": "Jira Service Management",
    "technician_name": "Budi Santoso",
    "items": [
      { "sku": "CAB-PATCH-CAT6-2M", "quantity": 2 },
      { "sku": "CON-RJ45-CAT6-B100", "quantity": 1 }
    ]
  }'` : activeCodeLang === 'javascript' ? `const response = await fetch('https://api.fieldops-it.internal/api/v1/tickets/consume-part', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${sampleActiveKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ticket_id: 'TCK-2026-9480',
    ticket_title: 'Gangguan Koneksi LAN Ruang Direksi Lt 3',
    system_name: 'Zendesk IT Support',
    technician_name: 'Budi Santoso',
    items: [
      { sku: 'CAB-PATCH-CAT6-2M', quantity: 2 },
      { sku: 'CON-RJ45-CAT6-B100', quantity: 1 }
    ]
  })
});
const result = await response.json();
console.log(result);` : `import requests

url = "https://api.fieldops-it.internal/api/v1/tickets/consume-part"
headers = {
    "Authorization": "Bearer ${sampleActiveKey}",
    "Content-Type": "application/json"
}
payload = {
    "ticket_id": "TCK-2026-9480",
    "ticket_title": "Gangguan Koneksi LAN Ruang Direksi Lt 3",
    "system_name": "GLPI Helpdesk",
    "technician_name": "Budi Santoso",
    "items": [
        {"sku": "CAB-PATCH-CAT6-2M", "quantity": 2},
        {"sku": "CON-RJ45-CAT6-B100", "quantity": 1}
    ]
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())`}
              </pre>
            </div>
          </div>

          {/* Endpoint 2: GET /api/v1/inventory/status */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 font-mono font-bold text-white bg-emerald-700 rounded text-[11px]">
                GET
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                /api/v1/inventory/status?sku=CAB-UTP-CAT6-BLD
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                (Cek ketersediaan stok sebelum teknisi berangkat)
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Digunakan oleh bot helpdesk atau formulir pengajuan tiket untuk menampilkan apakah barang tersedia, menipis, atau habis secara real-time.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOG OF INTEGRATION CALLS */}
      {integrationTab === 'logs' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Log Audit Panggilan API & Webhook Eksternal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Riwayat setiap permintaan pengurangan stok yang diterima dari sistem luar beserta status respons HTTP.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">No. Tiket</th>
                  <th className="py-3 px-4">Sistem Pengirim</th>
                  <th className="py-3 px-4">Teknisi</th>
                  <th className="py-3 px-4">Suku Cadang</th>
                  <th className="py-3 px-4 text-center">Status HTTP</th>
                  <th className="py-3 px-4">Keterangan / Respons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {integrationLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">{log.ticketId}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[140px]">{log.ticketTitle}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {log.systemName}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                      {log.technicianName}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {log.itemsRequested.map((ir: any, i: number) => (
                        <div key={i} className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                          <span className="font-mono font-bold">{ir.quantity}x</span> {ir.name}
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-mono font-bold text-[11px] px-2 py-0.5 rounded ${
                        log.httpStatus === 200 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {log.httpStatus === 200 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        )}
                        {log.httpStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-[11px] max-w-xs">
                      <div className="truncate" title={log.message}>{log.message}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
