/**
 * Role Permissions Matrix Tab
 * FieldOps IT v1.2.8 — 3 Canonical Roles (Developer, Admin, Teknisi)
 */

import React from 'react';
import {
  ShieldCheck,
  Wrench,
  CheckCircle2,
  X,
  Code2,
  Terminal
} from 'lucide-react';
import { normalizeRole } from '../../utils/permissions';

interface RoleMatrixTabProps {
  currentUserRole?: string;
}

const ROLE_MATRICES = [
  {
    role: 'developer',
    title: 'Developer',
    icon: Code2,
    badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    description: 'Akses penuh seluruh sistem: infrastruktur DB/Tunnel, Gateway WA Ganda, Audit Keamanan, serta kontrol fitur ON/OFF per akun.',
    permissions: [
      { label: 'Katalog Data Barang, Box, Impor Excel & Mutasi Gudang', allowed: true },
      { label: 'Kelola Akun (Semua Peran) + Slider Fitur Per Akun', allowed: true },
      { label: 'Konfigurasi Gateway WA Ganda (Gateway 1 & 2) + 4 Slot Penerima', allowed: true },
      { label: 'Setup Database MariaDB, Backup JSON & Cloudflare Tunnel', allowed: true },
      { label: 'Integrasi Tiket Webhook, Audit Keamanan & Tempat Sampah', allowed: true },
      { label: 'Pengaturan Pola Serial Number (SN) & Laporan Pengesahan', allowed: true },
    ]
  },
  {
    role: 'admin',
    title: 'Admin',
    icon: ShieldCheck,
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    description: 'Peran terpadu manajemen gudang & operasional harian: katalog, mutasi stok, request, user Admin/Teknisi, 4 slot WA Alert, & Pola SN.',
    permissions: [
      { label: 'Katalog Data Barang, Box, Impor Excel & Mutasi Gudang', allowed: true },
      { label: 'Kelola Request Pengambilan, Pengembalian & Pembelian Barang', allowed: true },
      { label: 'Buat, Setujui & Kelola Akun (Khusus Admin & Teknisi)', allowed: true },
      { label: 'WA Alert (4 Slot Penerima ON/OFF, Ambang & Watchlist)', allowed: true },
      { label: 'Pengaturan Pola Serial Number (SN) & Kop Laporan', allowed: true },
      { label: 'Gateway WA (URL/Token), Setup DB/Tunnel & Atur Fitur Akun', allowed: false },
    ]
  },
  {
    role: 'technician',
    title: 'Teknisi Lapangan',
    icon: Wrench,
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    description: 'Akses lapangan untuk melihat stok data barang, mengajukan request ambil/pembelian, mengisi checklist tas kerja, & laporan.',
    permissions: [
      { label: 'Lihat Katalog & Stok Data Barang', allowed: true },
      { label: 'Ajukan Request Ambil, Pengembalian & Pembelian Barang', allowed: true },
      { label: 'Checklist & Template Tas Lapangan Teknisi', allowed: true },
      { label: 'Riwayat Transaksi & Laporan Pergerakan', allowed: true },
      { label: 'Mutasi Gudang / Kelola Katalog / Hapus Barang', allowed: false },
      { label: 'Menu Setting (User, WA, Pola SN, Infrastruktur)', allowed: false },
    ]
  }
];

export const RoleMatrixTab: React.FC<RoleMatrixTabProps> = ({ currentUserRole }) => {
  const normalizedCurrent = currentUserRole ? normalizeRole(currentUserRole) : null;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ROLE_MATRICES.map((matrix) => {
          const Icon = matrix.icon;
          const isCurrentRole = normalizedCurrent === matrix.role;
          return (
            <div
              key={matrix.role}
              className={`p-4 rounded-xl border transition-all ${
                isCurrentRole
                  ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${matrix.badgeColor}`}>
                  {matrix.title}
                </span>
                <Icon className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 min-h-[42px]">
                {matrix.description}
              </p>

              <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700 pt-3">
                {matrix.permissions.map((p, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                    <span className={p.allowed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 line-through'}>
                      {p.label}
                    </span>
                    {p.allowed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Server-Side Rule Notice */}
      <div className="p-4 rounded-xl bg-slate-900 text-slate-200 text-xs flex items-start gap-3 border border-slate-800">
        <Terminal className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-white mb-1">
            Pembuatan Akun Tertutup Dari Halaman Login (Server &amp; Internal Web Only)
          </div>
          <p className="text-slate-400 leading-relaxed mb-2">
            Pendaftaran publik dari halaman Login telah dinonaktifkan. Akun baru hanya dapat dibuat oleh <strong>Admin</strong> (khusus peran Admin/Teknisi), oleh <strong>Developer</strong>, atau melalui terminal server CLI (termasuk inisialisasi akun Developer/Master):
          </p>
          <code className="inline-block bg-slate-800 text-cyan-300 px-3 py-1.5 rounded-lg font-mono text-[11px] border border-slate-700">
            npm run setup:admin
          </code>
        </div>
      </div>
    </>
  );
};

