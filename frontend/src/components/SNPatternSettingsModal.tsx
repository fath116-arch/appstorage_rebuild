/**
 * SN Pattern Settings Modal (FieldOps IT Inventory v1.2.5 UPDATE 2)
 * Manage Serial Number Patterns, Simple Converter (#, A, ?, *), Pattern Tester, and Normalization Rules
 * Restricted to Developer and Admin Roles
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Plus, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  HelpCircle,
  Code,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { 
  SNPattern, 
  DEFAULT_SN_PATTERNS, 
  convertSimplePatternToRegex, 
  generateSimplePatternFromSample, 
  validatePatternMatch 
} from '../utils/snPatternUtils';

interface SNPatternSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatternsUpdated?: () => void;
}

export const SNPatternSettingsModal: React.FC<SNPatternSettingsModalProps> = ({
  isOpen,
  onClose,
  onPatternsUpdated
}) => {
  const { user } = useAuth();
  const { showToast } = useInventory();
  const isDevOrAdmin = user?.role === 'developer' || user?.role === 'admin';

  const [patterns, setPatterns] = useState<SNPattern[]>(DEFAULT_SN_PATTERNS);
  const [loading, setLoading] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [namaInput, setNamaInput] = useState<string>('');
  const [contohInput, setContohInput] = useState<string>('');
  const [polaSederhanaInput, setPolaSederhanaInput] = useState<string>('');
  const [polaRegexInput, setPolaRegexInput] = useState<string>('');
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const [autoUppercase, setAutoUppercase] = useState<boolean>(true);
  const [stripSpaces, setStripSpaces] = useState<boolean>(true);
  const [stripPrefixes, setStripPrefixes] = useState<boolean>(true);

  // Tester state
  const [testInput, setTestInput] = useState<string>('');

  // Memuat pola dari server
  const loadPatterns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sn-patterns');
      if (res.ok) {
        const data = await res.json();
        if (data.patterns && Array.isArray(data.patterns) && data.patterns.length > 0) {
          setPatterns(data.patterns);
        }
      }
    } catch {
      // Fallback local defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPatterns();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingId(null);
    setNamaInput('');
    setContohInput('');
    setPolaSederhanaInput('');
    setPolaRegexInput('');
    setIsAdvancedMode(false);
    setAutoUppercase(true);
    setStripSpaces(true);
    setStripPrefixes(true);
    setTestInput('');
  };

  if (!isOpen) return null;

  // Generate pola sederhana dari contoh SN
  const handleAutoGeneratePattern = () => {
    if (!contohInput.trim()) {
      showToast('Isi contoh SN terlebih dahulu.', 'warning');
      return;
    }
    const gen = generateSimplePatternFromSample(contohInput);
    setPolaSederhanaInput(gen);
    const reg = convertSimplePatternToRegex(gen);
    setPolaRegexInput(reg);
    showToast(`Pola "${gen}" berhasil dibuat dari contoh SN.`, 'success');
  };

  // Switch edit item
  const handleStartEdit = (pat: SNPattern) => {
    setEditingId(pat.id);
    setNamaInput(pat.nama);
    setContohInput(pat.contoh_sn);
    setPolaSederhanaInput(pat.pola_sederhana || '');
    setPolaRegexInput(pat.pola_regex || '');
    setIsAdvancedMode(Boolean(pat.is_advanced));
    setAutoUppercase(pat.auto_uppercase !== false);
    setStripSpaces(pat.strip_spaces !== false);
    setStripPrefixes(pat.strip_prefixes !== false);
    setTestInput(pat.contoh_sn);
  };

  // Toggle status aktif
  const handleToggleAktif = async (pat: SNPattern) => {
    if (!isDevOrAdmin) return;
    try {
      const res = await fetch(`/api/sn-patterns/${pat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif: !pat.aktif })
      });
      if (res.ok) {
        showToast(`Pola "${pat.nama}" ${!pat.aktif ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
        loadPatterns();
        if (onPatternsUpdated) onPatternsUpdated();
      }
    } catch {
      showToast('Gagal mengubah status pola.', 'error');
    }
  };

  // Simpan Pola
  const handleSubmitPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDevOrAdmin) {
      showToast('Akses ditolak: Hanya Developer & Admin yang dapat mengedit pola.', 'error');
      return;
    }

    if (!namaInput.trim() || !contohInput.trim()) {
      showToast('Nama pola dan contoh SN wajib diisi.', 'warning');
      return;
    }

    const finalRegex = isAdvancedMode
      ? polaRegexInput.trim()
      : convertSimplePatternToRegex(polaSederhanaInput);

    // Validasi Match: Contoh SN harus cocok
    if (!validatePatternMatch(contohInput.trim(), finalRegex)) {
      showToast(`Simpan ditolak: Contoh SN "${contohInput}" tidak cocok dengan polanya "${isAdvancedMode ? finalRegex : polaSederhanaInput}".`, 'error');
      return;
    }

    try {
      const payload = {
        nama: namaInput.trim(),
        pola_sederhana: polaSederhanaInput.trim(),
        contoh_sn: contohInput.trim(),
        pola_regex: finalRegex,
        is_advanced: isAdvancedMode,
        auto_uppercase: autoUppercase,
        strip_spaces: stripSpaces,
        strip_prefixes: stripPrefixes
      };

      const url = editingId ? `/api/sn-patterns/${editingId}` : '/api/sn-patterns';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Pola SN berhasil disimpan.', 'success');
        resetForm();
        loadPatterns();
        if (onPatternsUpdated) onPatternsUpdated();
      } else {
        showToast(data.message || 'Gagal menyimpan pola SN.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pola SN.', 'error');
    }
  };

  // Hapus Pola
  const handleDeletePattern = async (id: string, nama: string) => {
    if (!isDevOrAdmin) return;
    if (!confirm(`Hapus pola SN "${nama}"?`)) return;

    try {
      const res = await fetch(`/api/sn-patterns/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Pola "${nama}" berhasil dihapus.`, 'success');
        loadPatterns();
        if (onPatternsUpdated) onPatternsUpdated();
      }
    } catch {
      showToast('Gagal menghapus pola.', 'error');
    }
  };

  // Live test verification calculation
  const currentEvaluatedRegex = isAdvancedMode
    ? polaRegexInput.trim()
    : convertSimplePatternToRegex(polaSederhanaInput);
  const isTestMatching = testInput.trim()
    ? validatePatternMatch(testInput.trim(), currentEvaluatedRegex)
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col transition-colors">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Pengaturan Pola Serial Number (SN)</span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  v1.2.5 Update 2
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Konfigurasi format sederhana (#, A, ?, *) untuk memilih barcode SN murni dari router/modem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {!isDevOrAdmin && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Peran Anda (<strong className="font-semibold">{user?.role}</strong>) hanya dapat membaca daftar pola SN aktif. Perubahan konfigurasi dilindungi khusus Developer & Admin.
              </span>
            </div>
          )}

          {/* Table List of Existing Patterns */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                <span>Daftar Pola SN Aktif ({patterns.length})</span>
              </span>
              <button
                type="button"
                onClick={loadPatterns}
                className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Reload</span>
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <th className="p-2.5">Nama Pola</th>
                    <th className="p-2.5">Format Sederhana</th>
                    <th className="p-2.5">Contoh SN</th>
                    <th className="p-2.5 text-center">Status</th>
                    {isDevOrAdmin && <th className="p-2.5 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                  {patterns.map((pat) => (
                    <tr 
                      key={pat.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        editingId === pat.id ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : ''
                      }`}
                    >
                      <td className="p-2.5 font-sans font-bold text-slate-900 dark:text-slate-100">
                        {pat.nama}
                      </td>
                      <td className="p-2.5">
                        <code className="text-emerald-600 dark:text-emerald-400 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {pat.pola_sederhana || 'Custom Regex'}
                        </code>
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-300">
                        {pat.contoh_sn}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAktif(pat)}
                          disabled={!isDevOrAdmin}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            pat.aktif
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {pat.aktif ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      {isDevOrAdmin && (
                        <td className="p-2.5 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(pat)}
                              className="p-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Pola"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePattern(pat.id, pat.nama)}
                              className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Hapus Pola"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Guide Symbol Legend Banner */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
            <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
              Panduan Format Sederhana:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 font-mono">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">#</span> = 1 Angka (0-9)
              </div>
              <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 font-mono">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">A</span> = 1 Huruf Besar (A-Z)
              </div>
              <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 font-mono">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">?</span> = 1 Huruf / Angka
              </div>
              <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 font-mono">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">*</span> = Bebas (0+ karakter)
              </div>
            </div>
          </div>

          {/* Form Create / Edit Pattern (Admin/Dev Only) */}
          {isDevOrAdmin && (
            <form onSubmit={handleSubmitPattern} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{editingId ? 'Edit Pola SN' : 'Tambah Pola SN Baru'}</span>
                </span>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              {/* Nama Pola & Contoh SN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Perangkat / Pola <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: TP-Link EN020-F5"
                    value={namaInput}
                    onChange={(e) => setNamaInput(e.target.value)}
                    required
                    className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contoh SN Valid <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Contoh: 3213067005147"
                      value={contohInput}
                      onChange={(e) => {
                        setContohInput(e.target.value);
                        setTestInput(e.target.value);
                      }}
                      required
                      className="flex-1 py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAutoGeneratePattern}
                      className="px-2.5 py-1.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shrink-0 flex items-center gap-1"
                      title="Buat pola otomatis dari contoh SN"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Buat Pola</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Format Sederhana vs Mode Lanjutan Regex */}
              {!isAdvancedMode ? (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Format Sederhana (#, A, ?, *)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: ############# atau AA##-AA##"
                    value={polaSederhanaInput}
                    onChange={(e) => {
                      setPolaSederhanaInput(e.target.value);
                      setPolaRegexInput(convertSimplePatternToRegex(e.target.value));
                    }}
                    className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Mode Lanjutan Regex (Maksimal 100 Karakter)</span>
                    <span className="text-[10px] text-amber-500 font-mono">ReDoS Protected</span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Contoh: ^[0-9]{13}$"
                    value={polaRegexInput}
                    onChange={(e) => setPolaRegexInput(e.target.value)}
                    className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                  />
                </div>
              )}

              {/* Toggle Mode Lanjutan */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 text-[11px]">
                  <input
                    type="checkbox"
                    checked={isAdvancedMode}
                    onChange={(e) => setIsAdvancedMode(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Gunakan Mode Lanjutan (Regex Mentah)</span>
                </label>

                <div className="text-[10px] text-slate-400 font-mono">
                  Regex Dihasilkan: <code className="text-slate-700 dark:text-slate-300">{currentEvaluatedRegex}</code>
                </div>
              </div>

              {/* Interactive Pattern Tester */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                  Uji Pola (Ketik SN Lain untuk Tes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Masukkan SN contoh uji..."
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    className="flex-1 py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono"
                  />
                  {testInput.trim() ? (
                    isTestMatching ? (
                      <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Cocok ✅
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded font-bold text-[10px] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Tidak Cocok ❌
                      </span>
                    )
                  ) : null}
                </div>
              </div>

              {/* Opsi Normalisasi Barcode */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 text-[11px]">
                  Opsi Normalisasi Barcode Terbaca
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={autoUppercase}
                      onChange={(e) => setAutoUppercase(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Huruf Besar Otomatis</span>
                  </label>

                  <label className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={stripSpaces}
                      onChange={(e) => setStripSpaces(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Hapus Spasi Barcode</span>
                  </label>

                  <label className="flex items-center gap-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={stripPrefixes}
                      onChange={(e) => setStripPrefixes(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Buang Prefix S/N:, SN:</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-lg font-semibold"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 rounded-lg font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Simpan Perubahan' : 'Tambah Pola Baru'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg border border-slate-300 dark:border-slate-600"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
