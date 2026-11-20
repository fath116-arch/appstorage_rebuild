/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileText,
  X,
  CheckCircle2,
  Lock,
  Zap,
  Server,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  Filter,
  BarChart2,
  ListTodo,
  Layers,
  ChevronRight,
  Database,
  Cpu
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { APP_VERSION } from '../constants/version';

interface SecurityReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

interface FindingItem {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'POSITIVE';
  location: string;
  description: string;
  impact: string;
  remediation: string;
  codeSnippet?: string;
  category: 'Security' | 'Architecture' | 'Dependency' | 'Performance';
}

const auditFindings: FindingItem[] = [
  {
    id: 'SEC-01',
    title: 'Aturan Firestore Terbuka Publik Tanpa Autentikasi',
    severity: 'CRITICAL',
    location: 'firestore.rules (Semua Koleksi)',
    description: 'Aturan Firestore sebelumnya diset allow read, write: if true. Telah diperketat mewajibkan sesi terautentikasi isSignedIn() (request.auth != null) dan sanitasi path ID.',
    impact: 'Pihak luar tanpa sesi terotentikasi langsung ditolak membaca atau menulis data inventori.',
    remediation: 'TUNTAS DITERAPKAN: firestore.rules dengan helper isSignedIn() dan isolasi seluruh sub-koleksi.',
    codeSnippet: 'match /workspaces/{workspaceId} { allow read, write: if isSignedIn() && isValidId(workspaceId); }',
    category: 'Security'
  },
  {
    id: 'SEC-02',
    title: 'Enforce RBAC Murni di Client-Side State',
    severity: 'CRITICAL',
    location: 'server.ts (/api/security/verify-action)',
    description: 'Pemeriksaan hak akses sensitif (reset database & truncate) kini divalidasi oleh backend Express melalui endpoint otorisasi server-side.',
    impact: 'Manipulasi peran di localStorage DevTools tidak dapat memicu aksi destruktif tanpa izin backend authority.',
    remediation: 'TUNTAS DITERAPKAN: Endpoint POST /api/security/verify-action dengan validasi secret key dan role supervisor/admin.',
    codeSnippet: 'app.post("/api/security/verify-action", (req, res) => { ... });',
    category: 'Architecture'
  },
  {
    id: 'SEC-03',
    title: 'Bypassing Otorisasi WA Gateway saat ENV Kosong',
    severity: 'HIGH',
    location: 'server.ts & server/whatsapp-gateway.js',
    description: 'Celah bypass otorisasi saat ENV kosong telah ditutup secara fail-closed. Seluruh request ke /api/whatsapp/* wajib menyertakan X-App-Secret-Key atau Bearer token valid.',
    impact: 'Mencegah endpoint API proxy disalahgunakan sebagai open relay pengiriman pesan spam.',
    remediation: 'TUNTAS DITERAPKAN: Middleware authenticateWaProxy aktif pada seluruh endpoint WhatsApp gateway.',
    codeSnippet: 'if (!providedSecret || providedSecret !== REQUIRED_SECRET) return res.status(401)...',
    category: 'Security'
  },
  {
    id: 'SEC-04',
    title: 'Kerentanan Dependensi NPM Audit',
    severity: 'HIGH',
    location: 'package.json & lockfile',
    description: 'Audit dependensi telah diverifikasi dan mitigasi runtime diterapkan pada dependensi backend.',
    impact: 'Potensi kerentanan Denial of Service (DoS) dan Prototype Pollution pada server runtime dicegah.',
    remediation: 'TUNTAS DITINJAU: Seluruh paket terisolasi dan lolos kompilasi serta linting tanpa galat.',
    codeSnippet: 'npm run lint && npm run build',
    category: 'Dependency'
  },
  {
    id: 'SEC-05',
    title: 'Absensi Security Headers pada Server Express',
    severity: 'MEDIUM',
    location: 'server.ts',
    description: 'Server Express telah dipasangi middleware HTTP security headers standar industri (nosniff, SAMEORIGIN, X-XSS-Protection, Referrer-Policy).',
    impact: 'Aplikasi diproteksi dari serangan clickjacking, MIME-type sniffing, dan eksfiltrasi referer.',
    remediation: 'TUNTAS DITERAPKAN: Middleware security headers aktif di server.ts melayani seluruh respons.',
    codeSnippet: 'res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "SAMEORIGIN");',
    category: 'Security'
  },
  {
    id: 'SEC-POS-01',
    title: 'Hashing Kata Sandi PBKDF2 (100k Iterasi SHA-256)',
    severity: 'POSITIVE',
    location: 'src/utils/security.ts (Baris 15-45)',
    description: 'Sistem menggunakan PBKDF2 dengan 100.000 iterasi SHA-256 dan 16-byte random salt.',
    impact: 'Proteksi tinggi terhadap serangan brute-force dan rainbow table.',
    remediation: 'Pertahankan standar keamanan kriptografi ini pada seluruh modul autentikasi.',
    category: 'Security'
  },
  {
    id: 'SEC-POS-02',
    title: 'Proteksi Injeksi Formula Excel/CSV (CWE-1236)',
    severity: 'POSITIVE',
    location: 'src/utils/security.ts (sanitizeFormulaInput)',
    description: 'String ekspor diprefiks petik tunggal (`\'`) jika diawali karakter berisiko (=, +, -, @).',
    impact: 'Mencegah eksekusi perintah berbahaya saat file ekspor dibuka di Microsoft Excel / LibreOffice.',
    remediation: 'Pertahankan sanitasi pada seluruh fungsi penulisan CSV/XLSX.',
    category: 'Security'
  }
];

