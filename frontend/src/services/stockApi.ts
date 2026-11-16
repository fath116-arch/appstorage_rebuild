/**
 * Stock & Box API Client (Canonical Single Model)
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

export interface SearchStockItemResult {
  id: string;
  kode_id: string;
  tipe_id: number;
  nama_tipe: string;
  produk_id: number;
  nama_produk: string;
  jenis_nama?: string;
  box_id: string;
  box_kode: string;
  status: 'aktif' | 'dipesan' | 'keluar' | 'dihapus' | string;
  kondisi: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak' | string;
  tipe_stok: string;
  kategori_barang: 'Alat' | 'Barang Habis Pakai';
  selectable: boolean;
  unselectableReason?: string | null;
}

export interface StockAttributionPayload {
  actor_id?: string;
  on_behalf_reason?: string;
  occurred_at?: string;
  request_id?: string;
  reference_number?: string;
  recipient_destination?: string;
}

export interface ArchivedItemRecord {
  id: string;
  kode_id: string;
  tipe_id: number;
  box_id: string;
  status: string;
  kondisi?: string;
  nama_tipe?: string;
  nama_produk?: string;
  kode_box?: string;
  dibuat_pada?: string;
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

  async searchItems(q: string): Promise<SearchStockItemResult[]> {
    const data = await apiFetch<{ items?: SearchStockItemResult[] }>(
      `/api/stock/search?q=${encodeURIComponent(q)}`,
      {},
      'Gagal mencari item stok.'
    );
    return data.items || [];
  },

  async checkDuplicateId(kodeId: string): Promise<{ exists: boolean; item?: BoxContentItem }> {
    return apiFetch<{ exists: boolean; item?: BoxContentItem }>(
      `/api/stock/check-id/${encodeURIComponent(kodeId)}`,
      {},
      'Gagal memeriksa ID.'
    );
  },

  async inputSingleStock(payload: StockAttributionPayload & {
    tipe_id: number;
    box_id: string;
    kode_id: string;
    kondisi?: string;
    catatan_kondisi?: string;
    catatan?: string;
  }) {
    return apiFetch<{ success: boolean; message: string; itemId?: string; kodeId?: string; activityId?: string }>(
      '/api/stock/single',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal input stok tunggal.'
    );
  },

  async inputBulkStock(payload: StockAttributionPayload & {
    tipe_id: number;
    box_id: string;
    kode_ids?: string[];
    auto_count?: number;
    catatan?: string;
    confirmation_token?: string;
  }) {
    return apiFetch<{ success: boolean; message: string; totalCount?: number; activityId?: string; generatedIds?: string[] }>(
      '/api/stock/bulk',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal input stok massal.'
    );
  },

  async inputQuantityStock(payload: StockAttributionPayload & {
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
  },

  async outSingle(payload: StockAttributionPayload & {
    kode_id?: string;
    item_id?: string;
    tipe_id?: number;
    box_id?: string;
    jumlah?: number;
    catatan?: string;
    confirmation_token?: string;
  }) {
    return apiFetch<{
      success: boolean;
      message: string;
      activityId?: string;
      transaksiId?: string;
      lowStockAlert?: boolean;
    }>(
      '/api/stock/out',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal mencatat barang keluar.'
    );
  },

  async outBulk(payload: StockAttributionPayload & {
    items: Array<{
      kodeId?: string;
      itemId?: string;
      tipeId?: number;
      boxId?: string;
      jumlah?: number;
    }>;
    catatan?: string;
    confirmation_token?: string;
  }) {
    return apiFetch<{
      success: boolean;
      message: string;
      activityId?: string;
      transaksiId?: string;
      totalQty?: number;
      lowStockAlert?: boolean;
    }>(
      '/api/stock/out/bulk',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal mencatat keranjang barang keluar.'
    );
  },

  async listArchive(search?: string): Promise<ArchivedItemRecord[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await apiFetch<{ items?: ArchivedItemRecord[] }>(
      `/api/stock/archive${query}`,
      {},
      'Gagal memuat daftar arsip barang keluar.'
    );
    return data.items || [];
  },

  async restoreItem(payload: StockAttributionPayload & {
    kode_id: string;
    target_box_id: string;
    confirm_product_matched: boolean;
    kondisi?: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
    catatan_kondisi?: string;
    catatan?: string;
  }) {
    return apiFetch<{ success: boolean; message: string; activityId?: string }>(
      '/api/stock/restore',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal memulihkan barang ke gudang.'
    );
  }
};
