/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { CanonicalTransactionView, activityApi } from '../services/activityApi';
import { isWarehouseManager } from '../utils/permissions';
import { getErrorMessage } from '../utils/errorUtils';
import {
  formatWibDateTime,
  getCurrentWibDateTimeLocalInput,
  getWibDateKey,
  wibLocalInputToUtcIso
} from '../utils/timezone';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  Printer,
  Download,
  UserCheck,
  Link2,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { exportWeeklyReportToExcel } from '../utils/excelExporter';

interface TransactionHistoryProps {
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onPrintTransaction: (tx: CanonicalTransactionView) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  onOpenStockIn,
  onOpenStockOut,
  onPrintTransaction
}) => {
  const { user } = useAuth();
  const { transactions, setActiveTab, refreshData, showToast } = useInventory();
  const canCorrect = isWarehouseManager(user?.role);

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT' | 'TRANSFER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<CanonicalTransactionView | null>(null);

  // Correction modal state (append-only audit correction, never overwrite/delete)
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionOccurredLocal, setCorrectionOccurredLocal] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const ref = (tx.reference_number || '').toLowerCase();
        const reqId = (tx.request_id || '').toLowerCase();
        const name = (tx.item_name || '').toLowerCase();
        const sku = (tx.item_sku || '').toLowerCase();
        const actor = (tx.actor_nama || tx.performed_by || '').toLowerCase();
        const recorder = (tx.recorded_by_nama || '').toLowerCase();
        const dest = (tx.recipient_destination || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        return (
          ref.includes(q) ||
          reqId.includes(q) ||
          name.includes(q) ||
          sku.includes(q) ||
          actor.includes(q) ||
          recorder.includes(q) ||
          dest.includes(q) ||
          notes.includes(q)
        );
      }
      return true;
    });
  }, [transactions, typeFilter, searchQuery]);

  const totalInCount = transactions.filter(t => t.type === 'IN').length;
  const totalOutCount = transactions.filter(t => t.type === 'OUT').length;
  const totalQtyOut = transactions.filter(t => t.type === 'OUT').reduce((acc, c) => acc + Number(c.quantity || 0), 0);

  const getReferenceLabel = (tx: CanonicalTransactionView) => {
    switch (tx.reference_type) {
      case 'TICKET_EXTERNAL':
      case 'EXTERNAL_TICKET':
        return 'Tiket Insiden Lapangan';
      case 'PURCHASE_ORDER':
        return 'Purchase Order (PO)';
      case 'TECHNICIAN_REQUEST':
        return 'Request Teknisi';
      case 'AUDIT_CORRECTION':
        return 'Koreksi Audit';
      case 'ROUTINE_MAINTENANCE':
        return 'Pemeliharaan Rutin';
      case 'EMERGENCY_REPAIR':
        return 'Perbaikan Darurat';
      case 'RETURN_RESTOCK':
        return 'Pengembalian / Retur';
      case 'STOCK_RESTORE':
        return 'Pemulihan ke Gudang';
      default:
        return tx.aksi ? tx.aksi.replace(/_/g, ' ') : 'Mutasi';
    }
  };

  const openCorrectionDialog = (tx: CanonicalTransactionView) => {
    setCorrectionReason('');
    setCorrectionOccurredLocal(getCurrentWibDateTimeLocalInput(new Date(tx.occurred_at || tx.waktu)));
    setCorrectionOpen(true);
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;
    if (correctionReason.trim().length < 5) {
      showToast('Alasan koreksi wajib diisi minimal 5 karakter.', 'warning');
      return;
    }

    setSubmittingCorrection(true);
    try {
      const occurredIso = correctionOccurredLocal ? wibLocalInputToUtcIso(correctionOccurredLocal) : undefined;
      await activityApi.correctTransaction(selectedTx.id_aktivitas, {
        alasan: correctionReason.trim(),
        occurred_at: occurredIso
      });
      showToast('Entri koreksi audit berhasil dicatat tanpa mengubah log historis.', 'success');
      setCorrectionOpen(false);
      setSelectedTx(null);
      await refreshData();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Gagal mencatat entri koreksi.'), 'error');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Quick Stats */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Mutasi Suku Cadang</span>
              <span aria-hidden="true">·</span>
              <span>Log Permanen (Append-Only Ledger)</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">Waktu WIB (Asia/Jakarta)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Riwayat Barang Masuk &amp; Barang Keluar
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Catatan mutasi terpusat lengkap dengan identitas pelaku (actor), pencatat (recorded-by), dan koreksi audit non-destruktif.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              onClick={() =>
                exportWeeklyReportToExcel(
                  filteredTransactions,
                  `fieldops-audit-mutasi-${getWibDateKey(new Date())}.xlsx`
                )
              }
              className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
              title="Unduh Lembar Audit Mutasi (.xlsx)"
            >
              <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Ekspor Excel</span>
            </button>

            <button
              onClick={onOpenStockIn}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>+ Input Barang Masuk</span>
            </button>

            <button
              onClick={onOpenStockOut}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 dark:hover:bg-emerald-500 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-xs"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400 dark:text-white" />
              <span>- Output Barang Keluar</span>
            </button>
          </div>
        </div>

        {/* Summary indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700/60">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Total Catatan Transaksi</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {transactions.length}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Seluruh log permanen tercatat</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700/60">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Barang Keluar</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {totalOutCount}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                transaksi ({totalQtyOut} unit keluar)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Pengeluaran tiket, request &amp; lapangan</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700/60">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Barang Masuk (Restock / Retur)</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {totalInCount}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">transaksi penerimaan</span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Penambahan &amp; pengembalian ke box</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no tiket, REQ-..., SN, nama barang, atau pelaku..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs self-start md:self-auto flex-wrap">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              typeFilter === 'ALL'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semua ({transactions.length})
          </button>
          <button
            onClick={() => setTypeFilter('IN')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              typeFilter === 'IN'
                ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Masuk ({totalInCount})</span>
          </button>
          <button
            onClick={() => setTypeFilter('OUT')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              typeFilter === 'OUT'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-900 dark:text-slate-200" />
            <span>Keluar ({totalOutCount})</span>
          </button>
          <button
            onClick={() => setTypeFilter('TRANSFER')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              typeFilter === 'TRANSFER'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfer</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
              <tr>
                <th className="py-3 px-4">Waktu Kejadian (WIB)</th>
                <th className="py-3 px-4">Tipe Mutasi</th>
                <th className="py-3 px-4">Suku Cadang / Barang</th>
                <th className="py-3 px-4 text-right">Jumlah</th>
                <th className="py-3 px-4">Referensi / Request</th>
                <th className="py-3 px-4">Pelaku &amp; Pencatat</th>
                <th className="py-3 px-4">Tujuan / Box</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Tidak ditemukan data transaksi yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isIn = tx.type === 'IN';
                  const isOut = tx.type === 'OUT';

                  return (
                    <tr
                      key={tx.id_aktivitas}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono tabular-nums text-[11px]">
                        <div>{formatWibDateTime(tx.occurred_at || tx.waktu)}</div>
                        {tx.recorded_at && tx.occurred_at && tx.recorded_at !== tx.occurred_at && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            Dicatat: {formatWibDateTime(tx.recorded_at)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isIn
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : isOut
                              ? 'text-slate-900 dark:text-slate-200'
                              : 'text-blue-700 dark:text-blue-400'
                          }`}
                        >
                          {isIn ? (
                            <>
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>MASUK (IN)</span>
                            </>
                          ) : isOut ? (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>KELUAR (OUT)</span>
                            </>
                          ) : (
                            <>
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              <span>{tx.aksi.toUpperCase()}</span>
                            </>
                          )}
                        </span>
                        {tx.correction_of_id && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                            Koreksi dari {tx.correction_of_id}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                          {tx.item_name || '-'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {tx.item_sku || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono tabular-nums">
                        <span
                          className={`font-bold text-sm ${
                            isIn
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : isOut
                              ? 'text-slate-900 dark:text-white'
                              : 'text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {isIn ? `+${tx.quantity}` : isOut ? `-${tx.quantity}` : tx.quantity}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1 font-sans text-xs">
                          {tx.item_unit || 'unit'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {tx.reference_number || '-'}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {getReferenceLabel(tx)}
                        </div>
                        {tx.request_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTab('requests');
                            }}
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>{tx.request_id}</span>
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {tx.actor_nama || tx.performed_by || '-'}
                        </div>
                        {tx.is_on_behalf && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1 mt-0.5">
                            <UserCheck className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[180px]" title={tx.on_behalf_reason || ''}>
                              Dibuatkan oleh {tx.recorded_by_nama}
                            </span>
                          </div>
                        )}
                      </td>

                      <td
                        className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[180px] truncate"
                        title={tx.recipient_destination || tx.box_tujuan || tx.box_asal || ''}
                      >
                        {tx.recipient_destination || tx.box_tujuan || tx.box_asal || '-'}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onPrintTransaction(tx)}
                          className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors inline-flex items-center gap-1 font-medium"
                          title="Cetak Bukti Transaksi / Surat Jalan"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Bukti</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                {selectedTx.type === 'IN' ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : selectedTx.type === 'OUT' ? (
                  <ArrowUpRight className="w-5 h-5 text-slate-900 dark:text-white" />
                ) : (
                  <ArrowLeftRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Detail Mutasi: {selectedTx.reference_number || selectedTx.id_aktivitas}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    ID Log: {selectedTx.id_aktivitas}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedTx(null);
                  setCorrectionOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-700/60 space-y-1">
                <div className="text-slate-400 dark:text-slate-500 font-medium">Suku Cadang / Barang:</div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">{selectedTx.item_name}</div>
                <div className="font-mono text-slate-500 dark:text-slate-400">{selectedTx.item_sku}</div>
                <div className="pt-2 flex items-baseline gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Volume Mutasi:</span>
                  <span
                    className={`text-base font-bold font-mono tabular-nums ${
                      selectedTx.type === 'IN'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {selectedTx.type === 'IN' ? '+' : selectedTx.type === 'OUT' ? '-' : ''}
                    {selectedTx.quantity} {selectedTx.item_unit || 'unit'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Waktu Kejadian (WIB):</span>
                  </div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatWibDateTime(selectedTx.occurred_at || selectedTx.waktu)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium">Waktu Dicatat (WIB):</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatWibDateTime(selectedTx.recorded_at || selectedTx.waktu)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium">Pelaku (Actor):</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {selectedTx.actor_nama || selectedTx.performed_by}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium">Dicatat Oleh:</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedTx.recorded_by_nama || selectedTx.performed_by}
                  </div>
                </div>
              </div>

              {selectedTx.is_on_behalf && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Transaksi Atas Nama (Dibuatkan oleh {selectedTx.recorded_by_nama})</span>
                  </div>
                  <div className="text-[11px]">Alasan: {selectedTx.on_behalf_reason || '-'}</div>
                </div>
              )}

              {selectedTx.request_id && (
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 flex items-center justify-between">
                  <span className="text-blue-800 dark:text-blue-200 font-medium">
                    Terhubung ke Request: <strong className="font-mono">{selectedTx.request_id}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTx(null);
                      setActiveTab('requests');
                    }}
                    className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline"
                  >
                    Buka Request &rarr;
                  </button>
                </div>
              )}

              {selectedTx.correction_of_id && (
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  Entri Koreksi untuk Log Asli: <strong>{selectedTx.correction_of_id}</strong>
                </div>
              )}

              {selectedTx.details && selectedTx.details.length > 0 && (
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium mb-1">
                    Rincian Item ({selectedTx.details.length}):
                  </div>
                  <div className="max-h-36 overflow-y-auto bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200/60 dark:divide-slate-800">
                    {selectedTx.details.map((d) => (
                      <div key={d.id} className="p-2 flex items-center justify-between gap-2 text-[11px]">
                        <div className="truncate">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {d.nama_snapshot}
                          </div>
                          {d.kode_id && (
                            <div className="font-mono text-slate-500 dark:text-slate-400">{d.kode_id}</div>
                          )}
                        </div>
                        <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                          {d.jumlah} unit
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-slate-400 dark:text-slate-500 font-medium">Tujuan / Lokasi:</div>
                <div className="font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-md border border-slate-100 dark:border-slate-700/60 mt-1">
                  {selectedTx.recipient_destination || selectedTx.box_tujuan || selectedTx.box_asal || '-'}
                </div>
              </div>

              <div>
                <div className="text-slate-400 dark:text-slate-500 font-medium">Catatan / Detail Pekerjaan:</div>
                <div className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-md border border-slate-100 dark:border-slate-700/60 mt-1 leading-relaxed">
                  {selectedTx.notes || 'Tidak ada catatan tambahan.'}
                </div>
              </div>

              {/* Inline Audit Correction Form */}
              {correctionOpen && canCorrect && (
                <form
                  onSubmit={handleSubmitCorrection}
                  className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2.5"
                >
                  <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Catat Entri Koreksi Audit (Non-Destruktif)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Log asli tetap permanen. Sistem menambahkan entri koreksi baru yang merujuk ke {selectedTx.id_aktivitas}.
                  </p>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Alasan Koreksi Audit (wajib min. 5 karakter)
                    </label>
                    <input
                      type="text"
                      required
                      minLength={5}
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="Contoh: Salah input jam kejadian saat penarikan lapangan"
                      className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Waktu Kejadian Terkoreksi (WIB)
                    </label>
                    <input
                      type="datetime-local"
                      value={correctionOccurredLocal}
                      onChange={(e) => setCorrectionOccurredLocal(e.target.value)}
                      className="w-full py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectionOpen(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submittingCorrection}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 rounded-lg"
                    >
                      {submittingCorrection ? 'Menyimpan...' : 'Simpan Koreksi Audit'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onPrintTransaction(selectedTx);
                    setSelectedTx(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Lembar Serah Terima</span>
                </button>
                {canCorrect && !correctionOpen && (
                  <button
                    type="button"
                    onClick={() => openCorrectionDialog(selectedTx)}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Catat Koreksi Audit</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedTx(null);
                  setCorrectionOpen(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
