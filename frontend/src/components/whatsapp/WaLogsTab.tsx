/**
 * WhatsApp Delivery Logs Tab
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { WaLogItem } from '../../services/whatsappService';

interface WaLogsTabProps {
  logs: WaLogItem[];
  onRefreshLogs: () => void;
}

export const WaLogsTab: React.FC<WaLogsTabProps> = ({ logs, onRefreshLogs }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Riwayat Log Pengiriman WhatsApp
          </h3>
          <p className="text-slate-500 text-xs">
            Catatan pengiriman riil via Fonnte Gateway beserta pemicu dan status pengiriman.
          </p>
        </div>
        <button
          onClick={onRefreshLogs}
          className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan Log</span>
        </button>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
            <tr>
              <th className="py-2.5 px-3">Waktu</th>
              <th className="py-2.5 px-3">Pemicu</th>
              <th className="py-2.5 px-3">Penerima</th>
              <th className="py-2.5 px-3">Ringkasan Pesan</th>
              <th className="py-2.5 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                  Belum ada riwayat pengiriman alert WhatsApp.
                </td>
              </tr>
            ) : (
              logs.map(lg => (
                <tr key={lg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {new Date(lg.sent_at).toLocaleString('id-ID')}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 font-sans">
                    {lg.trigger_type}
                  </td>
                  <td className="py-2.5 px-3 max-w-xs truncate" title={lg.recipients}>
                    {lg.recipients}
                  </td>
                  <td className="py-2.5 px-3 max-w-md font-sans text-slate-700 dark:text-slate-300">
                    <div>{lg.message_snippet}</div>
                    {lg.fonnte_response && (
                      <div className="text-[10px] text-slate-400 font-mono italic">
                        Gateway: {lg.fonnte_response}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">
                    {lg.fonnte_status === 'SUCCESS' ? (
                      <span className="text-emerald-700 dark:text-emerald-400">BERHASIL</span>
                    ) : lg.fonnte_status === 'SIMULATED' ? (
                      <span className="text-blue-700 dark:text-blue-400">SIMULASI</span>
                    ) : lg.fonnte_status === 'COOLDOWN_QUEUED' ? (
                      <span className="text-amber-700 dark:text-amber-400">DIANTREKAN</span>
                    ) : (
                      <span className="text-red-700 dark:text-red-400">GAGAL</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
