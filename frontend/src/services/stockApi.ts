/**
 * Stock & Box API Client (FieldOps Inventory v2 - Tahap 3)
 */

import { apiFetch } from './httpClient';

export interface Box {
  id: string;
  kode: string;
  keterangan?: string | null;
  aktif: boolean | number;
  dibuat_pada: string;
  total_item?: number;
}

export interface BoxContentItem {
  id: string;
  kode_id: string;
  tipe_id: number;
  box_id: string;
  kode_box?: string;
  status: string;
  dibuat_pada: string;
  nama_tipe: string;
  nama_produk: string;
  kondisi?: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
  catatan_kondisi?: string | null;
}

export interface BoxContentsResponse {
  success: boolean;
  box: Box;
  total_items: number;
  total_stok_jumlah: number;
  contents: {
    [produkNama: string]: {
      [tipeNama: string]: {
        items: BoxContentItem[];
        stokJumlah: number;
      };
    };
  };
  raw_items: BoxContentItem[];
  raw_stok_jumlah: Array<{ tipe_id: number; box_id: string; jumlah: number; nama_tipe?: string; nama_produk?: string }>;
}

export const stockApi = {
  async listBoxes(): Promise<Box[]> {
    const data = await apiFetch<{ boxes?: Box[] }>('/api/boxes', {}, 'Gagal memuat daftar box.');
    return data.boxes || [];
  },

  async getBoxContents(boxIdOrKode: string): Promise<BoxContentsResponse> {
    return apiFetch<BoxContentsResponse>(
      `/api/boxes/${encodeURIComponent(boxIdOrKode)}`,
      {},
      'Gagal memuat isi box.'
    );
  },

  async createBox(kode: string, keterangan?: string): Promise<Box> {
    const data = await apiFetch<{ box: Box }>(
      '/api/boxes',
      { method: 'POST', body: JSON.stringify({ kode, keterangan }) },
      'Gagal membuat box baru.'
    );
    return data.box;
  },

  async pindahBox(payload: {
    item_id?: string;
    tipe_id?: number;
    box_asal_id: string;
    box_tujuan_id: string;
    jumlah?: number;
    catatan?: string;
  }): Promise<{ success: boolean; message: string; activityId: string }> {
    return apiFetch<{ success: boolean; message: string; activityId: string }>(
      '/api/boxes/move',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal memindahkan barang antar box.'
    );
  },

  async checkDuplicateId(kodeId: string): Promise<{ exists: boolean; item?: BoxContentItem }> {
    return apiFetch<{ exists: boolean; item?: BoxContentItem }>(
      `/api/stock/check-id/${encodeURIComponent(kodeId)}`,
      {},
      'Gagal memeriksa ID.'
    );
  },

  async inputSingleStock(payload: {
    tipe_id: number;
    box_id: string;
    kode_id: string;
    catatan?: string;
  }) {
    return apiFetch<{ success: boolean; message: string; itemId?: string; kodeId?: string; activityId?: string }>(
      '/api/stock/single',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal input stok tunggal.'
    );
  },

  async inputBulkStock(payload: {
    tipe_id: number;
    box_id: string;
    kode_ids?: string[];
    auto_count?: number;
    catatan?: string;
    confirmation_token?: string;
  }) {
    return apiFetch<{ success: boolean; message: string; totalCount?: number; activityId?: string }>(
      '/api/stock/bulk',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal input stok massal.'
    );
  },

  async inputQuantityStock(payload: {
    tipe_id: number;
    box_id: string;
    jumlah: number;
    catatan?: string;
  }) {
    return apiFetch<{ success: boolean; message: string; activityId?: string }>(
      '/api/stock/quantity',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal input stok jumlah.'
    );
  }
};
