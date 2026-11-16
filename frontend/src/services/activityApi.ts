/**
 * Canonical Activities, Reports, Clock Verification & Actors API Client
 * FieldOps IT — Single Unified Ledger
 */

import { apiFetch } from './httpClient';

export interface ActivityDetailView {
  id: number;
  aktivitas_id: string;
  tipe_id?: number | null;
  item_id?: string | null;
  kode_id?: string | null;
  nama_snapshot: string;
  jumlah: number;
  status_sebelum?: string | null;
  status_sesudah?: string | null;
  kondisi_sebelum?: string | null;
  kondisi_sesudah?: string | null;
}

export interface CanonicalTransactionView {
  id: string;
  id_aktivitas: string;
  aksi: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'SYSTEM';
  tipe_mutasi: 'MASUK' | 'KELUAR' | 'TRANSFER' | 'SYSTEM';
  item_id?: string | null;
  tipe_id?: number | null;
  item_name: string;
  item_sku: string;
  item_unit: string;
  quantity: number;
  reference_type?: string | null;
  reference_number?: string | null;
  recipient_destination?: string | null;
  performed_by: string;
  actor_id?: string | null;
  actor_nama: string;
  recorded_by_id?: string | null;
  recorded_by_nama: string;
  is_on_behalf: boolean;
  on_behalf_reason?: string | null;
  occurred_at: string;
  recorded_at: string;
  waktu: string;
  request_id?: string | null;
  correction_of_id?: string | null;
  box_asal?: string | null;
  box_tujuan?: string | null;
  notes?: string | null;
  details: ActivityDetailView[];
}

export interface ActorOption {
  id: string;
  username: string;
  name: string;
  role: 'developer' | 'admin' | 'warehouse_admin' | 'technician' | string;
  department: string;
  status: string;
}

export interface WeeklyReportResponse {
  success: boolean;
  reportPeriod: {
    mode: string;
    startDate: string;
    endDate: string;
    startDateWib: string;
    endDateWib: string;
    label: string;
    timezone: string;
  };
  summary: {
    totalInQty: number;
    totalOutQty: number;
    totalInTxCount: number;
    totalOutTxCount: number;
    activeProductsCount: number;
    activeTipesCount: number;
    totalAvailableUnits: number;
    totalReservedUnits: number;
    totalDamagedUnits: number;
    heldByTechniciansCount: number;
    stockStatusBreakdown: {
      normal: number;
      lowStock: number;
      outOfStock: number;
    };
  };
  topMovingItems: Array<{
    itemId: string;
    name: string;
    sku: string;
    outQty: number;
    inQty: number;
  }>;
  dailyTrendWib: Array<{
    dateWib: string;
    inQty: number;
    outQty: number;
  }>;
  transactions: CanonicalTransactionView[];
}

export interface DebugClockResponse {
  success: boolean;
  timezone: string;
  processTzEnv: string;
  serverUtcIso: string;
  serverWibFormatted: string;
  serverWibDateKey: string;
  weekRangeWib: {
    startUtcIso: string;
    endUtcIso: string;
    startDateWib: string;
    endDateWib: string;
    label: string;
  };
}

export const activityApi = {
  async getTransactions(filters?: {
    type?: 'IN' | 'OUT' | 'TRANSFER' | 'SYSTEM';
    actorId?: string;
    requestId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit?: number;
  }): Promise<CanonicalTransactionView[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.actorId) params.append('actorId', filters.actorId);
    if (filters?.requestId) params.append('requestId', filters.requestId);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', String(filters.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await apiFetch<{ transactions?: CanonicalTransactionView[] }>(
      `/api/activities${qs}`,
      {},
      'Gagal memuat log aktivitas mutasi.'
    );
    return data.transactions || [];
  },

  async getDetails(aktivitasId: string): Promise<ActivityDetailView[]> {
    const data = await apiFetch<{ details?: ActivityDetailView[] }>(
      `/api/activities/${encodeURIComponent(aktivitasId)}/details`,
      {},
      'Gagal memuat rincian aktivitas.'
    );
    return data.details || [];
  },

  async correctTransaction(aktivitasId: string, payload: { alasan: string; occurred_at?: string }) {
    return apiFetch<{
      success: boolean;
      message: string;
      idAktivitas: string;
      transaksiId: string;
    }>(
      `/api/activities/${encodeURIComponent(aktivitasId)}/correct`,
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal mencatat entri koreksi audit.'
    );
  },

  async getWeeklyReport(week: 'current' | 'previous' | 'all' = 'current'): Promise<WeeklyReportResponse> {
    return apiFetch<WeeklyReportResponse>(
      `/api/reports/weekly?week=${encodeURIComponent(week)}`,
      {},
      'Gagal memuat laporan mingguan.'
    );
  },

  async getDebugClock(): Promise<DebugClockResponse> {
    return apiFetch<DebugClockResponse>(
      '/api/reports/debug-clock',
      {},
      'Gagal memuat informasi jam server.'
    );
  },

  async getActors(): Promise<ActorOption[]> {
    const data = await apiFetch<{ actors?: ActorOption[] }>(
      '/api/auth/actors',
      {},
      'Gagal memuat daftar pengguna.'
    );
    return data.actors || [];
  }
};
