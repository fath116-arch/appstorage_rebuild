/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { stockApi } from '../services/stockApi';
import { formatWibDateTime, getCurrentWibYear } from '../utils/timezone';
import { getErrorMessage } from '../utils/errorUtils';
import {
  X,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Send,
  History,
  Wrench,
  CheckSquare,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

interface FieldTripChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type ItemStatus = 'LENGKAP' | 'KETINGGALAN' | 'RUSAK';

export interface FieldToolCheckItem {
  id: string;
  toolName: string;
  category: string;
  departureStatus: ItemStatus;
  returnStatus: ItemStatus;
  notes?: string;
}

export interface InspectionLog {
  id: string;
  ticketNumber: string;
  destination: string;
  technicianName: string;
  departureTime: string;
  returnTime?: string;
  phase: 'KEBERANGKATAN' | 'SELESAI_KEPULANGAN';
  totalTools: number;
  departureCompleteCount: number;
  departureMissingCount: number;
  returnCompleteCount: number;
  returnMissingCount: number;
  items: FieldToolCheckItem[];
  sparePartsCheckedOut?: Array<{ itemId: string; name: string; quantity: number }>;
}

const DEFAULT_FIELD_TOOLS: Omit<FieldToolCheckItem, 'departureStatus' | 'returnStatus'>[] = [
  { id: 'tool-1', toolName: 'Optical Power Meter (OPM) Fiber Optical', category: 'Alat Ukur FO' },
  { id: 'tool-2', toolName: 'Visual Fault Locator (VFL / Red Laser 10mW)', category: 'Alat Ukur FO' },
  { id: 'tool-3', toolName: 'Fusion Splicer Fiber & Cleaver Set', category: 'Alat Sambung FO' },
  { id: 'tool-4', toolName: 'Tang Crimping RJ45 & RJ11 Cat6', category: 'Perkakas LAN' },
  { id: 'tool-5', toolName: 'Digital Cable Tester LAN RJ45/RJ11', category: 'Alat Ukur LAN' },
  { id: 'tool-6', toolName: 'Kabel Console Cisco/Mikrotik (USB to RJ45)', category: 'Kabel Konfigurasi' },
  { id: 'tool-7', toolName: 'Multimeter Digital Sanwa CD800a', category: 'Alat Listrik' },
  { id: 'tool-8', toolName: 'Obeng Set Presisi & Tang Potong ESD', category: 'Perkakas Tangan' },
  { id: 'tool-9', toolName: 'Patch Cord FO SC-LC Duplex 3m (Backup Test)', category: 'Aksesori Test' },
  { id: 'tool-10', toolName: 'Helm Keselamatan K3 & Rompi K3 Lapangan', category: 'APD & Safety' },
];

const STORAGE_KEY = 'fieldops_inspection_history';

export const FieldTripChecklistModal: React.FC<FieldTripChecklistModalProps> = ({
  isOpen,
  onClose
}) => {
  const { products, refreshData, showToast } = useInventory();
  const { user } = useAuth();

  const [activeView, setActiveView] = useState<'INSPECTION' | 'HISTORY'>('INSPECTION');
  const [inspectionPhase, setInspectionPhase] = useState<'KEBERANGKATAN' | 'KEPULANGAN'>('KEBERANGKATAN');
  const [ticketNumber, setTicketNumber] = useState(
    () => `TCK-${getCurrentWibYear()}-${Math.floor(5000 + Math.random() * 4000)}`
  );
  const [destination, setDestination] = useState('Kantor Cabang Sudirman - Lt 4');
  const [customToolName, setCustomToolName] = useState('');
  const [isAddingCustomTool, setIsAddingCustomTool] = useState(false);

  const [toolsChecklist, setToolsChecklist] = useState<FieldToolCheckItem[]>(() =>
    DEFAULT_FIELD_TOOLS.map(t => ({
      ...t,
      departureStatus: 'LENGKAP',
      returnStatus: 'LENGKAP',
      notes: ''
    }))
  );

  // Flatten available spare part variants from canonical catalog (prefer tanpa_id / qty-based variants)
  const sparePartOptions = useMemo(() => {
    const list: Array<{
      tipeId: number;
      boxId: string;
      name: string;
      avail: number;
      unit: string;
    }> = [];
    for (const p of products) {
      for (const t of p.tipes || []) {
        const avail = Number(t.stok_tersedia || 0);
        if (avail <= 0 || t.sumber_id !== 'tanpa_id') continue;
        const firstBox = t.sebaran_box?.[0];
        if (!firstBox) continue;
        list.push({
          tipeId: t.id,
          boxId: firstBox.box_id,
          name: `${p.nama} - ${t.nama_tipe}`,
          avail,
          unit: p.tipe_stok || 'unit'
        });
      }
    }
    return list;
  }, [products]);

  const [spareParts, setSpareParts] = useState<Array<{ tipeId: number; boxId: string; reqQty: number }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const [historyLogs, setHistoryLogs] = useState<InspectionLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(historyLogs));
    } catch (e) {
      console.warn('Failed to save inspection logs history', e);
    }
  }, [historyLogs]);

  if (!isOpen) return null;

  const handleConfirmAddCustomTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToolName.trim()) return;
    const newTool: FieldToolCheckItem = {
      id: `custom_${Date.now()}`,
      toolName: customToolName.trim(),
      category: 'Peralatan Tambahan',
      departureStatus: 'LENGKAP',
      returnStatus: 'LENGKAP',
      notes: ''
    };
    setToolsChecklist(prev => [...prev, newTool]);
    setCustomToolName('');
    setIsAddingCustomTool(false);
  };

  const handleUpdateToolStatus = (id: string, phase: 'departure' | 'return', status: ItemStatus) => {
    setToolsChecklist(prev =>
      prev.map(t =>
        t.id === id
          ? phase === 'departure'
            ? { ...t, departureStatus: status }
            : { ...t, returnStatus: status }
          : t
      )
    );
  };

  const handleAddSparePart = () => {
    const unpicked = sparePartOptions.find(opt => !spareParts.some(sp => sp.tipeId === opt.tipeId)) || sparePartOptions[0];
    if (unpicked) {
      setSpareParts(prev => [...prev, { tipeId: unpicked.tipeId, boxId: unpicked.boxId, reqQty: 1 }]);
    } else {
      showToast('Tidak ada varian stok tanpa-ID yang tersedia untuk diambil.', 'warning');
    }
  };

  const handleRemoveSparePart = (index: number) => {
    setSpareParts(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSparePart = (index: number, tipeId: number) => {
    const matched = sparePartOptions.find(o => o.tipeId === tipeId);
    if (!matched) return;
    setSpareParts(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], tipeId: matched.tipeId, boxId: matched.boxId, reqQty: Math.min(copy[index].reqQty, matched.avail) };
      return copy;
    });
  };

  const handleUpdateSparePartQty = (index: number, qty: number) => {
    setSpareParts(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], reqQty: Math.max(1, qty) };
      return copy;
    });
  };

  const departureLengkapCount = toolsChecklist.filter(t => t.departureStatus === 'LENGKAP').length;
  const departureMissingCount = toolsChecklist.filter(t => t.departureStatus === 'KETINGGALAN').length;
  const departureDamagedCount = toolsChecklist.filter(t => t.departureStatus === 'RUSAK').length;

  const returnLengkapCount = toolsChecklist.filter(t => t.returnStatus === 'LENGKAP').length;
  const returnMissingCount = toolsChecklist.filter(t => t.returnStatus === 'KETINGGALAN').length;
  const returnDamagedCount = toolsChecklist.filter(t => t.returnStatus === 'RUSAK').length;

  const handleSaveDepartureInspection = async () => {
    setSubmitting(true);
    try {
      const checkedOutParts: Array<{ itemId: string; name: string; quantity: number }> = [];
      const itemsToDeduct: Array<{ tipeId: number; boxId: string; jumlah: number }> = [];

      for (const sp of spareParts) {
        const matched = sparePartOptions.find(o => o.tipeId === sp.tipeId);
        if (matched && matched.avail >= sp.reqQty) {
          checkedOutParts.push({ itemId: String(matched.tipeId), name: matched.name, quantity: sp.reqQty });
          itemsToDeduct.push({ tipeId: matched.tipeId, boxId: matched.boxId, jumlah: sp.reqQty });
        }
      }

      if (itemsToDeduct.length > 0) {
        await stockApi.outBulk({
          items: itemsToDeduct,
          reference_number: ticketNumber,
          recipient_destination: destination,
          catatan: 'Pengambilan suku cadang untuk tas kerja lapangan teknisi'
        });
        await refreshData();
      }

      const newLog: InspectionLog = {
        id: `insp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketNumber,
        destination,
        technicianName: user?.name || 'Teknisi IT',
        departureTime: formatWibDateTime(new Date()),
        phase: 'KEBERANGKATAN',
        totalTools: toolsChecklist.length,
        departureCompleteCount: departureLengkapCount,
        departureMissingCount: departureMissingCount + departureDamagedCount,
        returnCompleteCount: 0,
        returnMissingCount: 0,
        items: toolsChecklist,
        sparePartsCheckedOut: checkedOutParts
      };

      setHistoryLogs(prev => [newLog, ...prev]);

      api
        .createChecklist({
          ticketNumber,
          technicianName: user?.name || 'Teknisi IT',
          itemsCount: toolsChecklist.length,
          completeCount: departureLengkapCount,
          missingCount: departureMissingCount + departureDamagedCount,
          notes: `Keberangkatan - ${destination}`
        })
        .catch(err => console.warn('Failed to save checklist to server:', err));

      showToast('Pengecekan Keberangkatan berhasil dicatat! Lanjutkan tugas lapangan.', 'success');
      setInspectionPhase('KEPULANGAN');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Gagal mencatat pengambilan sparepart tas lapangan.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveReturnInspection = () => {
    const returnTime = formatWibDateTime(new Date());

    setHistoryLogs(prev => {
      const existingIdx = prev.findIndex(l => l.ticketNumber === ticketNumber && l.phase === 'KEBERANGKATAN');
      if (existingIdx !== -1) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          returnTime,
          phase: 'SELESAI_KEPULANGAN',
          returnCompleteCount: returnLengkapCount,
          returnMissingCount: returnMissingCount + returnDamagedCount,
          items: toolsChecklist
        };
        return copy;
      }
      const newLog: InspectionLog = {
        id: `insp_ret_${Date.now()}`,
        ticketNumber,
        destination,
        technicianName: user?.name || 'Teknisi IT',
        departureTime: returnTime,
        returnTime,
        phase: 'SELESAI_KEPULANGAN',
        totalTools: toolsChecklist.length,
        departureCompleteCount: departureLengkapCount,
        departureMissingCount: departureMissingCount + departureDamagedCount,
        returnCompleteCount: returnLengkapCount,
        returnMissingCount: returnMissingCount + returnDamagedCount,
        items: toolsChecklist
      };
      return [newLog, ...prev];
    });

    api
      .createChecklist({
        ticketNumber,
        technicianName: user?.name || 'Teknisi IT',
        itemsCount: toolsChecklist.length,
        completeCount: returnLengkapCount,
        missingCount: returnMissingCount + returnDamagedCount,
        notes: `Kepulangan Selesai - ${destination}`
      })
      .catch(err => console.warn('Failed to save checklist to server:', err));

    showToast('Verifikasi Kepulangan Tas Lapangan berhasil disimpan!', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold text-lg shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Pengecekan Tas Lapangan Teknisi</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Verifikasi kelengkapan alat kerja sebelum berangkat &amp; saat kepulangan (WIB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView(activeView === 'INSPECTION' ? 'HISTORY' : 'INSPECTION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeView === 'HISTORY'
                  ? 'bg-amber-500 text-slate-900 font-bold'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Riwayat ({historyLogs.length})</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {activeView === 'HISTORY' ? (
          <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Riwayat Audit Pengecekan Tas Lapangan</span>
              </span>
              <button
                onClick={() => setActiveView('INSPECTION')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
              >
                + Buka Pengecekan Baru
              </button>
            </div>

            {historyLogs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Briefcase className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">Belum ada riwayat pengecekan tas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs">
                          {log.ticketNumber}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{log.destination}</span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          log.phase === 'SELESAI_KEPULANGAN'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {log.phase === 'SELESAI_KEPULANGAN' ? 'Selesai Pulang' : 'Tugas Berjalan'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">Teknisi:</span>
                        <strong className="text-slate-800 dark:text-slate-200">{log.technicianName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">Waktu Berangkat:</span>
                        <span className="font-mono dark:text-slate-300">{log.departureTime}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">Keberangkatan:</span>
                        <span className={log.departureMissingCount > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                          {log.departureCompleteCount}/{log.totalTools} Lengkap
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">Kepulangan:</span>
                        {log.returnTime ? (
                          <span className={log.returnMissingCount > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                            {log.returnCompleteCount}/{log.totalTools} Lengkap
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Belum diverifikasi</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
            {/* Phase Selector */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl">
              <button
                type="button"
                onClick={() => setInspectionPhase('KEBERANGKATAN')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  inspectionPhase === 'KEBERANGKATAN'
                    ? 'bg-slate-900 text-white dark:bg-slate-800 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${departureMissingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span>Fase 1: Keberangkatan</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectionPhase('KEPULANGAN')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  inspectionPhase === 'KEPULANGAN'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${returnMissingCount > 0 ? 'bg-rose-400' : 'bg-emerald-300'}`} />
                <span>Fase 2: Verifikasi Kepulangan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Nomor Tiket Penugasan</label>
                <input
                  type="text"
                  value={ticketNumber}
                  onChange={e => setTicketNumber(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Lokasi Tujuan Penugasan</label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>
            </div>

            {inspectionPhase === 'KEBERANGKATAN' ? (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 ${
                  departureMissingCount === 0 && departureDamagedCount === 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {departureMissingCount === 0 && departureDamagedCount === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-xs">
                      {departureMissingCount === 0 && departureDamagedCount === 0
                        ? 'Semua Peralatan Kerja Siap & Lengkap!'
                        : `Perhatian: ${departureMissingCount} alat ketinggalan, ${departureDamagedCount} rusak.`}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {departureLengkapCount} dari {toolsChecklist.length} peralatan diperiksa.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingCustomTool(v => !v)}
                  className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Alat</span>
                </button>
              </div>
            ) : (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  returnMissingCount === 0 && returnDamagedCount === 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {returnMissingCount === 0 && returnDamagedCount === 0 ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-xs">
                      {returnMissingCount === 0 && returnDamagedCount === 0
                        ? 'Semua Alat Kembali Utuh ke Tas!'
                        : `Peringatan: Ada ${returnMissingCount} alat tertinggal!`}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      {returnLengkapCount} dari {toolsChecklist.length} alat terverifikasi pulang.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isAddingCustomTool && (
              <form onSubmit={handleConfirmAddCustomTool} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  value={customToolName}
                  onChange={e => setCustomToolName(e.target.value)}
                  placeholder="Nama alat kerja tambahan..."
                  className="flex-1 py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg"
                >
                  Tambahkan
                </button>
              </form>
            )}

            {/* Equipment list */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Daftar Peralatan &amp; Tool Kit Tas Lapangan:</span>
              </div>

              {toolsChecklist.map(tool => {
                const currentStatus = inspectionPhase === 'KEBERANGKATAN' ? tool.departureStatus : tool.returnStatus;
                return (
                  <div
                    key={tool.id}
                    className={`p-3 rounded-xl border transition-all ${
                      currentStatus === 'LENGKAP'
                        ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                        : currentStatus === 'KETINGGALAN'
                        ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60'
                        : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{tool.toolName}</span>
                        <span className="ml-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {tool.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {(['LENGKAP', 'KETINGGALAN', 'RUSAK'] as const).map(st => (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              handleUpdateToolStatus(
                                tool.id,
                                inspectionPhase === 'KEBERANGKATAN' ? 'departure' : 'return',
                                st
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              currentStatus === st
                                ? st === 'LENGKAP'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : st === 'KETINGGALAN'
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {st === 'LENGKAP' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {st === 'KETINGGALAN' && <XCircle className="w-3.5 h-3.5" />}
                            {st === 'RUSAK' && <Wrench className="w-3.5 h-3.5" />}
                            <span>{st === 'LENGKAP' ? 'Lengkap' : st === 'KETINGGALAN' ? 'Ketinggalan' : 'Rusak'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optional Spare Parts */}
            {inspectionPhase === 'KEBERANGKATAN' && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Ambil Barang Habis Pakai dari Gudang (Opsional):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSparePart}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Ambil Part</span>
                  </button>
                </div>

                {spareParts.map((sp, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                  >
                    <select
                      value={sp.tipeId}
                      onChange={e => handleUpdateSparePart(idx, Number(e.target.value))}
                      className="font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs truncate flex-1"
                    >
                      {sparePartOptions.map(opt => (
                        <option key={opt.tipeId} value={opt.tipeId}>
                          {opt.name} (Stok: {opt.avail} {opt.unit})
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-slate-400 dark:text-slate-500 text-[11px]">Qty:</span>
                      <input
                        type="number"
                        min={1}
                        value={sp.reqQty}
                        onChange={e => handleUpdateSparePartQty(idx, parseInt(e.target.value, 10) || 1)}
                        className="w-14 py-1 px-1.5 font-mono font-bold text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSparePart(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          >
            Tutup
          </button>

          {activeView === 'INSPECTION' &&
            (inspectionPhase === 'KEBERANGKATAN' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveDepartureInspection}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-4 h-4 text-emerald-400" />
                <span>{submitting ? 'Menyimpan...' : 'Simpan Pengecekan Keberangkatan'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveReturnInspection}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>Simpan &amp; Selesaikan Verifikasi Kepulangan</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
