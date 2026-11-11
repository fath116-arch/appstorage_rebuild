/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Transaction } from '../types/inventory';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search, 
  Plus, 
  Printer, 
  Calendar, 
  User, 
  FileText,
  Filter,
  CheckCircle2,
  Download
} from 'lucide-react';
import { exportWeeklyReportToExcel } from '../utils/excelExporter';

interface TransactionHistoryProps {
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onPrintTransaction: (tx: Transaction) => void;
}

import { useAuth } from '../context/AuthContext';

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  onOpenStockIn,
  onOpenStockOut,
  onPrintTransaction
}) => {
  const { user } = useAuth();
  const { transactions } = useInventory();

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx: any) => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const ref = (tx.reference_number || tx.referenceNumber || '').toLowerCase();
        const name = (tx.item_name || tx.itemName || '').toLowerCase();
        const sku = (tx.item_sku || tx.itemSku || '').toLowerCase();
        const by = (tx.performed_by || tx.performedBy || '').toLowerCase();
        const dest = (tx.recipient_destination || tx.recipientOrDestination || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        return ref.includes(q) || name.includes(q) || sku.includes(q) || by.includes(q) || dest.includes(q) || notes.includes(q);
      }
      return true;
    });
  }, [transactions, typeFilter, searchQuery]);

  // Aggregate stats
  const totalInCount = transactions.filter(t => t.type === 'IN').length;
  const totalOutCount = transactions.filter(t => t.type === 'OUT').length;
  const totalQtyOut = transactions.filter(t => t.type === 'OUT').reduce((acc, c) => acc + c.quantity, 0);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const getReferenceLabel = (tx: Transaction) => {
    switch (tx.referenceType) {
      case 'TICKET_EXTERNAL':
        return 'Tiket Insiden Lapangan';
      case 'PURCHASE_ORDER':
        return 'Purchase Order (PO)';
      case 'ROUTINE_MAINTENANCE':
        return 'Pemeliharaan Rutin';
      case 'EMERGENCY_REPAIR':
        return 'Perbaikan Darurat';
      case 'RETURN_RESTOCK':
        return 'Retur Sisa Lapangan';
      case 'INITIAL_COUNT':
        return 'Stok Awal Sistem';
      default:
        return 'Referensi';
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
              <span>Input & Output Real-time</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">Audit Trail Terpusat</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Riwayat Barang Masuk & Barang Keluar
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Catatan mutasi setiap kali barang diambil untuk tiket gangguan teknisi atau saat gudang menerima kiriman restock baru.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              onClick={() => exportWeeklyReportToExcel(filteredTransactions, `fieldops-audit-mutasi-${new Date().toISOString().slice(0, 10)}.xlsx`)}
              className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
              title="Unduh Lembar Audit Mutasi (.xlsx) dengan sanitasi formula keamanan"
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

        {/* Quick summary indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700/60">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Total Catatan Transaksi</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {transactions.length}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Seluruh riwayat tercatat</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700/60">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Barang Keluar (Pekerjaan Lapangan)</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {totalOutCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">transaksi ({totalQtyOut} unit terpakai)</span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Tercatat untuk tiket & maintenance</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-700/60">
            <div className="text-slate-500 dark:text-slate-400 font-medium">Barang Masuk (Restock / PO)</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {totalInCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">transaksi penerimaan</span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Penambahan fisik gudang</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no tiket (#TCK..), no PO, nama barang, atau teknisi..."
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

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs self-start md:self-auto">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              typeFilter === 'ALL' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semua Mutasi ({transactions.length})
          </button>
          <button
            onClick={() => setTypeFilter('IN')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              typeFilter === 'IN' ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Barang Masuk ({totalInCount})</span>
          </button>
          <button
            onClick={() => setTypeFilter('OUT')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              typeFilter === 'OUT' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-900 dark:text-slate-200" />
            <span>Barang Keluar ({totalOutCount})</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
              <tr>
                <th className="py-3 px-4">Tanggal & Waktu</th>
                <th className="py-3 px-4">Tipe Mutasi</th>
                <th className="py-3 px-4">Suku Cadang / Barang</th>
                <th className="py-3 px-4 text-right">Jumlah</th>
                <th className="py-3 px-4">No. Tiket / Referensi</th>
                <th className="py-3 px-4">Teknisi / Petugas</th>
                <th className="py-3 px-4">Tujuan / Lokasi</th>
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
                filteredTransactions.map((tx: any) => {
                  const isIn = tx.type === 'IN';
                  const txDate = tx.created_at || tx.date;
                  const itemName = tx.item_name || tx.itemName || '-';
                  const itemSku = tx.item_sku || tx.itemSku || '-';
                  const itemUnit = tx.item_unit || tx.unit || 'pcs';
                  const refNum = tx.reference_number || tx.referenceNumber || '-';
                  const performedBy = tx.performed_by || tx.performedBy || '-';
                  const recipient = tx.recipient_destination || tx.recipientOrDestination || '-';

                  return (
                    <tr 
                      key={tx.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        {formatDate(txDate)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 font-semibold ${
                          isIn ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-200'
                        }`}>
                          {isIn ? (
                            <>
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>MASUK (IN)</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>KELUAR (OUT)</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                          {itemName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{itemSku}</div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono tabular-nums">
                        <span className={`font-bold text-sm ${isIn ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                          {isIn ? `+${tx.quantity}` : `-${tx.quantity}`}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1 font-sans text-xs">{itemUnit}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{refNum}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">{getReferenceLabel(tx)}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div className="font-medium">{performedBy}</div>
                        {tx.apiSource && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[130px]" title={tx.apiSource}>
                            via {tx.apiSource}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title={recipient}>
                        {recipient}
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

      {/* Transaction Detail Slide-over / Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                {selectedTx.type === 'IN' ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-slate-900 dark:text-white" />
                )}
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Detail Mutasi: {selectedTx.referenceNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ID Transaksi: {selectedTx.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-700/60 space-y-1">
                <div className="text-slate-400 dark:text-slate-500 font-medium">Suku Cadang:</div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">{selectedTx.itemName}</div>
                <div className="font-mono text-slate-500 dark:text-slate-400">{selectedTx.itemSku}</div>
                <div className="pt-2 flex items-baseline gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Volume Mutasi:</span>
                  <span className={`text-base font-bold font-mono tabular-nums ${
                    selectedTx.type === 'IN' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                  }`}>
                    {selectedTx.type === 'IN' ? '+' : '-'}{selectedTx.quantity} {selectedTx.unit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium">Waktu Transaksi:</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200">{formatDate(selectedTx.created_at || selectedTx.date || new Date().toISOString())}</div>
                </div>
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium">Jenis Referensi:</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{getReferenceLabel(selectedTx)}</div>
                </div>
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium">Teknisi / Petugas:</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{selectedTx.performedBy}</div>
                </div>
                <div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium">Sumber / Channel:</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200 truncate" title={selectedTx.apiSource || 'Manual'}>
                    {selectedTx.apiSource || 'Input Manual'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-slate-400 dark:text-slate-500 font-medium">Tujuan / Lokasi:</div>
                <div className="font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-md border border-slate-100 dark:border-slate-700/60 mt-1">
                  {selectedTx.recipientOrDestination || '-'}
                </div>
              </div>

              <div>
                <div className="text-slate-400 dark:text-slate-500 font-medium">Catatan / Detail Pekerjaan:</div>
                <div className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-md border border-slate-100 dark:border-slate-700/60 mt-1 leading-relaxed">
                  {selectedTx.notes || 'Tidak ada catatan tambahan.'}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
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
              <button
                onClick={() => setSelectedTx(null)}
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