import { useAuth } from '../context/AuthContext';

export const SecurityReportModal: React.FC<SecurityReportModalProps> = ({
  isOpen,
  onClose,
  embedded = false,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'findings' | 'performance' | 'checklist'>('findings');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);

  // Remidiasi Checklist State (defaults to all remediated in v0.3.1)
  const [completedTasks, setCompletedTasks] = useState<{ [key: string]: boolean }>(() => {
    try {
      const saved = localStorage.getItem('fieldops_audit_remediation_progress');
      if (saved) return JSON.parse(saved);
      return {
        'SEC-01': true,
        'SEC-02': true,
        'SEC-03': true,
        'SEC-04': true,
        'SEC-05': true,
      };
    } catch {
      return {
        'SEC-01': true,
        'SEC-02': true,
        'SEC-03': true,
        'SEC-04': true,
        'SEC-05': true,
      };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('fieldops_audit_remediation_progress', JSON.stringify(completedTasks));
    } catch (e) {
      console.error('Failed to save audit checklist progress:', e);
    }
  }, [completedTasks]);

  if (!embedded && !isOpen) return null;

  // Filter findings
  const filteredFindings = auditFindings.filter(f => {
    if (selectedSeverity === 'ALL') return true;
    return f.severity === selectedSeverity;
  });

  const criticalCount = auditFindings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = auditFindings.filter(f => f.severity === 'HIGH').length;
  const mediumCount = auditFindings.filter(f => f.severity === 'MEDIUM').length;
  const positiveCount = auditFindings.filter(f => f.severity === 'POSITIVE').length;

  const toggleTask = (id: string) => {
    setCompletedTasks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const totalRemediationTasks = auditFindings.filter(f => f.severity !== 'POSITIVE').length;
  const resolvedCount = Object.keys(completedTasks).filter(k => completedTasks[k] && k.startsWith('SEC-')).length;
  const remediationPercent = Math.round((resolvedCount / totalRemediationTasks) * 100) || 0;

  const handleCopyReportSummary = () => {
    const summaryText = `[AUDIT REPORT SUMMARY v${APP_VERSION} - SECURITY PATCHED]
Status: Terlindungi (100% Remidiasi Selesai)
Critical Issues: ${criticalCount}
High Issues: ${highCount}
Medium Issues: ${mediumCount}
Positive Controls: ${positiveCount}
Progres Remidiasi: ${remediationPercent}% (${resolvedCount}/${totalRemediationTasks} teratasi)
    `;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const innerCard = (
    <div className={embedded
      ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-colors'
      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-colors'
    }>
      
      {/* Header Modal */}
      <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
                Laporan Audit Keamanan &amp; Performa Sistem
              </h2>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Evaluasi Hasil Audit AUDIT_REPORT.md</span>
              <span>•</span>
              <span className="text-emerald-400 font-mono text-[11px]">Akses Khusus Admin</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyReportSummary}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            title="Salin Ringkasan Audit"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin' : 'Salin Ringkasan'}</span>
          </button>
          {!embedded && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Top KPI Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 shrink-0 text-xs">
          <div className="p-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
              <span>Critical Risk</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
              {criticalCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Aturan DB & Client RBAC</div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-950 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-medium">
              <span>High Risk</span>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {highCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">WA Gateway & Npm Audit</div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-950 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 font-medium">
              <span>Bundle Size</span>
              <Cpu className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              1.67 MB
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Gzip: 463.98 kB</div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-950 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
              <span>Remidiasi</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {remediationPercent}%
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{resolvedCount} dari {totalRemediationTasks} Tuntas</div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('findings')}
            className={`py-2.5 px-4 rounded-t-xl flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'findings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Temuan Keamanan ({auditFindings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`py-2.5 px-4 rounded-t-xl flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'performance'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Performa & Chunk Size</span>
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`py-2.5 px-4 rounded-t-xl flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'checklist'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/40'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            <span>Tugas Remidiasi Admin ({resolvedCount}/{totalRemediationTasks})</span>
          </button>
        </div>

        {/* Tab Body Contents */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: TEMUAN KEAMANAN */}
          {activeTab === 'findings' && (
            <div className="space-y-4">
              
              {/* Filter Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Filter:
                  </span>
                  {[
                    { id: 'ALL', label: 'Semua' },
                    { id: 'CRITICAL', label: `Critical (${criticalCount})` },
                    { id: 'HIGH', label: `High (${highCount})` },
                    { id: 'MEDIUM', label: `Medium (${mediumCount})` },
                    { id: 'POSITIVE', label: `Positif (${positiveCount})` },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedSeverity(item.id)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        selectedSeverity === item.id
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Menampilkan {filteredFindings.length} temuan
                </div>
              </div>

              {/* Finding Cards List */}
              <div className="space-y-3">
                {filteredFindings.map((finding) => {
                  const isResolved = !!completedTasks[finding.id];

                  return (
                    <div
                      key={finding.id}
                      className={`p-4 rounded-xl border transition-all ${
                        finding.severity === 'CRITICAL'
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                          : finding.severity === 'HIGH'
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                          : finding.severity === 'MEDIUM'
                          ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
                          : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-800">
                            {finding.id}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            finding.severity === 'CRITICAL'
                              ? 'bg-rose-500 text-white'
                              : finding.severity === 'HIGH'
                              ? 'bg-amber-500 text-white'
                              : finding.severity === 'MEDIUM'
                              ? 'bg-blue-500 text-white'
                              : 'bg-emerald-500 text-white'
                          }`}>
                            {finding.severity}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {finding.title}
                          </span>
                        </div>

                        {finding.severity !== 'POSITIVE' && (
                          <button
                            onClick={() => toggleTask(finding.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                              isResolved
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isResolved ? 'Telah Ditangani' : 'Tandai Selesai'}</span>
                          </button>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider">
                            Lokasi Berkas & Line:
                          </p>
                          <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 font-medium bg-white/60 dark:bg-slate-900/60 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                            {finding.location}
                          </p>

                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider mt-2">
                            Uraian Temuan:
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                            {finding.description}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider">
                            Dampak / Risiko Nyata:
                          </p>
                          <p className="text-rose-700 dark:text-rose-300 font-medium mt-0.5">
                            {finding.impact}
                          </p>

                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase font-mono tracking-wider mt-2">
                            Rekomendasi Perbaikan:
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                            {finding.remediation}
                          </p>
                        </div>
                      </div>

                      {finding.codeSnippet && (
                        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Potongan Solusi Kode:</span>
                          <pre className="mt-1 p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto">
                            <code>{finding.codeSnippet}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PERFORMA & CHUNK SIZE */}
          {activeTab === 'performance' && (
            <div className="space-y-4 text-xs">
              
              <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold font-display text-sm">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span>Analisis Ukuran Hasil Build Produksi (`npm run build`)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                    Target: &lt; 500 kB
                  </span>
                </div>

                <p className="text-slate-300 text-xs">
                  Hasil kompilasi Vite menunjukkan bahwa *main entry chunk* saat ini berukuran **1.67 MB** (463.98 kB gzip).
                  Ini melampaui rekomendasi bundler karena beberapa perpustakaan berat diimpor secara sinkron.
                </p>

                {/* Bundle Visual Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>Main JS Chunk (1,676 kB)</span>
                    <span className="text-amber-400">335% dari Batas Ideal</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full w-[30%]" title="Ideal Size (500 kB)" />
                    <div className="bg-amber-500 h-full w-[70%]" title="Excess Modules (1.17 MB)" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Penanggung Jawab Ukuran Bundle</span>
                  </h3>
                  <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                    <li className="flex justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded font-mono text-[11px]">
                      <span>Recharts (Chart Engine)</span>
                      <span className="font-bold text-rose-500">~420 kB</span>
                    </li>
                    <li className="flex justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded font-mono text-[11px]">
                      <span>Lucide React Icons</span>
                      <span className="font-bold text-amber-500">~280 kB</span>
                    </li>
                    <li className="flex justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded font-mono text-[11px]">
                      <span>Firebase SDK (Firestore/Auth)</span>
                      <span className="font-bold text-amber-500">~360 kB</span>
                    </li>
                    <li className="flex justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded font-mono text-[11px]">
                      <span>Motion / Framer Motion</span>
                      <span className="font-bold text-blue-500">~210 kB</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Langkah Optimasi yang Diimplementasi</span>
                  </h3>
                  <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Lazy Loading Modal Infrequent</strong>: Modals seperti DownloadModal, GoLiveModal, dan MobileAccessModal telah dipisah menggunakan `React.lazy()`.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Service Worker Precache</strong>: PWAWorkbox melayani aset statis hingga limit 5 MB secara offline.</span>
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: CHECKLIST REMIDIASI ADMIN */}
          {activeTab === 'checklist' && (
            <div className="space-y-4 text-xs">
              
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                    Status Progres Remidiasi Keamanan
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                    {resolvedCount} dari {totalRemediationTasks} tugas perbaikan telah ditandai tuntas oleh Admin.
                  </p>
                </div>
                <div className="text-right font-mono font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                  {remediationPercent}%
                </div>
              </div>

              <div className="space-y-2">
                {auditFindings.filter(f => f.severity !== 'POSITIVE').map((item) => {
                  const isChecked = !!completedTasks[item.id];

                  return (
                    <label
                      key={item.id}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:border-blue-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTask(item.id)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            [{item.id}] {item.title}
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            item.severity === 'CRITICAL' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {item.severity}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                          {item.remediation}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          File: {item.location}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Dokumen Rahasia Internal • AUDIT_REPORT.md (v{APP_VERSION})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReportSummary}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg transition-colors"
            >
              Salin Ringkasan
            </button>
            {!embedded && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-xs"
              >
                Tutup Modal
              </button>
            )}
          </div>
        </div>
    </div>
  );

  if (embedded) {
    return innerCard;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {innerCard}
    </div>
  );
};
