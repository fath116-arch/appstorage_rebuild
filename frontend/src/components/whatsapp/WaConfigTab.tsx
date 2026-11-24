/**
 * WhatsApp Config, 4-Slot Recipients & Developer-Only Dual Gateways Tab
 */

import React from 'react';
import { Clock, X, Send, BellRing, ServerCog } from 'lucide-react';
import {
  MAX_WA_RECIPIENT_SLOTS,
  normalizeWaRecipientSlots,
  WaGatewayConfig,
  WaRecipientSlot,
  WhatsAppConfigData
} from '../../services/whatsappService';
import { useToast } from '../../context/ToastContext';

interface WaConfigTabProps {
  config: WhatsAppConfigData;
  setConfig: React.Dispatch<React.SetStateAction<WhatsAppConfigData>>;
  canEdit: boolean;
  canManageCredentials: boolean; // Developer-only
  loading: boolean;
  testing: boolean;
  testingGateway?: 'gateway1' | 'gateway2' | null;
  testResult: string | null;
  onSaveConfig: (e: React.FormEvent) => Promise<void>;
  onTestConnection: () => Promise<void>;
  onTestGateway?: (gatewayId: 'gateway1' | 'gateway2') => Promise<void>;
  onDispatchAlert: () => Promise<void>;
}

const DEFAULT_GATEWAY_1: WaGatewayConfig = {
  id: 'gateway1',
  name: 'Gateway 1 (Utama)',
  provider: 'fonnte',
  enabled: true,
  apiUrl: 'https://api.fonnte.com/send',
  apiToken: '',
  maskedToken: '',
};

const DEFAULT_GATEWAY_2: WaGatewayConfig = {
  id: 'gateway2',
  name: 'Gateway 2 (Cadangan)',
  provider: 'fonnte',
  enabled: false,
  apiUrl: 'https://api.fonnte.com/send',
  apiToken: '',
  maskedToken: '',
};

