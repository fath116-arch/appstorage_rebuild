/**
 * Create Server User Tab
 */

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/errorUtils';

export type CreatableRole = 'developer' | 'admin' | 'warehouse_admin' | 'technician';

interface CreateUserTabProps {
  isDeveloper: boolean;
  onUserCreated: () => void;
}

export const CreateUserTab: React.FC<CreateUserTabProps> = ({
  isDeveloper,
  onUserCreated
}) => {
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<CreatableRole>('technician');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

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
        onUserCreated();
      } else {
        setFormMsg({ type: 'error', text: res.message || 'Gagal membuat akun.' });
      }
    } catch (err: unknown) {
      setFormMsg({ type: 'error', text: getErrorMessage(err, 'Gagal menghubungi server.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
          onChange={(e) => setNewRole(e.target.value as CreatableRole)}
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
  );
};
