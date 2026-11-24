/**
 * Frontend Role-Based Access Control (RBAC) & Per-Account Feature Slider Helpers
 * FieldOps IT Inventory v1.2.8
 */

export type CanonicalRole = 'developer' | 'admin' | 'technician';

export type FeatureKey =
  | 'dashboard'
  | 'catalog_view'
  | 'catalog_manage'
  | 'catalog_import'
  | 'stock_in_out'
  | 'requests_create'
  | 'requests_manage'
  | 'checklist'
  | 'reports_view'
  | 'reports_export'
  | 'reports_config'
  | 'history_view'
  | 'history_correct'
  | 'sn_patterns'
  | 'wa_alert_recipients'
  | 'users_manage'
  | 'integration_tickets'
  | 'setup_check'
  | 'setup_database'
  | 'setup_tunnel'
  | 'security_audit';

export type FeaturePermissionsMap = Partial<Record<FeatureKey, boolean>>;

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  category: 'Operasional & Katalog' | 'Permohonan & Laporan' | 'Pengaturan & Sistem';
  defaultRoles: CanonicalRole[];
}

export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard Ringkasan',
    description: 'Statistik utama, grafik tren, dan status persediaan data barang.',
    category: 'Operasional & Katalog',
    defaultRoles: ['developer', 'admin', 'technician']
  },
  {
    key: 'catalog_view',
    label: 'Lihat Katalog Data Barang',
    description: 'Melihat daftar kategori, produk, varian tipe, box penyimpanan, dan stok.',
    category: 'Operasional & Katalog',
    defaultRoles: ['developer', 'admin', 'technician']
  },
  {
    key: 'catalog_manage',
    label: 'Kelola Katalog (Tambah / Edit / Hapus)',
    description: 'Membuat, mengubah, dan menghapus Kategori, Atribut, Produk, Tipe, dan Box.',
    category: 'Operasional & Katalog',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'catalog_import',
    label: 'Impor Excel & Google Spreadsheet',
    description: 'Mengunduh template serta mengimpor katalog, box, dan stok awal massal.',
    category: 'Operasional & Katalog',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'stock_in_out',
    label: 'Mutasi Gudang (Masuk, Keluar, Pindah Box)',
    description: 'Input stok ber-ID/jumlah, keranjang keluar, pindah box, arsip, dan restore.',
    category: 'Operasional & Katalog',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'requests_create',
    label: 'Ajukan Request & Tas Lapangan',
    description: 'Mengajukan permintaan ambil, pengembalian, pembelian barang, dan template tas.',
    category: 'Permohonan & Laporan',
    defaultRoles: ['developer', 'admin', 'technician']
  },
  {
    key: 'requests_manage',
    label: 'Proses & Setujui Request',
    description: 'Menyetujui, menolak, dan menyerahkan barang permohonan teknisi.',
    category: 'Permohonan & Laporan',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'checklist',
    label: 'Checklist Perlengkapan Lapangan',
    description: 'Mengisi dan melihat riwayat checklist perlengkapan sebelum tugas lapangan.',
    category: 'Permohonan & Laporan',
    defaultRoles: ['developer', 'admin', 'technician']
  },
  {
    key: 'reports_view',
    label: 'Laporan & Cetak Label/Dokumen',
    description: 'Melihat laporan mingguan, cetak dokumen pengesahan, dan cetak label QR.',
    category: 'Permohonan & Laporan',
    defaultRoles: ['developer', 'admin', 'technician']
  },
  {
    key: 'reports_export',
    label: 'Ekspor Data Excel / CSV',
    description: 'Mengunduh ekspor spreadsheet inventori dan laporan stok.',
    category: 'Permohonan & Laporan',
    defaultRoles: ['developer', 'admin', 'technician']
  },
  {
    key: 'reports_config',
    label: 'Atur Kop & Pengesahan Laporan',
    description: 'Mengubah nama instansi, divisi, dan penandatangan default pada lembar pengesahan.',
    category: 'Permohonan & Laporan',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'history_view',
    label: 'Riwayat Transaksi & Log Aktivitas',
    description: 'Melihat feed histori mutasi barang masuk, keluar, transfer, dan audit.',
    category: 'Permohonan & Laporan',
    defaultRoles: ['developer', 'admin', 'technician']
  },
  {
    key: 'history_correct',
    label: 'Koreksi Audit Log Transaksi',
    description: 'Mencatat entri koreksi resmi pada riwayat transaksi.',
    category: 'Permohonan & Laporan',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'sn_patterns',
    label: 'Kelola Pola Serial Number (SN)',
    description: 'Menambah, mengubah, atau menghapus aturan validasi dan normalisasi barcode SN.',
    category: 'Pengaturan & Sistem',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'wa_alert_recipients',
    label: 'WA Alert (4 Nomor Penerima & Ambang)',
    description: 'Mengelola daftar 4 slot nomor penerima WA, jam aktif, dan ambang stok (tanpa Gateway).',
    category: 'Pengaturan & Sistem',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'users_manage',
    label: 'Kelola Akun (Admin & Teknisi)',
    description: 'Membuat, menyetujui, menonaktifkan, dan mereset sandi akun Admin & Teknisi.',
    category: 'Pengaturan & Sistem',
    defaultRoles: ['developer', 'admin']
  },
  {
    key: 'integration_tickets',
    label: 'Integrasi Tiket & API Keys',
    description: 'Mengelola API key webhook sistem tiket eksternal (Jira, GLPI, Zendesk).',
    category: 'Pengaturan & Sistem',
    defaultRoles: ['developer']
  },
  {
    key: 'setup_check',
    label: 'Pemeriksaan Sistem & Diagnosa Login',
    description: 'Menjalankan cek konektivitas sistem dan diagnosa akun/sesi login.',
    category: 'Pengaturan & Sistem',
    defaultRoles: ['developer']
  },
  {
    key: 'setup_database',
    label: 'Konfigurasi Database & Backup',
    description: 'Mengatur koneksi MariaDB (.env), menguji koneksi, dan mengunduh backup JSON.',
    category: 'Pengaturan & Sistem',
    defaultRoles: ['developer']
  },
  {
    key: 'setup_tunnel',
    label: 'Cloudflare Tunnel & Akses Publik',
    description: 'Mengatur token Cloudflare Tunnel dan domain publik HTTPS.',
    category: 'Pengaturan & Sistem',
    defaultRoles: ['developer']
  },
  {
    key: 'security_audit',
    label: 'Audit Keamanan & Tempat Sampah',
    description: 'Akses log keamanan, retensi tempat sampah 14 hari, dan matriks peran.',
    category: 'Pengaturan & Sistem',
    defaultRoles: ['developer']
  }
];

