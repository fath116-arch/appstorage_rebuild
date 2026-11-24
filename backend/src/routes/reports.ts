/**
 * Weekly Reports, Clock Debug & Data Export Router (Canonical Catalog + Strict WIB Boundaries + CWE-1236)
 * FieldOps IT — Single Unified Source of Truth
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireFeature } from '../middleware/authMiddleware';
import { CatalogService } from '../services/catalogService';
import { ActivityLogService } from '../services/activityLogService';
import { RequestService } from '../services/requestService';
import { SettingService } from '../services/settingService';
import { sanitizeFormulaInput } from '../utils/security';
import {
  APP_TIMEZONE,
  formatWibDateTime,
  getWibDateKey,
  getWibDaysRange,
  getWibWeekRange,
  nowUtcIso
} from '../utils/timezone';

const router = express.Router();

export interface ReportSignerConfig {
  roleLabel: string;
  name: string;
  title: string;
  useCurrentUser: boolean;
}

export interface ReportApprovalConfig {
  companyName: string;
  divisionName: string;
  companyAddress: string;
  signers: [ReportSignerConfig, ReportSignerConfig, ReportSignerConfig];
}

export const DEFAULT_REPORT_APPROVAL_CONFIG: ReportApprovalConfig = {
  companyName: 'PT. SOLUSI INFORMATIKA LAPANGAN',
  divisionName: 'Divisi Operasional & Manajemen Infrastruktur IT Lapangan',
  companyAddress: 'Gedung Pusat Operasi IT · Jl. Sudirman Kav. 45, Jakarta Pusat · Telp: (021) 555-0199 · info@fieldops.id',
  signers: [
    {
      roleLabel: 'Dibuat Oleh (Admin Logistik)',
      name: 'Admin Logistik IT',
      title: 'Admin Inventori & Logistik IT',
      useCurrentUser: true
    },
    {
      roleLabel: 'Diverifikasi (Teknisi Lapangan)',
      name: 'Lead Field Technician',
      title: 'Lead Field Technician',
      useCurrentUser: false
    },
    {
      roleLabel: 'Disetujui Oleh (Supervisor IT)',
      name: 'Supervisor IT Infrastructure',
      title: 'Supervisor IT Infrastructure',
      useCurrentUser: false
    }
  ]
};

function sanitizeApprovalConfig(raw: any): ReportApprovalConfig {
  const companyName = String(raw?.companyName || '').trim() || DEFAULT_REPORT_APPROVAL_CONFIG.companyName;
  const divisionName = String(raw?.divisionName || '').trim() || DEFAULT_REPORT_APPROVAL_CONFIG.divisionName;
  const companyAddress = String(raw?.companyAddress || '').trim() || DEFAULT_REPORT_APPROVAL_CONFIG.companyAddress;
  const rawSigners = Array.isArray(raw?.signers) ? raw.signers : [];

  const normalizedSigners = DEFAULT_REPORT_APPROVAL_CONFIG.signers.map((def, idx) => {
    const s = rawSigners[idx] || {};
    return {
      roleLabel: String(s.roleLabel || '').trim() || def.roleLabel,
      name: String(s.name || '').trim() || def.name,
      title: String(s.title || '').trim() || def.title,
      useCurrentUser: s.useCurrentUser !== undefined ? Boolean(s.useCurrentUser) : def.useCurrentUser
    };
  }) as [ReportSignerConfig, ReportSignerConfig, ReportSignerConfig];

  return {
    companyName,
    divisionName,
    companyAddress,
    signers: normalizedSigners
  };
}

/**
 * GET /api/reports/approval-config
 * Mengambil konfigurasi Kop Surat & Penandatangan Lembar Pengesahan Laporan
 */
router.get('/approval-config', requireAuth, async (_req, res) => {
  try {
    const raw = await SettingService.getJSON<any>('REPORT_APPROVAL_CONFIG');
    const config = sanitizeApprovalConfig(raw && Object.keys(raw).length > 0 ? raw : DEFAULT_REPORT_APPROVAL_CONFIG);
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.json({ success: true, config: DEFAULT_REPORT_APPROVAL_CONFIG, fallback: err?.message });
  }
});

/**
 * PUT /api/reports/approval-config
 * Menyimpan konfigurasi Kop Surat & Penandatangan Lembar Pengesahan Laporan secara permanen
 */
