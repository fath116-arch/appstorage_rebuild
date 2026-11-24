/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { activityApi, DEFAULT_REPORT_APPROVAL_CONFIG, ReportApprovalConfig } from '../services/activityApi';
import { useAuth } from '../context/AuthContext';
import { formatWibDateTime } from '../utils/timezone';

export interface PrintDocumentData {
  type: 'IN' | 'OUT';
  itemName: string;
  itemSku: string;
  quantity: number;
  unit: string;
  referenceNumber: string;
  recipientOrDestination: string;
  performedBy: string;
  notes: string;
  date: string;
}

interface PrintDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PrintDocumentData | null;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const { user } = useAuth();
  const [approvalConfig, setApprovalConfig] = useState<ReportApprovalConfig>(DEFAULT_REPORT_APPROVAL_CONFIG);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    activityApi
      .getReportApprovalConfig()
      .then((cfg) => {
        if (active && cfg) setApprovalConfig(cfg);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const isOut = data.type === 'OUT';
  const adminSigner = approvalConfig.signers[0];
  const supervisorSigner = approvalConfig.signers[2];
  const adminName = adminSigner.useCurrentUser ? (user?.name || adminSigner.name) : adminSigner.name;
  const supervisorName = supervisorSigner.useCurrentUser ? (user?.name || supervisorSigner.name) : supervisorSigner.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal bar */}
        <div className="no-print px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <span className="font-bold text-xs text-slate-700">
            Preview Dokumen Serah Terima Data Barang IT Lapangan
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-8 text-xs text-slate-900 font-sans leading-relaxed space-y-6">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start gap-4">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">
                {approvalConfig.companyName}
              </h1>
              <p className="text-[11px] text-slate-500">
                {approvalConfig.divisionName}
              </p>
              <p className="text-[10px] text-slate-400">
                {approvalConfig.companyAddress}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-bold text-sm uppercase px-2.5 py-1 bg-slate-100 border border-slate-300 rounded inline-block font-mono">
                {isOut ? 'SURAT PENGELUARAN BARANG' : 'SURAT PENERIMAAN BARANG'}
              </span>
              <p className="font-mono text-[11px] text-slate-600 mt-1 font-bold">
                REF: {data.referenceNumber}
              </p>
            </div>
          </div>

          {/* Meta Info Table */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Waktu Transaksi</span>
              <span className="font-medium text-slate-800">{formatWibDateTime(data.date)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Teknisi / Petugas PIC</span>
              <span className="font-bold text-slate-900">{data.performedBy}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                {isOut ? 'Tujuan Pemasangan / Lokasi Tiket' : 'Lokasi Gudang Penyimpanan'}
              </span>
              <span className="font-medium text-slate-800">{data.recipientOrDestination}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Status Verifikasi</span>
              <span className="font-mono font-bold text-emerald-700">VERIFIED &amp; DEDUCTED</span>
            </div>
          </div>

          {/* Item Details Table */}
          <div>
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <th className="py-2.5 px-3 border-r border-slate-300 w-12 text-center">No</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">Kode SKU</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">Deskripsi Data Barang</th>
                  <th className="py-2.5 px-3 text-right">Kuantitas</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-3 px-3 border-r border-slate-200 text-center font-mono">1</td>
                  <td className="py-3 px-3 border-r border-slate-200 font-mono font-bold">{data.itemSku}</td>
                  <td className="py-3 px-3 border-r border-slate-200 font-medium">
                    {data.itemName}
                    {data.notes && (
                      <div className="text-[10px] text-slate-500 mt-0.5 italic">
                        Catatan: {data.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-sm tabular-nums">
                    {data.quantity} {data.unit}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs text-slate-700">
            <div>
              <p className="font-medium text-slate-600">{adminSigner.roleLabel}:</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-slate-900">{adminName}</p>
              <p className="text-[10px] text-slate-400">{adminSigner.title}</p>
            </div>
            <div>
              <p className="font-medium text-slate-600">Diterima Teknisi Lapangan:</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-slate-900">{data.performedBy}</p>
              <p className="text-[10px] text-slate-400">Teknisi Lapangan</p>
            </div>
            <div>
              <p className="font-medium text-slate-600">{supervisorSigner.roleLabel}:</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-slate-900">{supervisorName}</p>
              <p className="text-[10px] text-slate-400">{supervisorSigner.title}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
