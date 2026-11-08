/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Formal A4 Print Report Modal for FieldOps IT
 * Features official letterhead (Kop), repeating table thead, no-print isolation,
 * and high-contrast professional document layout.
 */

import React from 'react';
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface ReportItemRow {
  sku: string;
  name: string;
  categoryName: string;
  location?: string;
  startStock: number;
  totalIn: number;
  totalOut: number;
  endStock: number;
  unit: string;
  status: 'AMAN' | 'MENIPIS' | 'HABIS';
}

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodLabel: string;
  itemsData: ReportItemRow[];
  totalInflow: number;
  totalOutflow: number;
  criticalCount: number;
  outOfStockCount: number;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  periodLabel,
  itemsData,
  totalInflow,
  totalOutflow,
  criticalCount,
  outOfStockCount,
}) => {
  const { user } = useAuth();

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const printTimestamp = new Date().toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden my-auto animate-in fade-in zoom-in-95">
        
        {/* On-screen control bar (Hidden on Print) */}
        <div className="no-print px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-xs sm:text-sm">
              Pratinjau Format Cetak Dokumen A4 (Formal Report Template)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (Formatted for A4 Standard) */}
        <div className="report-print-container p-6 sm:p-10 bg-white text-slate-900 font-sans max-h-[82vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          
          {/* 1. KOP SURAT RESMI (Official Letterhead) */}
          <div className="border-b-2 border-slate-900 pb-4 mb-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src="/logo.webp"
                  alt="FieldOps IT"
                  className="h-14 w-14 object-contain shrink-0"
                />
                <div>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight uppercase text-slate-900 leading-tight">
                    PT. SOLUSI INFORMATIKA LAPANGAN
                  </h1>
                  <p className="text-xs font-semibold text-slate-700">
                    Divisi Operasional & Manajemen Infrastruktur IT Lapangan
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Gedung Pusat Operasi IT · Jl. Sudirman Kav. 45, Jakarta Pusat · Telp: (021) 555-0199 · info@fieldops.id
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="border border-slate-800 px-3 py-1 font-mono text-xs font-bold uppercase bg-slate-100 text-slate-900 inline-block">
                  DOKUMEN RESMI
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  REF: AUD-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-INV
                </div>
              </div>
            </div>
          </div>

          {/* 2. JUDUL LAPORAN & METADATA CETAK */}
          <div className="text-center my-4">
            <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-900 underline underline-offset-4">
              LAPORAN AUDIT & MUTASI STOK SUKU CADANG IT
            </h2>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Periode Laporan: <span className="font-bold text-slate-900 font-mono">{periodLabel}</span>
            </p>
          </div>

          {/* Metadata Row: Tanggal Cetak & Petugas */}
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200 mb-4 font-mono">
            <div>
              <span className="text-slate-500 font-sans">Tanggal & Waktu Cetak:</span>{' '}
              <span className="font-bold text-slate-800">{printTimestamp} WIB</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 font-sans">Dicetak Oleh:</span>{' '}
              <span className="font-bold text-slate-800">
                {user?.name || 'Petugas Inventori IT'} ({user?.role || 'operator'})
              </span>
            </div>
          </div>

          {/* Ringkasan Eksekutif Mutasi (KPI Summary Strip) */}
          <div className="grid grid-cols-4 gap-2 mb-4 text-center">
            <div className="p-2 border border-slate-300 rounded bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Masuk (PO)</div>
              <div className="font-mono text-sm font-bold text-emerald-800 tabular-nums">+{totalInflow}</div>
            </div>
            <div className="p-2 border border-slate-300 rounded bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Keluar (Tiket)</div>
              <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">-{totalOutflow}</div>
            </div>
            <div className="p-2 border border-slate-300 rounded bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Stok Menipis</div>
              <div className="font-mono text-sm font-bold text-amber-800 tabular-nums">{criticalCount}</div>
            </div>
            <div className="p-2 border border-slate-300 rounded bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Stok Habis (0)</div>
              <div className="font-mono text-sm font-bold text-red-800 tabular-nums">{outOfStockCount}</div>
            </div>
          </div>

          {/* 3. TABEL DATA RESMI (Repeating thead across printed pages) */}
          <div className="mt-4">
            <table className="w-full text-left border-collapse border border-slate-400 text-[11px] leading-tight">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-400 print:table-header-group">
                <tr>
                  <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">No</th>
                  <th className="py-2 px-2 border-r border-slate-300 w-24">SKU / Kode</th>
                  <th className="py-2 px-2 border-r border-slate-300">Deskripsi Barang</th>
                  <th className="py-2 px-2 border-r border-slate-300 w-20">Kategori</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right w-16">Awal</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right w-16 text-emerald-800">Masuk</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right w-16">Keluar</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right w-16 font-bold">Akhir</th>
                  <th className="py-2 px-2 border-r border-slate-300 w-12 text-center">Satuan</th>
                  <th className="py-2 px-2 text-center w-16">Status</th>
                </tr>
              </thead>
              <tbody>
                {itemsData.map((item, idx) => (
                  <tr key={item.sku} className="border-b border-slate-300 print:break-inside-avoid">
                    <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-mono font-semibold">{item.sku}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 font-medium">
                      <div>{item.name}</div>
                      {item.location && (
                        <div className="text-[9px] text-slate-500 font-mono">Lokasi: {item.location}</div>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-slate-600">{item.categoryName}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono tabular-nums">{item.startStock}</td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono tabular-nums text-emerald-800">
                      {item.totalIn > 0 ? `+${item.totalIn}` : '-'}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono tabular-nums">
                      {item.totalOut > 0 ? `-${item.totalOut}` : '-'}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold tabular-nums">
                      {item.endStock}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-600 font-mono text-[10px]">{item.unit}</td>
                    <td className="py-1.5 px-2 text-center font-bold text-[10px]">
                      {item.status === 'HABIS' ? (
                        <span className="text-red-700">HABIS</span>
                      ) : item.status === 'MENIPIS' ? (
                        <span className="text-amber-700">MENIPIS</span>
                      ) : (
                        <span className="text-emerald-700">AMAN</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. LEMBAR PENGESAHAN RESMI (Formal Signatures) */}
          <div className="pt-8 print:pt-12 print:break-inside-avoid">
            <div className="text-[10px] text-slate-500 font-mono mb-4 text-center">
              Lembar Validasi &amp; Pengesahan Audit Inventori Fisik Suku Cadang
            </div>

            <div className="grid grid-cols-3 gap-6 text-center text-xs text-slate-800">
              <div className="border border-slate-200 p-3 rounded bg-slate-50/50">
                <p className="font-semibold text-slate-700">Dibuat Oleh (Admin Logistik):</p>
                <div className="h-16 flex items-center justify-center">
                  <span className="text-slate-300 font-mono text-[10px] tracking-widest">( Tanda Tangan )</span>
                </div>
                <p className="font-bold underline text-slate-900">Siti Rahma</p>
                <p className="text-[10px] text-slate-500">Admin Logistik IT</p>
              </div>

              <div className="border border-slate-200 p-3 rounded bg-slate-50/50">
                <p className="font-semibold text-slate-700">Diverifikasi (Teknisi Lapangan):</p>
                <div className="h-16 flex items-center justify-center">
                  <span className="text-slate-300 font-mono text-[10px] tracking-widest">( Tanda Tangan )</span>
                </div>
                <p className="font-bold underline text-slate-900">
                  {user?.role === 'technician' ? user.name : 'Budi Santoso'}
                </p>
                <p className="text-[10px] text-slate-500">Lead Field Technician</p>
              </div>

              <div className="border border-slate-200 p-3 rounded bg-slate-50/50">
                <p className="font-semibold text-slate-700">Disetujui Oleh (Supervisor IT):</p>
                <div className="h-16 flex items-center justify-center">
                  <span className="text-slate-300 font-mono text-[10px] tracking-widest">( Tanda Tangan )</span>
                </div>
                <p className="font-bold underline text-slate-900">Hendra Wijaya, S.Kom</p>
                <p className="text-[10px] text-slate-500">Supervisor IT Infrastructure</p>
              </div>
            </div>
          </div>

          {/* 5. FOOTER DOKUMEN CETAK RESMI */}
          <div className="mt-8 pt-3 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500 font-mono print:break-inside-avoid">
            <span>FieldOps IT Asset &amp; Inventory v2 · Generated by System</span>
            <span>Halaman 1 dari 1 · Dokumen Sah Elektronik</span>
          </div>
        </div>

      </div>
    </div>
  );
};
