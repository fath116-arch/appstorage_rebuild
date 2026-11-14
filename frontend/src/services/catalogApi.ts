/**
 * Catalog API Service (FieldOps Inventory v2 - Tahap 2)
 * Client-side communication for Jenis, Atribut, Produk, and Tipe
 */

import { apiFetch, requestJson } from './httpClient';

export interface AtributOpsi {
  id: number;
  atribut_id: number;
  nilai: string;
  urutan: number;
}

export interface Atribut {
  id: number;
  jenis_id: number;
  kode: string;
  nama: string;
  tipe_isian: 'angka' | 'pilihan' | 'teks';
  satuan?: string | null;
  wajib: boolean | number;
  urutan: number;
  masuk_nama: boolean | number;
  opsi?: AtributOpsi[];
}

export interface Jenis {
  id: number;
  nama: string;
  sumber_id_bawaan: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
  prefix_id_bawaan?: string | null;
  aktif: boolean | number;
  dibuat_pada: string;
  atributs?: Atribut[];
  total_produk?: number;
}

export interface NilaiAtributView {
  atribut_id: number;
  atribut_nama: string;
  tipe_isian: string;
  satuan?: string;
  nilai_tampil: string;
  nilai_angka?: number;
  opsi_id?: number;
  nilai_teks?: string;
}

export interface TipeThresholdInfo {
  lowStockThreshold?: number;
  earlyWarningThreshold?: number;
  lowStockSource?: string;
  earlyWarningSource?: string;
  isWatchlist?: boolean;
}

export interface Tipe {
  id: number;
  produk_id: number;
  produk_nama?: string;
  jenis_nama?: string;
  nama_tipe: string;
  catatan?: string | null;
  sumber_id: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
  mode_stok: 'per_id' | 'jumlah';
  prefix_id?: string | null;
  pola_id?: string | null;
  id_dikunci: boolean | number;
  aktif: boolean | number;
  dibuat_pada: string;
  stok_total?: number;
  stok_tersedia?: number;
  stok_rusak?: number;
  stok_per_kondisi?: {
    baru: number;
    baik: number;
    perlu_perbaikan: number;
    rusak: number;
  };
  sebaran_box?: Array<{ box_id: string; box_kode: string; box_keterangan?: string; jumlah: number }>;
  riwayat_terakhir?: Array<{
    id_aktivitas: string;
    aksi: string;
    waktu: string;
    catatan?: string;
    nama_pelaku?: string;
    jumlah?: number;
    kode_id?: string;
    status_sebelum?: string;
    status_sesudah?: string;
  }>;
  nilai_atribut?: NilaiAtributView[];
  status_stok?: 'aman' | 'menipis' | 'habis';
  threshold?: TipeThresholdInfo;
}

export interface Produk {
  id: number;
  jenis_id: number;
  jenis_nama?: string;
  kategori_id?: number;
  kategori_nama?: string;
  nama: string;
  kategori: 'fast_moving' | 'recycle';
  kategori_barang?: 'Alat' | 'Barang Habis Pakai';
  tipe_stok?: string;
  catatan?: string | null;
  aktif: boolean | number;
  dibuat_oleh?: string | null;
  dibuat_pada: string;
  total_stok?: number;
  stok_rusak?: number;
  tipes?: Tipe[];
  total_tipe?: number;
  status_stok?: 'aman' | 'menipis' | 'habis';
}

