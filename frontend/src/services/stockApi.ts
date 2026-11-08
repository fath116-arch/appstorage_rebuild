/**
 * Stock & Box API Client (FieldOps Inventory v2 - Tahap 3)
 */

export interface Box {
  id: string;
  kode: string;
  keterangan?: string | null;
  aktif: boolean | number;
  dibuat_pada: string;
  total_item?: number;
}

export interface BoxContentsResponse {
  success: boolean;
  box: Box;
  total_items: number;
  total_stok_jumlah: number;
  contents: {
    [produkNama: string]: {
      [tipeNama: string]: {
        items: Array<{
          id: string;
          kode_id: string;
          tipe_id: number;
          box_id: string;
          status: string;
          dibuat_pada: string;
          nama_tipe: string;
          nama_produk: string;
          kondisi?: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak';
          catatan_kondisi?: string | null;
        }>;
        stokJumlah: number;
      };
    };
  };
  raw_items: any[];
  raw_stok_jumlah: any[];
}

export const stockApi = {
  async listBoxes(): Promise<Box[]> {
    const res = await fetch('/api/boxes', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat daftar box.');
    return data.boxes || [];
  },

  async getBoxContents(boxIdOrKode: string): Promise<BoxContentsResponse> {
    const res = await fetch(`/api/boxes/${encodeURIComponent(boxIdOrKode)}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat isi box.');
    return data;
  },

  async createBox(kode: string, keterangan?: string): Promise<Box> {
    const res = await fetch('/api/boxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ kode, keterangan })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal membuat box baru.');
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
    const res = await fetch('/api/boxes/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memindahkan barang antar box.');
    return data;
  },

  async checkDuplicateId(kodeId: string): Promise<{ exists: boolean; item?: any }> {
    const res = await fetch(`/api/stock/check-id/${encodeURIComponent(kodeId)}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memeriksa ID.');
    return data;
  },

  async inputSingleStock(payload: {
    tipe_id: number;
    box_id: string;
    kode_id: string;
    catatan?: string;
  }) {
    const res = await fetch('/api/stock/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal input stok tunggal.');
    return data;
  },

  async inputBulkStock(payload: {
    tipe_id: number;
    box_id: string;
    kode_ids?: string[];
    auto_count?: number;
    catatan?: string;
    confirmation_token?: string;
  }) {
    const res = await fetch('/api/stock/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal input stok massal.');
    return data;
  },

  async inputQuantityStock(payload: {
    tipe_id: number;
    box_id: string;
    jumlah: number;
    catatan?: string;
  }) {
    const res = await fetch('/api/stock/quantity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal input stok jumlah.');
    return data;
  }
};
