/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WhatsApp Gateway Configuration & Multi-Tier Watchlist Modal
 * FieldOps IT v1.2.8:
 * - Developer-Only Dual WhatsApp Gateways (Gateway 1 & Gateway 2, Failover / Parallel, ON/OFF sliders)
 * - Admin & Developer: 4-slot recipients with ON/OFF sliders, cooldown, active hours, thresholds, & watchlist
 * - Technician: Read-Only log viewer
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  whatsappService,
  WhatsAppConfigData,
  ThresholdMatrixItem,
  WaLogItem,
  WaGatewayConfig,
  normalizeWaRecipientSlots
} from '../services/whatsappService';
import { getRoleDisplayLabel, isDeveloperRole, isFeatureEnabled } from '../utils/permissions';
import { WaConfigTab } from './whatsapp/WaConfigTab';
import { WaThresholdsTab } from './whatsapp/WaThresholdsTab';
import { WaLogsTab } from './whatsapp/WaLogsTab';
import { X, Settings, History, ListFilter, BellRing, Lock } from 'lucide-react';

interface WhatsAppConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

const buildDefaultGateways = (): { gateway1: WaGatewayConfig; gateway2: WaGatewayConfig } => ({
  gateway1: {
    id: 'gateway1',
    name: 'Gateway 1 (Utama)',
    provider: 'fonnte',
    enabled: true,
    apiUrl: 'https://api.fonnte.com/send',
    apiToken: '',
    maskedToken: ''
  },
  gateway2: {
    id: 'gateway2',
    name: 'Gateway 2 (Cadangan)',
    provider: 'fonnte',
    enabled: false,
    apiUrl: 'https://api.fonnte.com/send',
    apiToken: '',
    maskedToken: ''
  }
});

