/**
 * Login & Password Reset Screen (Server-Authoritative Authentication)
 * FieldOps IT - Login Terpusat (Pembuatan Akun dari Dalam Web / CLI Server)
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Lock, User, AlertCircle, ArrowRight, CheckCircle2, KeyRound, Mail, ArrowLeft } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!username.trim() || !password.trim()) {
          setErrorMsg('Username dan kata sandi wajib diisi.');
          setIsLoading(false);
          return;
        }
        const result = await login(username.trim(), password);
        if (result.success) {
          onLoginSuccess?.();
        } else {
          setErrorMsg(result.message || 'Username atau kata sandi tidak cocok.');
        }
      } else {
        if (!username.trim() || !password.trim()) {
          setErrorMsg('Username dan kata sandi baru wajib diisi.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('Konfirmasi kata sandi tidak cocok.');
          setIsLoading(false);
          return;
        }
        const result = await api.resetPassword({
          username: username.trim(),
          email: email.trim(),
          newPassword: password.trim()
        });

        if (result.success) {
          setSuccessMsg(result.message || 'Kata sandi berhasil diperbarui! Silakan masuk.');
          setPassword('');
          setConfirmPassword('');
          setEmail('');
          setTimeout(() => {
            setMode('login');
          }, 2500);
        } else {
          setErrorMsg(result.message || 'Gagal memperbarui kata sandi.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghubungi server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white dark:bg-slate-100 border border-slate-200 dark:border-slate-300/60 shadow-md p-2 mb-1 overflow-hidden">
            <img
              src="/logo.webp"
              alt="FieldOps IT Icon"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 font-display">
            FieldOps IT
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Sistem Inventarisasi Data Barang &amp; Manajemen IT Lapangan
          </p>
        </div>

        {/* Forgot mode banner */}
        {mode === 'forgot' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span>Reset / Pemulihan Kata Sandi</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {mode === 'forgot' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Terdaftar (Opsional)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Contoh: budi@fieldops.local (Opsional)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {mode === 'forgot' ? 'Kata Sandi Baru' : 'Kata Sandi'}
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium"
                >
                  Lupa Kata Sandi?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'forgot' ? 'Masukkan kata sandi baru...' : 'Masukkan kata sandi...'}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {mode === 'forgot' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Konfirmasi Kata Sandi Baru
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm mt-3"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : mode === 'login' ? (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Simpan Kata Sandi Baru</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Security Notice */}
        <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 text-center space-y-1.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Pembuatan akun hanya tersedia dari dalam aplikasi oleh Admin/Developer atau melalui terminal server (<code className="font-mono text-[10px]">npm run setup:admin</code>).
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            Sistem Inventarisasi Data Barang · FieldOps IT
          </p>
        </div>
      </div>
    </div>
  );
};