export const catalogApi = {
  // JENIS
  async listJenis(): Promise<Jenis[]> {
    const data = await apiFetch<{ jenis?: Jenis[] }>('/api/catalog/jenis', {}, 'Gagal memuat jenis katalog.');
    return data.jenis || [];
  },

  async getJenis(id: number): Promise<Jenis> {
    const data = await apiFetch<{ jenis: Jenis }>(`/api/catalog/jenis/${id}`, {}, 'Gagal mengambil detail jenis.');
    return data.jenis;
  },

  async createJenis(payload: {
    nama: string;
    sumber_id_bawaan?: string;
    prefix_id_bawaan?: string;
    atributs?: Array<{
      kode: string;
      nama: string;
      tipe_isian: 'angka' | 'pilihan' | 'teks';
      satuan?: string;
      wajib?: boolean;
      urutan?: number;
      masuk_nama?: boolean;
      opsi?: string[];
    }>;
  }): Promise<Jenis> {
    const data = await apiFetch<{ jenis: Jenis }>(
      '/api/catalog/jenis',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal membuat Jenis baru.'
    );
    return data.jenis;
  },

  async deleteJenis(id: number, confirmationToken?: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/catalog/jenis/${id}`,
      {
        method: 'DELETE',
        headers: confirmationToken ? { 'X-Confirmation-Token': confirmationToken } : {}
      },
      'Gagal menghapus jenis.'
    );
  },

  // ATRIBUT
  async listAtributByJenis(jenisId: number): Promise<Atribut[]> {
    const data = await apiFetch<{ atributs?: Atribut[] }>(
      `/api/catalog/jenis/${jenisId}/attributes`,
      {},
      'Gagal memuat atribut.'
    );
    return data.atributs || [];
  },

  async createAtribut(payload: {
    jenis_id: number;
    kode: string;
    nama: string;
    tipe_isian: 'angka' | 'pilihan' | 'teks';
    satuan?: string;
    wajib?: boolean;
    urutan?: number;
    masuk_nama?: boolean;
    opsi?: string[];
  }): Promise<Atribut> {
    const data = await apiFetch<{ atribut: Atribut }>(
      '/api/catalog/attributes',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal menambahkan atribut.'
    );
    return data.atribut;
  },

  async addAtributOpsi(atributId: number, nilai: string): Promise<AtributOpsi> {
    const data = await apiFetch<{ option: AtributOpsi }>(
      `/api/catalog/attributes/${atributId}/options`,
      { method: 'POST', body: JSON.stringify({ nilai }) },
      'Gagal menambahkan opsi atribut.'
    );
    return data.option;
  },

  // PRODUK
  async listProduk(filters?: { jenis_id?: number; kategori_id?: number; kategori?: string; kategori_barang?: string; search?: string; status?: string }): Promise<Produk[]> {
    const params = new URLSearchParams();
    const jId = filters?.jenis_id || filters?.kategori_id;
    if (jId) params.append('jenis_id', String(jId));
    if (filters?.kategori && filters.kategori !== 'ALL') params.append('kategori', filters.kategori);
    if (filters?.kategori_barang && filters.kategori_barang !== 'ALL') params.append('kategori_barang', filters.kategori_barang);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);

    const data = await apiFetch<{ products?: Produk[] }>(
      `/api/catalog/products-v2?${params.toString()}`,
      {},
      'Gagal memuat daftar produk.'
    );
    return data.products || [];
  },

  async getProduk(id: number): Promise<Produk> {
    const data = await apiFetch<{ product: Produk }>(`/api/catalog/products/${id}`, {}, 'Gagal mengambil detail produk.');
    return data.product;
  },

  async createProduk(payload: {
    jenis_id: number;
    nama: string;
    kategori: 'fast_moving' | 'recycle';
    kategori_barang?: 'Alat' | 'Barang Habis Pakai';
    tipe_stok?: string;
    catatan?: string;
    stok_awal?: number;
  }): Promise<Produk> {
    const data = await apiFetch<{ product: Produk }>(
      '/api/catalog/products',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal membuat produk baru.'
    );
    return data.product;
  },

  async getTipeStokSuggestions(): Promise<string[]> {
    const { ok, data } = await requestJson<{ suggestions?: string[] }>('/api/catalog/tipe-stok-suggestions');
    if (!ok) return ['unit', 'roll', 'meter', 'pcs', 'box', 'set'];
    return data.suggestions || ['unit', 'roll', 'meter', 'pcs', 'box', 'set'];
  },

  async updateItemCondition(itemId: string, kondisi: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak', catatan_kondisi?: string): Promise<Record<string, unknown>> {
    return apiFetch(
      `/api/stock/items/${encodeURIComponent(itemId)}/condition`,
      { method: 'PUT', body: JSON.stringify({ kondisi, catatan_kondisi }) },
      'Gagal memperbarui kondisi item.'
    );
  },

  async listBoxes(): Promise<Array<Record<string, unknown>>> {
    const data = await apiFetch<{ boxes?: Array<Record<string, unknown>> }>('/api/stock/boxes', {}, 'Gagal memuat daftar storage box.');
    return data.boxes || [];
  },

  async getBoxContents(boxId: string): Promise<Record<string, unknown>> {
    return apiFetch(
      `/api/stock/boxes/${encodeURIComponent(boxId)}/contents`,
      {},
      'Gagal memuat isi storage box.'
    );
  },

  async deleteProduk(id: number, confirmationToken?: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/catalog/products/${id}`,
      {
        method: 'DELETE',
        headers: confirmationToken ? { 'X-Confirmation-Token': confirmationToken } : {}
      },
      'Gagal menghapus produk.'
    );
  },

  // TIPE
  async listTipeByProduk(produkId: number): Promise<Tipe[]> {
    const data = await apiFetch<{ types?: Tipe[] }>(
      `/api/catalog/products/${produkId}/types`,
      {},
      'Gagal memuat tipe varian produk.'
    );
    return data.types || [];
  },

  async createTipe(payload: {
    produk_id: number;
    catatan?: string;
    sumber_id?: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
    prefix_id?: string;
    pola_id?: string;
    nilai_atribut: Array<{
      atribut_id: number;
      nilai_angka?: number | null;
      opsi_id?: number | null;
      opsi_baru?: string | null;
      nilai_teks?: string | null;
    }>;
  }): Promise<Tipe> {
    const data = await apiFetch<{ type: Tipe }>(
      '/api/catalog/types',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal membuat tipe baru.'
    );
    return data.type;
  },

  async updateAturanId(tipeId: number, payload: {
    sumber_id: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
    prefix_id?: string;
    pola_id?: string;
    alasan: string;
    confirmation_token?: string;
  }): Promise<Tipe> {
    const data = await apiFetch<{ type: Tipe }>(
      `/api/catalog/types/${tipeId}/id-rule`,
      { method: 'PUT', body: JSON.stringify(payload) },
      'Gagal memperbarui aturan ID tipe.'
    );
    return data.type;
  },

  async getItemsByTipe(tipeId: number): Promise<{ items: Array<Record<string, unknown>>; stokJumlah: Array<Record<string, unknown>> }> {
    const data = await apiFetch<{ items?: Array<Record<string, unknown>>; stokJumlah?: Array<Record<string, unknown>> }>(
      `/api/stock/types/${tipeId}/items`,
      {},
      'Gagal memuat item fisik tipe.'
    );
    return { items: data.items || [], stokJumlah: data.stokJumlah || [] };
  }
};
