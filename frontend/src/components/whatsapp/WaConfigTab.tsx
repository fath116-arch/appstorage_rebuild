/**
 * WhatsApp Config & Cooldown Tab
 */

import React from 'react';
import { Clock, X, Send, BellRing } from 'lucide-react';
import {
  MAX_WA_RECIPIENT_SLOTS,
  normalizeWaRecipientSlots,
  WaRecipientSlot,
  WhatsAppConfigData
} from '../../services/whatsappService';
import { useToast } from '../../context/ToastContext';

interface WaConfigTabProps {
  config: WhatsAppConfigData;
  setConfig: React.Dispatch<React.SetStateAction<WhatsAppConfigData>>;
  canEdit: boolean;
  canManageCredentials: boolean;
  loading: boolean;
  testing: boolean;
  testResult: string | null;
  onSaveConfig: (e: React.FormEvent) => Promise<void>;
  onTestConnection: () => Promise<void>;
  onDispatchAlert: () => Promise<void>;
}

export const WaConfigTab: React.FC<WaConfigTabProps> = ({
  config,
  setConfig,
  canEdit,
  canManageCredentials,
  loading,
  testing,
  testResult,
  onSaveConfig,
  onTestConnection,
  onDispatchAlert
}) => {
  const { showToast } = useToast();

  const slots = normalizeWaRecipientSlots(config.recipientSlots, config.recipients);
  const activeSlotCount = slots.filter((s) => s.enabled && s.number.trim().length > 0).length;

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

    // Check duplicate phone/group number if number was changed to a non-empty value
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
        // Automatically switch ON when typing into a previously empty slot
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
              Status Otomasi WhatsApp Gateway
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

      {/* 4 Slot Penerima WhatsApp dengan Saklar ON/OFF Individual */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Nomor Penerima WhatsApp (Maksimal {MAX_WA_RECIPIENT_SLOTS} Nomor)
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Mendukung nomor HP (<code>0812...</code>) maupun ID Grup Fonnte (<code>1203630...@g.us</code>). Hanya slot bersaklar ON yang menerima notifikasi stok &amp; pengajuan pembelian.
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
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600 peer-disabled:opacity-50"></div>
                  <span className="ml-2 font-mono text-[11px] font-bold w-8 text-slate-700 dark:text-slate-300">
                    {isSlotOn ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fonnte API Key & Gateway URL (Khusus Developer & Admin) */}
      {canManageCredentials && (
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
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
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
