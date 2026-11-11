/**
 * Catalog API Service (FieldOps Inventory v2 - Tahap 2)
 * Client-side communication for Jenis, Atribut, Produk, and Tipe
 */

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
  threshold?: any;
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
    const res = await fetch('/api/catalog/jenis', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat jenis katalog.');
    return data.jenis || [];
  },

  async getJenis(id: number): Promise<Jenis> {
    const res = await fetch(`/api/catalog/jenis/${id}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal mengambil detail jenis.');
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
    const res = await fetch('/api/catalog/jenis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal membuat Jenis baru.');
    return data.jenis;
  },

  async deleteJenis(id: number, confirmationToken?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/catalog/jenis/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(confirmationToken ? { 'X-Confirmation-Token': confirmationToken } : {})
      },
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus jenis.');
    return data;
  },

  // ATRIBUT
  async listAtributByJenis(jenisId: number): Promise<Atribut[]> {
    const res = await fetch(`/api/catalog/jenis/${jenisId}/attributes`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat atribut.');
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
    const res = await fetch('/api/catalog/attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menambahkan atribut.');
    return data.atribut;
  },

  async addAtributOpsi(atributId: number, nilai: string): Promise<AtributOpsi> {
    const res = await fetch(`/api/catalog/attributes/${atributId}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nilai })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menambahkan opsi atribut.');
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

    const res = await fetch(`/api/catalog/products-v2?${params.toString()}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat daftar produk.');
    return data.products || [];
  },

  async getProduk(id: number): Promise<Produk> {
    const res = await fetch(`/api/catalog/products/${id}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal mengambil detail produk.');
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
    const res = await fetch('/api/catalog/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal membuat produk baru.');
    return data.product;
  },

  async getTipeStokSuggestions(): Promise<string[]> {
    const res = await fetch('/api/catalog/tipe-stok-suggestions', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) return ['unit', 'roll', 'meter', 'pcs', 'box', 'set'];
    return data.suggestions || ['unit', 'roll', 'meter', 'pcs', 'box', 'set'];
  },

  async updateItemCondition(itemId: string, kondisi: 'Baru' | 'Baik' | 'Perlu Perbaikan' | 'Rusak', catatan_kondisi?: string): Promise<any> {
    const res = await fetch(`/api/stock/items/${encodeURIComponent(itemId)}/condition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ kondisi, catatan_kondisi })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memperbarui kondisi item.');
    return data;
  },

  async listBoxes(): Promise<any[]> {
    const res = await fetch('/api/stock/boxes', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat daftar storage box.');
    return data.boxes || [];
  },

  async getBoxContents(boxId: string): Promise<any> {
    const res = await fetch(`/api/stock/boxes/${encodeURIComponent(boxId)}/contents`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat isi storage box.');
    return data;
  },

  async deleteProduk(id: number, confirmationToken?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/catalog/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(confirmationToken ? { 'X-Confirmation-Token': confirmationToken } : {})
      },
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus produk.');
    return data;
  },

  // TIPE
  async listTipeByProduk(produkId: number): Promise<Tipe[]> {
    const res = await fetch(`/api/catalog/products/${produkId}/types`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat tipe varian produk.');
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
    const res = await fetch('/api/catalog/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal membuat tipe baru.');
    return data.type;
  },

  async updateAturanId(tipeId: number, payload: {
    sumber_id: 'scan_sn' | 'otomatis' | 'manual' | 'tanpa_id';
    prefix_id?: string;
    pola_id?: string;
    alasan: string;
    confirmation_token?: string;
  }): Promise<Tipe> {
    const res = await fetch(`/api/catalog/types/${tipeId}/id-rule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memperbarui aturan ID tipe.');
    return data.type;
  },

  async getItemsByTipe(tipeId: number): Promise<{ items: any[]; stokJumlah: any[] }> {
    const res = await fetch(`/api/stock/types/${tipeId}/items`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memuat item fisik tipe.');
    return { items: data.items || [], stokJumlah: data.stokJumlah || [] };
  }
};
