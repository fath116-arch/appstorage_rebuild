/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, UserProfile } from '../services/api';
import { 
  X, 
  ShieldCheck, 
  Wrench, 
  Warehouse, 
  Eye, 
  CheckCircle2, 
  Server,
  Terminal,
  LogOut,
  UserPlus,
  Users,
  AlertCircle,
  UserCheck,
  UserX,
  Trash2,
  Code2,
  Clock,
  Ban,
  KeyRound
} from 'lucide-react';

interface UserRoleSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserRoleSwitcher: React.FC<UserRoleSwitcherProps> = ({
  isOpen,
  onClose
}) => {
  const { user, logout } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'matrix' | 'approvals' | 'users' | 'add'>('matrix');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'developer' | 'admin' | 'supervisor' | 'technician'>('technician');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isDeveloper = user?.role === 'developer' || (user?.role as any) === 'superadmin';
  const isAdminOrDev = isDeveloper || user?.role === 'admin';

  const loadUsers = () => {
    if (!isAdminOrDev) return;
    setIsLoadingUsers(true);
    api.getUsers()
      .then(res => setUsersList(res))
      .catch(() => {})
      .finally(() => setIsLoadingUsers(false));
  };

  useEffect(() => {
    if (isOpen && isAdminOrDev) {
      loadUsers();
    }
  }, [isOpen, isAdminOrDev]);

  if (!isOpen) return null;

  const pendingUsers = usersList.filter(u => u.status === 'PENDING_APPROVAL');

  const handleApprove = async (userId: string, username: string) => {
    try {
      const res = await api.approveUser(userId);
      if (res.success) {
        setActionNotice({ type: 'success', text: `Akun "${username}" telah disetujui dan kini AKTIF.` });
        loadUsers();
      } else {
        setActionNotice({ type: 'error', text: res.message || 'Gagal menyetujui akun.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Gagal menyetujui akun.' });
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleReject = async (userId: string, username: string) => {
    if (!window.confirm(`Yakin ingin menolak pendaftaran akun "${username}"?`)) return;
    try {
      const res = await api.rejectUser(userId);
      if (res.success) {
        setActionNotice({ type: 'success', text: `Pendaftaran akun "${username}" telah DITOLAK.` });
        loadUsers();
      } else {
        setActionNotice({ type: 'error', text: res.message || 'Gagal menolak akun.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Gagal menolak akun.' });
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleToggleStatus = async (userId: string, currentStatus: string, username: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await api.updateUserStatus(userId, nextStatus);
      if (res.success) {
        setActionNotice({ 
          type: 'success', 
          text: `Status akun "${username}" berhasil diubah menjadi ${nextStatus}.` 
        });
        loadUsers();
      } else {
        setActionNotice({ type: 'error', text: res.message || 'Gagal mengubah status akun.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Gagal mengubah status.' });
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Hapus permanen akun "${username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await api.deleteUser(userId);
      if (res.success) {
        setActionNotice({ type: 'success', text: `Akun "${username}" berhasil dihapus secara permanen.` });
        loadUsers();
      } else {
        setActionNotice({ type: 'error', text: res.message || 'Gagal menghapus akun.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Gagal menghapus akun.' });
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleAdminResetPassword = async (userId: string, username: string) => {
    const pass = window.prompt(`Masukkan Kata Sandi Baru untuk akun "@${username}":`);
    if (!pass || pass.trim().length === 0) return;
    try {
      const res = await api.adminResetPassword(userId, pass.trim());
      if (res.success) {
        setActionNotice({ type: 'success', text: `Kata sandi akun "@${username}" berhasil direset.` });
      } else {
        setActionNotice({ type: 'error', text: res.message || 'Gagal mereset kata sandi.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Gagal mereset kata sandi.' });
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    if (!newUsername.trim() || !newPassword.trim()) {
      setFormMsg({ type: 'error', text: 'Username dan kata sandi wajib diisi.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createUser({
        username: newUsername.trim(),
        name: newName.trim() || newUsername.trim(),
        email: newEmail.trim() || `${newUsername.trim().toLowerCase()}@fieldops.local`,
        role: newRole,
        password: newPassword,
        status: 'ACTIVE'
      });

      if (res.success) {
        setFormMsg({ type: 'success', text: `Akun "${newUsername}" (${newRole}) berhasil dibuat langsung AKTIF!` });
        setNewUsername('');
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        loadUsers();
        setTimeout(() => setActiveTab('users'), 1000);
      } else {
        setFormMsg({ type: 'error', text: res.message || 'Gagal membuat akun.' });
      }
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message || 'Gagal menghubungi server.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleMatrices = [
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-100 border border-slate-200 dark:border-slate-300/50 flex items-center justify-center p-1 shadow-xs overflow-hidden shrink-0">
              <img src="/logo.webp" alt="FieldOps IT Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base font-display">
                  Manajemen Akun, Peran &amp; Persetujuan
                </h3>
                <span className="text-[10px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-300 dark:border-cyan-800">
                  Developer &amp; Admin Full Access
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Persetujuan akun di bawah Admin dikelola langsung di sini.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className={`mx-6 mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
            actionNotice.type === 'error'
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {actionNotice.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{actionNotice.text}</span>
          </div>
        )}

        {/* Current Active Session Info */}
        {user && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm text-white ${
                user.role === 'developer' ? 'bg-cyan-600' : user.role === 'admin' ? 'bg-emerald-600' : user.role === 'supervisor' ? 'bg-purple-600' : 'bg-blue-600'
              }`}>
                {user.role === 'developer' ? <Code2 className="w-5 h-5" /> : user.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{user.name}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    @{user.username}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    user.role === 'developer'
                      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                      : user.role === 'admin'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300'
                  }`}>
                    {user.role} (Full Access)
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                  <span>Divisi: <strong>{user.department}</strong></span>
                  <span>Status: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{user.status}</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                logout();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout Sesi</span>
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 pt-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'matrix'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Matriks Hak Akses</span>
          </button>

          {isAdminOrDev && (
            <>
              <button
                onClick={() => setActiveTab('approvals')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'approvals'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Persetujuan Akun</span>
                {pendingUsers.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                    {pendingUsers.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'users'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Daftar Pengguna ({usersList.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('add')}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === 'add'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Buat Akun Server</span>
              </button>
            </>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[58vh] overflow-y-auto space-y-6">
          
          {/* TAB 1: Matriks Hak Akses */}
          {activeTab === 'matrix' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roleMatrices.map((matrix) => {
                  const Icon = matrix.icon;
                  const isCurrentRole = user?.role === matrix.role || ((user?.role as any) === 'superadmin' && matrix.role === 'developer');
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
          )}

          {/* TAB 2: Persetujuan Akun Baru (Approvals) */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Permohonan Akun Menunggu Persetujuan</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Akun baru yang mendaftar mandiri (di bawah Admin) memerlukan persetujuan sebelum dapat masuk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadUsers}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Segarkan Data
                </button>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="p-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tidak ada permohonan akun yang menunggu persetujuan.
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Semua pendaftaran akun telah diproses oleh Admin.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingUsers.map((u) => (
                    <div 
                      key={u.id}
                      className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 dark:text-white font-semibold">{u.name}</strong>
                          <span className="font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[11px]">
                            @{u.username}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            u.role === 'supervisor' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            Peran: {u.role}
                          </span>
                          <span className="bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 font-bold px-2 py-0.5 rounded text-[10px]">
                            Menunggu Persetujuan
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                          <span>Email: {u.email}</span>
                          <span>&bull;</span>
                          <span>Divisi: {u.department || 'IT Operations'}</span>
                          {u.created_at && (
                            <>
                              <span>&bull;</span>
                              <span>Daftar: {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApprove(u.id, u.username)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Setujui Akun</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(u.id, u.username)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Daftar Seluruh Pengguna */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Daftar Seluruh Akun Pengguna Terdaftar
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kelola status akses (Aktif / Nonaktif) dan hak akses pengguna.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Tambah Akun</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {isLoadingUsers ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Memuat data pengguna...
                  </div>
                ) : usersList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada data pengguna.
                  </div>
                ) : (
                  usersList.map((u) => {
                    const isSelf = user?.id === u.id;
                    return (
                      <div key={u.id} className="p-3.5 bg-white dark:bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-900 dark:text-white font-semibold">{u.name}</strong>
                            <span className="font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                              @{u.username}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded">
                                Anda
                              </span>
                            )}
                            <span className={`capitalize px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'developer'
                                ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                                : u.role === 'admin'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : u.role === 'supervisor'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {u.role}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{u.email}</span>
                            <span>&bull;</span>
                            <span>{u.department}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Status Badge */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : u.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : u.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {u.status === 'PENDING_APPROVAL' ? 'Menunggu Approval' : u.status}
                          </span>

                          {/* Quick Actions */}
                          {u.status === 'PENDING_APPROVAL' ? (
                            <button
                              type="button"
                              onClick={() => handleApprove(u.id, u.username)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] cursor-pointer"
                            >
                              Setujui
                            </button>
                          ) : !isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u.id, u.status, u.username)}
                              className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                u.status === 'ACTIVE'
                                  ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200'
                                  : 'bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          )}

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => handleAdminResetPassword(u.id, u.username)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors cursor-pointer"
                            title="Reset Kata Sandi"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Akun"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Tambah Pengguna Baru (Server Created) */}
          {activeTab === 'add' && (
            <form onSubmit={handleCreateUser} className="space-y-4 max-w-lg mx-auto">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Pembuatan Akun Langsung (Server-Side)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Akun yang dibuat melalui panel ini akan langsung berstatus <strong>AKTIF</strong> tanpa proses approval tambahan.
                </p>
              </div>

              {formMsg && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  formMsg.type === 'error'
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {formMsg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Contoh: budi"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Contoh: budi@fieldops.local"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Peran Pengguna
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {isDeveloper && (
                    <option value="developer">Developer (Master System Engineering &amp; Full Access)</option>
                  )}
                  <option value="admin">Admin Utama / Boss (Full Access Manajemen &amp; Approval)</option>
                  <option value="warehouse_admin">Admin Gudang IT (Kelola Barang, Stok In &amp; Out)</option>
                  <option value="technician">Teknisi Lapangan (Pengambilan Suku Cadang &amp; Checklist)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kata Sandi *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan kata sandi akun..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan & Aktifkan Pengguna Sekarang'}
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-500" />
            <span>Satu Kantor Tunggal &bull; MariaDB 11.x Server</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-700 hover:bg-slate-800 transition-colors font-medium cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
