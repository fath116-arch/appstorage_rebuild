/**
 * Request, Reservation, Pickup, & Return API Client
 * FieldOps IT — Canonical Single Flow
 */

import { apiFetch } from './httpClient';

export type RequestStatus =
  | 'diajukan'
  | 'menunggu'
  | 'disetujui'
  | 'diambil'
  | 'dikembalikan'
  | 'ditolak'
  | 'dibatalkan';

export interface RequestRecord {
  id: string;
  pemohon_id: string;
  actor_id?: string | null;
  recorded_by_id?: string | null;
  penyetuju_id?: string | null;
  tipe_id: number;
  box_id?: string | null;
  kode_id?: string | null;
  jumlah: number;
  alasan: string;
  catatan_penolakan?: string | null;
  status: RequestStatus;
  dibuat_pada: string;
  diproses_pada?: string | null;
  taken_at?: string | null;
  returned_at?: string | null;
  returned_by_id?: string | null;
  return_condition?: string | null;
  return_notes?: string | null;
  return_box_id?: string | null;
  return_box_kode?: string | null;
  allocated_item_ids?: string | null;
  transaction_out_id?: string | null;
  transaction_in_id?: string | null;
  nama_pemohon?: string;
  username_pemohon?: string;
  nama_penyetuju?: string;
  username_penyetuju?: string;
  nama_tipe?: string;
  nama_produk?: string;
  kategori_barang?: 'Alat' | 'Barang Habis Pakai';
  tipe_stok?: string;
  mode_stok?: 'per_id' | 'jumlah';
  kode_box?: string;
  held_duration_ms?: number | null;
  request_type?: 'ambil' | 'kembalikan';
  origin_request_id?: string | null;
  has_pending_return?: boolean;
}

export interface RequestTimelineEntry {
  id_aktivitas: string;
  aksi: string;
  waktu: string;
  occurred_at?: string;
  recorded_at?: string;
  pelaku_id?: string;
  nama_pelaku?: string;
  actor_nama?: string;
  recorded_by_nama?: string;
  is_on_behalf?: boolean;
  catatan?: string;
}

export const requestApi = {
  async list(filters?: { status?: string; pemohon_id?: string; search?: string }): Promise<RequestRecord[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.pemohon_id) params.append('pemohon_id', filters.pemohon_id);
    if (filters?.search) params.append('search', filters.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await apiFetch<{ requests?: RequestRecord[] }>(
      `/api/requests${qs}`,
      {},
      'Gagal memuat daftar permohonan barang.'
    );
    return data.requests || [];
  },

  async listHeld(actorId?: string): Promise<RequestRecord[]> {
    const qs = actorId ? `?actor_id=${encodeURIComponent(actorId)}` : '';
    const data = await apiFetch<{ items?: RequestRecord[] }>(
      `/api/requests/held${qs}`,
      {},
      'Gagal memuat daftar barang di tangan teknisi.'
    );
    return data.items || [];
  },

  async listOpenForActor(actorId: string): Promise<RequestRecord[]> {
    const data = await apiFetch<{ requests?: RequestRecord[] }>(
      `/api/requests/open-for-actor/${encodeURIComponent(actorId)}`,
      {},
      'Gagal memuat request terbuka untuk teknisi.'
    );
    return data.requests || [];
  },

  async getById(id: string): Promise<RequestRecord> {
    const data = await apiFetch<{ data: RequestRecord }>(
      `/api/requests/${encodeURIComponent(id)}`,
      {},
      'Gagal memuat detail request.'
    );
    return data.data;
  },

  async getTimeline(id: string): Promise<RequestTimelineEntry[]> {
    const data = await apiFetch<{ timeline?: RequestTimelineEntry[] }>(
      `/api/requests/${encodeURIComponent(id)}/timeline`,
      {},
      'Gagal memuat timeline aktivitas request.'
    );
    return data.timeline || [];
  },

  async create(payload: {
    tipe_id?: number;
    box_id?: string;
    kode_id?: string;
    jumlah?: number;
    alasan?: string;
    actor_id?: string;
    on_behalf_reason?: string;
    request_type?: 'ambil' | 'kembalikan';
    origin_request_id?: string;
    return_condition?: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
    return_box_id?: string;
    return_notes?: string;
  }): Promise<RequestRecord> {
    const data = await apiFetch<{ data: RequestRecord }>(
      '/api/requests',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal mengajukan permohonan barang.'
    );
    return data.data;
  },

  async approve(id: string, payload?: { target_box_id?: string; confirmation_token?: string }) {
    return apiFetch<{ success: boolean; message: string; activityId?: string; allocatedKodeIds?: string[] }>(
      `/api/requests/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify(payload || {}) },
      'Gagal menyetujui permohonan.'
    );
  },

  async pickup(id: string, payload?: { occurred_at?: string; catatan?: string }) {
    return apiFetch<{ success: boolean; message: string; activityId?: string }>(
      `/api/requests/${encodeURIComponent(id)}/pickup`,
      { method: 'POST', body: JSON.stringify(payload || {}) },
      'Gagal mencatat pengambilan barang request.'
    );
  },

  async returnRequest(id: string, payload: {
    return_condition: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
    return_box_id: string;
    return_notes?: string;
    occurred_at?: string;
  }) {
    return apiFetch<{ success: boolean; message: string; activityId?: string }>(
      `/api/requests/${encodeURIComponent(id)}/return`,
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal mencatat pengembalian alat/barang.'
    );
  },

  async reject(id: string, payload?: { catatan_penolakan?: string; confirmation_token?: string }) {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/requests/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify(payload || {}) },
      'Gagal menolak permohonan.'
    );
  },

  async cancel(id: string, catatan?: string) {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/requests/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', body: JSON.stringify({ catatan }) },
      'Gagal membatalkan permohonan.'
    );
  }
};