export function normalizeRole(rawRole?: string | null): CanonicalRole {
  const clean = String(rawRole || '').trim().toLowerCase();
  if (clean === 'developer' || clean === 'superadmin') return 'developer';
  if (clean === 'admin' || clean === 'warehouse_admin' || clean === 'supervisor') return 'admin';
  return 'technician';
}

export function isDeveloperRole(role?: string | null): boolean {
  return normalizeRole(role) === 'developer';
}

export function isAdminOrDev(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'developer' || normalized === 'admin';
}

export function isWarehouseManager(role?: string | null): boolean {
  return isAdminOrDev(role);
}

export function canActOnBehalf(role?: string | null): boolean {
  return isAdminOrDev(role);
}

export function canOverrideOccurredAtLimit(role?: string | null): boolean {
  return isAdminOrDev(role);
}

export function canManageRequests(role?: string | null): boolean {
  return isAdminOrDev(role);
}

export function getRoleDisplayLabel(role?: string | null): string {
  const norm = normalizeRole(role);
  if (norm === 'developer') return 'Developer';
  if (norm === 'admin') return 'Admin';
  return 'Teknisi';
}

export function parseFeaturePermissions(raw?: string | FeaturePermissionsMap | null): FeaturePermissionsMap {
  if (!raw) return {};
  if (typeof raw === 'object') {
    const cleaned: FeaturePermissionsMap = {};
    for (const def of FEATURE_CATALOG) {
      if (typeof (raw as Record<string, unknown>)[def.key] === 'boolean') {
        cleaned[def.key] = (raw as Record<string, boolean>)[def.key];
      }
    }
    return cleaned;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parseFeaturePermissions(parsed as Record<string, unknown>);
    }
  } catch {
    // Ignore
  }
  return {};
}

export function getEffectiveFeaturePermissions(
  role?: string | null,
  overrides?: string | FeaturePermissionsMap | null
): Record<FeatureKey, boolean> {
  const normalizedRole = normalizeRole(role);
  const parsedOverrides = parseFeaturePermissions(overrides);
  const result = {} as Record<FeatureKey, boolean>;

  for (const def of FEATURE_CATALOG) {
    if (normalizedRole === 'developer') {
      result[def.key] = true;
    } else if (typeof parsedOverrides[def.key] === 'boolean') {
      result[def.key] = Boolean(parsedOverrides[def.key]);
    } else {
      result[def.key] = def.defaultRoles.includes(normalizedRole);
    }
  }
  return result;
}

export function isFeatureEnabled(
  user: { role?: string | null; feature_permissions?: FeaturePermissionsMap | string | null } | null | undefined,
  featureKey: FeatureKey
): boolean {
  if (!user) return false;
  const effective = getEffectiveFeaturePermissions(user.role, user.feature_permissions);
  return Boolean(effective[featureKey]);
}
