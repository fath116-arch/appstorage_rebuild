/**
 * Role Permissions Matrix Tab
 */

import React from 'react';
import {
  ShieldCheck,
  Wrench,
  Warehouse,
  CheckCircle2,
  X,
  Code2,
  Terminal
} from 'lucide-react';
import { isDeveloperRole } from '../../utils/permissions';

interface RoleMatrixTabProps {
  currentUserRole?: string;
}

const ROLE_MATRICES = [
  {
    role: 'developer',
    title: 'Developer',
    icon: Code2,
    badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    description: 'Master System Access: Akses penuh tanpa batas ke seluruh modul sistem, CLI server, otorisasi pengguna, dan debug teknis.',
    permissions: [
      { label: 'Lihat Katalog & Stok Suku Cadang', allowed: true },
      { label: 'Pencatatan Barang Masuk (Stock In)', allowed: true },
      { label: 'Pencatatan Barang Keluar (Stock Out)', allowed: true },
      { label: 'Tambah / Hapus / Edit Master Barang & Kategori', allowed: true },
      { label: 'Persetujuan Akun Pengguna Baru (Approval)', allowed: true },
      { label: 'Download Backup & Restore Database', allowed: true },
      { label: 'Akses Penuh Developer & Konfigurasi Server', allowed: true },
    ]
  },
  {
    role: 'admin',
    title: 'Admin Utama (Boss / Pimpinan)',
    icon: ShieldCheck,
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    description: 'Akses penuh manajemen bisnis: Pantau seluruh inventorisasi, persetujuan akun baru, audit trail, laporan pergerakan, dan cadangan data.',
    permissions: [
      { label: 'Lihat Katalog & Stok Suku Cadang', allowed: true },
      { label: 'Persetujuan Akun Pengguna Baru (Approval)', allowed: true },
      { label: 'Laporan Pergerakan & Audit Mutasi', allowed: true },
      { label: 'Pencatatan Barang Masuk (Stock In)', allowed: true },
      { label: 'Pencatatan Barang Keluar (Stock Out)', allowed: true },
      { label: 'Tambah / Hapus / Edit Master Barang & Kategori', allowed: true },
      { label: 'Download Backup & Restore Database', allowed: true },
    ]
  },
  {
    role: 'warehouse_admin',
    title: 'Admin Gudang IT',
    icon: Warehouse,
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    description: 'Pengelola operasional fisik gudang: Pencatatan barang masuk/keluar, kelola master barang & kategori, serta checklist tas teknisi.',
    permissions: [
      { label: 'Lihat Katalog & Stok Suku Cadang', allowed: true },
      { label: 'Pencatatan Barang Masuk (Stock In)', allowed: true },
      { label: 'Pencatatan Barang Keluar (Stock Out)', allowed: true },
      { label: 'Tambah / Hapus / Edit Master Barang & Kategori', allowed: true },
      { label: 'Checklist Tas Lapangan Teknisi', allowed: true },
      { label: 'Persetujuan Akun Pengguna Baru', allowed: false },
      { label: 'Download Backup & Restore Database', allowed: false },
    ]
  },
  {
    role: 'technician',
    title: 'Teknisi Lapangan',
    icon: Wrench,
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    description: 'Akses lapangan untuk pengambilan stok suku cadang (Stock Out), checklist tas kerja teknisi, dan integrasi tiket.',
    permissions: [
      { label: 'Lihat Katalog & Stok Suku Cadang', allowed: true },
      { label: 'Pencatatan Barang Keluar (Stock Out)', allowed: true },
      { label: 'Checklist Tas Lapangan Teknisi', allowed: true },
      { label: 'Integrasi Tiket Lapangan', allowed: true },
      { label: 'Pencatatan Barang Masuk (Stock In)', allowed: false },
      { label: 'Tambah / Hapus / Edit Barang Master', allowed: false },
      { label: 'Persetujuan Akun Pengguna Baru', allowed: false },
    ]
  }
];

export const RoleMatrixTab: React.FC<RoleMatrixTabProps> = ({ currentUserRole }) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLE_MATRICES.map((matrix) => {
          const Icon = matrix.icon;
          const isCurrentRole =
            currentUserRole === matrix.role ||
            (isDeveloperRole(currentUserRole) && matrix.role === 'developer');
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
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${matrix.badgeColor}`}>
                  {matrix.title}
                </span>
                <Icon className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 min-h-[36px]">
                {matrix.description}
              </p>

              <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700 pt-3">
                {matrix.permissions.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className={p.allowed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 line-through'}>
                      {p.label}
                    </span>
                    {p.allowed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
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
            Aturan Keamanan Akun Server-Side (Invarian Sistem)
          </div>
          <p className="text-slate-400 leading-relaxed mb-2">
            Akun dengan peran <strong>Developer</strong> dan <strong>Admin</strong> memiliki hak akses penuh ke seluruh fitur dan <em>hanya dapat diinisialisasi melalui terminal server (CLI)</em> untuk mencegah eskalasi hak akses dari antarmuka luar:
          </p>
          <code className="inline-block bg-slate-800 text-cyan-300 px-3 py-1.5 rounded-lg font-mono text-[11px] border border-slate-700">
            npm run setup:admin
          </code>
        </div>
      </div>
    </>
  );
};