router.put(
  '/approval-config',
  requireAuth,
  requireFeature('reports_config'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const sanitized = sanitizeApprovalConfig(req.body);
      await SettingService.set(
        'REPORT_APPROVAL_CONFIG',
        JSON.stringify(sanitized),
        'Konfigurasi Kop Surat dan Penandatangan Lembar Pengesahan Laporan Stok'
      );

      await ActivityLogService.recordActivity({
        aksi: 'ubah_pengaturan',
        pelaku_id: req.user!.id,
        catatan: `Memperbarui konfigurasi Kop & Lembar Pengesahan laporan (${sanitized.companyName})`
      });

      return res.json({
        success: true,
        message: 'Konfigurasi Kop & Lembar Pengesahan laporan berhasil disimpan.',
        config: sanitized
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/reports/debug-clock
 * Endpoint verifikasi jam server (UTC), WIB (Asia/Jakarta), dan env TZ
 */
router.get('/debug-clock', requireAuth, (_req, res) => {
  const now = new Date();
  res.json({
    success: true,
    timezone: APP_TIMEZONE,
    processTzEnv: process.env.TZ || '(unset)',
    serverUtcIso: nowUtcIso(),
    serverWibFormatted: formatWibDateTime(now),
    serverWibDateKey: getWibDateKey(now),
    weekRangeWib: getWibWeekRange(0, now)
  });
});

/**
 * GET /api/reports/weekly
 * Rekap mingguan (Senin 00:00 WIB - Minggu 23:59:59.999 WIB) + stok katalog tunggal + tren 30 hari WIB
 * Query params: ?week=current|previous|all
 */
router.get('/weekly', requireAuth, requireFeature('reports_view'), async (req, res) => {
  try {
    const weekMode = String(req.query.week || 'current');
    const now = new Date();
    const weekOffset = weekMode === 'previous' ? -1 : 0;
    const weekRange = getWibWeekRange(weekOffset, now);

    const [products, transactions, heldItems] = await Promise.all([
      CatalogService.listProdukWithFullDetails(),
      ActivityLogService.getTransactionsFeed({
        dateFrom: weekMode === 'all' ? undefined : weekRange.startUtcIso,
        dateTo: weekMode === 'all' ? undefined : weekRange.endUtcIso,
        limit: 1000
      }),
      RequestService.listHeldByTechnicians()
    ]);

    let totalInQty = 0;
    let totalOutQty = 0;
    let totalInTxCount = 0;
    let totalOutTxCount = 0;

    const movingStats = new Map<string, { itemId: string; name: string; sku: string; outQty: number; inQty: number }>();

    for (const tx of transactions) {
      if (tx.type === 'IN') {
        totalInQty += tx.quantity;
        totalInTxCount += 1;
      } else if (tx.type === 'OUT') {
        totalOutQty += tx.quantity;
        totalOutTxCount += 1;
      }

      if (tx.type === 'IN' || tx.type === 'OUT') {
        for (const d of tx.details) {
          const key = d.tipe_id ? `tipe-${d.tipe_id}` : d.nama_snapshot;
          const existing = movingStats.get(key) || {
            itemId: key,
            name: d.nama_snapshot,
            sku: d.kode_id || (d.tipe_id ? `TIPE-${d.tipe_id}` : tx.id_aktivitas),
            outQty: 0,
            inQty: 0
          };
          const q = Number(d.jumlah || 1);
          if (tx.type === 'OUT') existing.outQty += q;
          if (tx.type === 'IN') existing.inQty += q;
          movingStats.set(key, existing);
        }
      }
    }

    const topMoving = Array.from(movingStats.values())
      .sort((a, b) => (b.outQty + b.inQty) - (a.outQty + a.inQty))
      .slice(0, 8);

    // Hitung status stok katalog tunggal saat ini
    let normalCount = 0;
    let lowCount = 0;
    let outCount = 0;
    let totalTipes = 0;
    let totalAvailableUnits = 0;
    let totalReservedUnits = 0;
    let totalDamagedUnits = 0;

    for (const p of products) {
      const tipes = p.tipes || [];
      for (const t of tipes) {
        totalTipes++;
        totalAvailableUnits += Number(t.stok_tersedia || 0);
        totalReservedUnits += Number(t.stok_dipesan || 0);
        totalDamagedUnits += Number(t.stok_rusak || 0);
        if (t.status_stok === 'habis') outCount++;
        else if (t.status_stok === 'menipis') lowCount++;
        else normalCount++;
      }
    }

    // Tren harian 30 hari terakhir berbasis kalender WIB
    const daysRange = getWibDaysRange(30, now);
    const all30DayTxs = await ActivityLogService.getTransactionsFeed({
      dateFrom: daysRange.startUtcIso,
      dateTo: daysRange.endUtcIso,
      limit: 1000
    });
    const dailyMap = new Map<string, { dateWib: string; inQty: number; outQty: number }>();
    for (const key of daysRange.dayKeys) {
      dailyMap.set(key, { dateWib: key, inQty: 0, outQty: 0 });
    }
    for (const tx of all30DayTxs) {
      const key = getWibDateKey(tx.occurred_at || tx.waktu);
      const bucket = dailyMap.get(key);
      if (bucket) {
        if (tx.type === 'IN') bucket.inQty += tx.quantity;
        else if (tx.type === 'OUT') bucket.outQty += tx.quantity;
      }
    }

    res.json({
      success: true,
      reportPeriod: {
        mode: weekMode,
        startDate: weekRange.startUtcIso,
        endDate: weekRange.endUtcIso,
        startDateWib: weekRange.startDateWib,
        endDateWib: weekRange.endDateWib,
        label: weekMode === 'all' ? 'Seluruh Riwayat Waktu (WIB)' : weekRange.label,
        timezone: APP_TIMEZONE
      },
      summary: {
        totalInQty,
        totalOutQty,
        totalInTxCount,
        totalOutTxCount,
        activeProductsCount: products.length,
        activeTipesCount: totalTipes,
        totalAvailableUnits,
        totalReservedUnits,
        totalDamagedUnits,
        heldByTechniciansCount: heldItems.length,
        stockStatusBreakdown: {
          normal: normalCount,
          lowStock: lowCount,
          outOfStock: outCount
        }
      },
      topMovingItems: topMoving,
      dailyTrendWib: Array.from(dailyMap.values()),
      transactions
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/reports/export/csv
 * Ekspor CSV Katalog Tunggal Tersanitasi Penuh (CWE-1236 Prevention)
 */
router.get('/export/csv', requireAuth, requireFeature('reports_export'), async (_req, res) => {
  try {
    const products = await CatalogService.listProdukWithFullDetails();

    const headers = [
      'Jenis',
      'Nama Produk',
      'Kategori Barang',
      'Kategori Perputaran',
      'Tipe / Varian',
      'Aturan ID',
      'Stok Tersedia',
      'Stok Dipesan',
      'Stok Rusak',
      'Satuan',
      'Status Stok',
      'Sebaran Box'
    ];

    const rows: Array<Array<string | number>> = [];
    for (const p of products) {
      const tipes = p.tipes || [];
      if (tipes.length === 0) {
        rows.push([
          sanitizeFormulaInput(p.jenis_nama || ''),
          sanitizeFormulaInput(p.nama),
          sanitizeFormulaInput(p.kategori_barang || 'Barang Habis Pakai'),
          sanitizeFormulaInput(p.kategori),
          '-',
          '-',
          p.total_stok || 0,
          0,
          p.stok_rusak || 0,
          sanitizeFormulaInput(p.tipe_stok || 'unit'),
          sanitizeFormulaInput((p.status_stok || 'habis').toUpperCase()),
          '-'
        ]);
      } else {
        for (const t of tipes) {
          const boxesText = (t.sebaran_box || []).map(b => `${b.box_kode}:${b.jumlah}`).join('; ') || '-';
          rows.push([
            sanitizeFormulaInput(p.jenis_nama || ''),
            sanitizeFormulaInput(p.nama),
            sanitizeFormulaInput(p.kategori_barang || 'Barang Habis Pakai'),
            sanitizeFormulaInput(p.kategori),
            sanitizeFormulaInput(t.nama_tipe),
            sanitizeFormulaInput(t.sumber_id.toUpperCase()),
            t.stok_tersedia || 0,
            t.stok_dipesan || 0,
            t.stok_rusak || 0,
            sanitizeFormulaInput(p.tipe_stok || 'unit'),
            sanitizeFormulaInput((t.status_stok || 'aman').toUpperCase()),
            sanitizeFormulaInput(boxesText)
          ]);
        }
      }
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=fieldops-inventory-${getWibDateKey(new Date())}.csv`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