export const WaConfigTab: React.FC<WaConfigTabProps> = ({
  config,
  setConfig,
  canEdit,
  canManageCredentials,
  loading,
  testing,
  testingGateway = null,
  testResult,
  onSaveConfig,
  onTestConnection,
  onTestGateway,
  onDispatchAlert
}) => {
  const { showToast } = useToast();

  const slots = normalizeWaRecipientSlots(config.recipientSlots, config.recipients);
  const activeSlotCount = slots.filter((s) => s.enabled && s.number.trim().length > 0).length;

  const gateways = {
    gateway1: { ...DEFAULT_GATEWAY_1, ...(config.gateways?.gateway1 || {}) },
    gateway2: { ...DEFAULT_GATEWAY_2, ...(config.gateways?.gateway2 || {}) },
  };
  const gatewayMode: 'failover' | 'parallel' = config.gatewayMode === 'parallel' ? 'parallel' : 'failover';

  const handleGatewayPatch = (gwId: 'gateway1' | 'gateway2', patch: Partial<WaGatewayConfig>) => {
    setConfig((prev) => {
      const currentGw1 = { ...DEFAULT_GATEWAY_1, ...(prev.gateways?.gateway1 || {}) };
      const currentGw2 = { ...DEFAULT_GATEWAY_2, ...(prev.gateways?.gateway2 || {}) };
      return {
        ...prev,
        gateways: {
          gateway1: gwId === 'gateway1' ? { ...currentGw1, ...patch } : currentGw1,
          gateway2: gwId === 'gateway2' ? { ...currentGw2, ...patch } : currentGw2,
        }
      };
    });
  };

  const commitSlots = (nextSlots: WaRecipientSlot[]) => {
    const activeRecipients = nextSlots
      .filter((s) => s.enabled && s.number.trim().length > 0)
      .map((s) => s.number.trim());
    setConfig((prev) => ({
      ...prev,
      recipientSlots: nextSlots,
      recipients: activeRecipients,
    }));
  };

  const handleSlotChange = (index: number, patch: Partial<WaRecipientSlot>) => {
    const updated = slots.map((s, idx) => (idx === index ? { ...s, ...patch } : s));

    if (patch.number !== undefined) {
      const candidate = patch.number.trim();
      if (candidate) {
        const duplicateIdx = updated.findIndex(
          (s, idx) => idx !== index && s.number.trim() === candidate
        );
        if (duplicateIdx !== -1) {
          showToast(`Nomor "${candidate}" sudah digunakan di Slot ${duplicateIdx + 1}.`, 'warning');
          return;
        }
        if (!slots[index].number.trim() && patch.enabled === undefined) {
          updated[index] = { ...updated[index], enabled: true };
        }
      } else {
        updated[index] = { ...updated[index], enabled: false };
      }
    }

    commitSlots(updated);
  };

  const handleClearSlot = (index: number) => {
    const updated = slots.map((s, idx) =>
      idx === index ? { ...s, label: '', number: '', enabled: false } : s
    );
    commitSlots(updated);
  };

  return (
    <form onSubmit={onSaveConfig} className="space-y-5">
      {/* Saklar Master & Cooldown Strip */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Status Otomasi WhatsApp Alert
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Saklar utama pengiriman alert stok otomatis &amp; notifikasi pengajuan pembelian barang.
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

      {/* Tiga Jenis Pesan Otomatis */}
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

      {/* 4 Slot Penerima WhatsApp dengan Saklar ON/OFF Individual */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Nomor Penerima WhatsApp (Maksimal {MAX_WA_RECIPIENT_SLOTS} Nomor)
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Mendukung nomor HP (<code>0812...</code>) maupun ID Grup WhatsApp (<code>1203630...@g.us</code>). Hanya slot bersaklar ON yang menerima notifikasi.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
            {activeSlotCount} dari {MAX_WA_RECIPIENT_SLOTS} slot aktif
          </span>
        </div>

        <div className="space-y-2.5 pt-1">
          {slots.map((slot, idx) => {
            const hasNumber = slot.number.trim().length > 0;
            const isSlotOn = slot.enabled && hasNumber;
            return (
              <div
                key={slot.slot}
                className={`p-3 rounded-lg border transition-colors bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center gap-2.5 ${
                  isSlotOn
                    ? 'border-emerald-200 dark:border-emerald-800/80'
                    : 'border-slate-200 dark:border-slate-700/80 opacity-85'
                }`}
              >
                <div className="flex items-center justify-between sm:w-20 shrink-0">
                  <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Slot {slot.slot}
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={`Label (misal: Gudang / Purchasing ${slot.slot})`}
                    value={slot.label}
                    onChange={(e) => handleSlotChange(idx, { label: e.target.value })}
                    disabled={!canEdit}
                    className="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white disabled:opacity-60"
                  />
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="0812xxxxxxxx atau ID Grup @g.us"
                      value={slot.number}
                      onChange={(e) => handleSlotChange(idx, { number: e.target.value })}
                      disabled={!canEdit}
                      className="w-full py-1.5 pl-2.5 pr-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono tabular-nums text-slate-900 dark:text-white disabled:opacity-60"
                    />
                    {canEdit && (hasNumber || slot.label) && (
                      <button
                        type="button"
                        onClick={() => handleClearSlot(idx)}
                        title={`Kosongkan Slot ${slot.slot}`}
                        className="absolute right-2 text-slate-400 hover:text-rose-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-2 justify-end">
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(e) => handleSlotChange(idx, { enabled: e.target.checked })}
                    disabled={!canEdit || !hasNumber}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                  <span className="ml-2 font-mono text-[11px] font-bold w-8 text-slate-700 dark:text-slate-300">
                    {isSlotOn ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Developer-Only Dual WhatsApp Gateways (Gateway 1 & Gateway 2 + Mode) */}
      {canManageCredentials && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                <ServerCog className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Dual Gateway Notifikasi WhatsApp (Khusus Developer)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Aktifkan Gateway 1 dan/atau Gateway 2 dengan saklar ON/OFF. Token disimpan aman di server dan tidak ditampilkan ke Admin/Teknisi.
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Mode Pengiriman
              </label>
              <select
                value={gatewayMode}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    gatewayMode: e.target.value === 'parallel' ? 'parallel' : 'failover'
                  }))
                }
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="failover">Failover Otomatis (GW1 -&gt; GW2)</option>
                <option value="parallel">Kirim Paralel (Keduanya Aktif)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(['gateway1', 'gateway2'] as const).map((gwId, idx) => {
              const gw = gateways[gwId];
              const isTestingThis = testingGateway === gwId;
              return (
                <div
                  key={gwId}
                  className={`p-3.5 rounded-xl border bg-white dark:bg-slate-900 space-y-3 transition-colors ${
                    gw.enabled
                      ? 'border-emerald-200 dark:border-emerald-800/80'
                      : 'border-slate-200 dark:border-slate-700/80 opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        Gateway {idx + 1} {idx === 0 ? '(Utama)' : '(Cadangan)'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {gw.provider.toUpperCase()}
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gw.enabled}
                        onChange={(e) => handleGatewayPatch(gwId, { enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                      <span className="ml-2 font-mono text-[11px] font-bold w-8 text-slate-700 dark:text-slate-300">
                        {gw.enabled ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nama Gateway
                      </label>
                      <input
                        type="text"
                        value={gw.name}
                        onChange={(e) => handleGatewayPatch(gwId, { name: e.target.value })}
                        placeholder={`Gateway ${idx + 1}`}
                        className="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Provider
                      </label>
                      <select
                        value={gw.provider}
                        onChange={(e) =>
                          handleGatewayPatch(gwId, {
                            provider: e.target.value as 'fonnte' | 'wablas' | 'webhook'
                          })
                        }
                        className="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      >
                        <option value="fonnte">Fonnte</option>
                        <option value="wablas">Wablas</option>
                        <option value="webhook">Webhook JSON</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Endpoint URL Gateway {idx + 1}
                    </label>
                    <input
                      type="url"
                      value={gw.apiUrl}
                      onChange={(e) => handleGatewayPatch(gwId, { apiUrl: e.target.value })}
                      placeholder="https://api.fonnte.com/send"
                      className="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Token / Secret Gateway {idx + 1}
                    </label>
                    <input
                      type="password"
                      placeholder={gw.maskedToken || `Masukkan token Gateway ${idx + 1}...`}
                      value={gw.apiToken}
                      onChange={(e) => handleGatewayPatch(gwId, { apiToken: e.target.value })}
                      className="w-full py-1.5 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  {onTestGateway && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onTestGateway(gwId)}
                        disabled={isTestingThis || !gw.enabled}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>{isTestingThis ? 'Menguji...' : `Uji Gateway ${idx + 1}`}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={onTestConnection}
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
              onClick={onDispatchAlert}
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
  );
};