export const WhatsAppConfigModal: React.FC<WhatsAppConfigModalProps> = ({
  isOpen,
  onClose,
  embedded = false
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // v1.2.8: Admin/enabled users manage 4 recipient slots + thresholds + active hours;
  // ONLY Developer can view & edit WhatsApp Gateways (gateway1 & gateway2, URL & Tokens)
  const canEdit = isFeatureEnabled(user, 'wa_alert_recipients');
  const canManageCredentials = isDeveloperRole(user?.role);

  const [activeTab, setActiveTab] = useState<'config' | 'thresholds' | 'logs'>('config');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingGateway, setTestingGateway] = useState<'gateway1' | 'gateway2' | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [config, setConfig] = useState<WhatsAppConfigData>({
    isEnabled: true,
    cooldownMinutes: 15,
    alertOnOutOfStock: true,
    alertOnLowStock: true,
    alertOnEarlyWarning: true,
    globalLowStockThreshold: 3,
    globalEarlyWarningThreshold: 5,
    recipients: ['081290008888'],
    recipientSlots: normalizeWaRecipientSlots(null, ['081290008888']),
    gatewayMode: 'failover',
    gateways: buildDefaultGateways(),
    apiUrl: 'https://api.fonnte.com/send',
    apiToken: '',
    activeHoursStart: '',
    activeHoursEnd: ''
  });

  const [thresholdMatrix, setThresholdMatrix] = useState<ThresholdMatrixItem[]>([]);
  const [logs, setLogs] = useState<WaLogItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cfg, thresh, lg] = await Promise.all([
        whatsappService.getConfig(),
        whatsappService.getThresholds(),
        whatsappService.getLogs(50)
      ]);
      const normalizedSlots = normalizeWaRecipientSlots(cfg.recipientSlots, cfg.recipients);
      const defaultGateways = buildDefaultGateways();
      setConfig({
        ...cfg,
        recipientSlots: normalizedSlots,
        recipients: normalizedSlots.filter((s) => s.enabled && s.number.trim()).map((s) => s.number.trim()),
        gatewayMode: cfg.gatewayMode || 'failover',
        gateways: cfg.gateways
          ? {
              gateway1: { ...defaultGateways.gateway1, ...cfg.gateways.gateway1, apiToken: '' },
              gateway2: { ...defaultGateways.gateway2, ...cfg.gateways.gateway2, apiToken: '' },
            }
          : defaultGateways
      });
      setThresholdMatrix(thresh);
      setLogs(lg);
    } catch {
      showToast('Gagal memuat data konfigurasi WhatsApp.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (embedded || isOpen) {
      loadData();
    }
  }, [embedded, isOpen, loadData]);

  if (!embedded && !isOpen) return null;

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

    const slots = normalizeWaRecipientSlots(config.recipientSlots, config.recipients);
    const activeRecipients = slots
      .filter((s) => s.enabled && s.number.trim().length > 0)
      .map((s) => s.number.trim());

    const payload: Partial<WhatsAppConfigData> = {
      isEnabled: config.isEnabled,
      cooldownMinutes: config.cooldownMinutes,
      alertOnOutOfStock: config.alertOnOutOfStock,
      alertOnLowStock: config.alertOnLowStock,
      alertOnEarlyWarning: config.alertOnEarlyWarning,
      globalLowStockThreshold: config.globalLowStockThreshold,
      globalEarlyWarningThreshold: config.globalEarlyWarningThreshold,
      activeHoursStart: config.activeHoursStart,
      activeHoursEnd: config.activeHoursEnd,
      recipientSlots: slots,
      recipients: activeRecipients,
    };

    if (canManageCredentials) {
      payload.gatewayMode = config.gatewayMode || 'failover';
      payload.gateways = config.gateways;
      if (config.gateways?.gateway1) {
        payload.apiUrl = config.gateways.gateway1.apiUrl;
        if (config.gateways.gateway1.apiToken) {
          payload.apiToken = config.gateways.gateway1.apiToken;
        }
      }
    }

    setLoading(true);
    const res = await whatsappService.updateConfig(payload);
    setLoading(false);

    if (res.success) {
      showToast(
        canManageCredentials
          ? 'Konfigurasi WhatsApp Alert, 4 slot penerima, & Gateway ganda berhasil disimpan!'
          : 'Konfigurasi WhatsApp Alert & 4 slot penerima berhasil disimpan!',
        'success'
      );
      loadData();
    } else {
      showToast(res.message, 'error');
    }
  };

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

  const handleTestGateway = async (gatewayId: 'gateway1' | 'gateway2') => {
    if (!canManageCredentials) return;

    setTestingGateway(gatewayId);
    setTestResult(null);
    const result = await whatsappService.testGateway(gatewayId);
    setTestingGateway(null);

    if (result.success) {
      setTestResult(`✓ ${result.message}`);
      showToast(result.message, 'success');
      whatsappService.getLogs().then(setLogs);
    } else {
      setTestResult(`✗ ${result.message}`);
      showToast(result.message, 'error');
    }
  };

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

  const cardContent = (
    <div className={embedded
      ? 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full flex flex-col overflow-hidden'
      : 'bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95'
    }>

      {/* Modal Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Pengaturan WhatsApp Alert{canManageCredentials ? ' & Gateway Ganda' : ''}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              4 Slot Penerima (Saklar ON/OFF), Ambang Berjenjang (Tipe &gt; Produk &gt; Global), Jeda 15 Menit
            </p>
          </div>
        </div>

        {!embedded && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Role Banners */}
      {!canEdit ? (
        <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 shrink-0">
          <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Peran Anda saat ini (<strong className="font-semibold">{getRoleDisplayLabel(user?.role)}</strong>) hanya diizinkan untuk melihat riwayat log WhatsApp (Read-Only). Pengaturan dikelola oleh Admin &amp; Developer.
          </span>
        </div>
      ) : !canManageCredentials ? (
        <div className="px-5 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-[11px] flex items-center gap-2 shrink-0">
          <Lock className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            Anda dapat mengatur 4 slot penerima WhatsApp, jam aktif, ambang stok, &amp; daftar pantauan. Pengaturan Gateway &amp; Token API WA dikelola khusus oleh peran <strong>Developer</strong>.
          </span>
        </div>
      ) : null}

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

      {/* Tab Content */}
      <div className="p-5 overflow-y-auto flex-1 text-xs space-y-5">
        {activeTab === 'config' && (
          <WaConfigTab
            config={config}
            setConfig={setConfig}
            canEdit={canEdit}
            canManageCredentials={canManageCredentials}
            loading={loading}
            testing={testing}
            testingGateway={testingGateway}
            testResult={testResult}
            onSaveConfig={handleSaveConfig}
            onTestConnection={handleTestConnection}
            onTestGateway={handleTestGateway}
            onDispatchAlert={handleDispatchConsolidatedAlert}
          />
        )}

        {activeTab === 'thresholds' && (
          <WaThresholdsTab
            thresholdMatrix={thresholdMatrix}
            canEdit={canEdit}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'logs' && (
          <WaLogsTab
            logs={logs}
            onRefreshLogs={() => { whatsappService.getLogs(50).then(setLogs); }}
          />
        )}
      </div>

      {!embedded && (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>FieldOps IT WhatsApp Alert Integration</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100"
          >
            Tutup
          </button>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return cardContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      {cardContent}
    </div>
  );
};

