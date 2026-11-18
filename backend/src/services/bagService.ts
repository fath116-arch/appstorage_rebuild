/**
 * Office Field Bag ("Tas Lapangan") Management Service
 * Menyimpan definisi multi-tas kantor pada tabel `checklists` (inspection_type = 'BAG_TEMPLATE')
 * dengan daftar alat terhubung langsung ke Katalog (`produk` & `tipe`).
 */

import crypto from 'crypto';
import { executeQuery } from '../db/database';
import { CatalogService } from './catalogService';
import { ActivityLogService } from './activityLogService';

export interface BagToolEntry {
  tipe_id: number;
  nama_produk: string;
  nama_tipe: string;
  kategori_barang?: 'Alat' | 'Barang Habis Pakai';
  tipe_stok?: string;
  mode_stok?: 'per_id' | 'jumlah';
  jumlah: number;
  kode_id?: string | null;
  catatan?: string | null;
  stok_tersedia?: number;
}

export interface ToolBagRecord {
  id: string;
  nama_tas: string;
  keterangan: string;
  dibuat_oleh_id: string;
  dibuat_oleh_nama: string;
  dibuat_pada: string;
  items: BagToolEntry[];
  total_unit: number;
}

interface RawChecklistRow {
  id: string;
  technician_id: string;
  technician_name: string;
  inspection_type: string;
  vehicle_or_kit_name: string;
  notes?: string | null;
  items_json: string | BagToolEntry[];
  created_at: string;
}

export class BagService {
  private static normalizeItems(rawItems: unknown): BagToolEntry[] {
    if (!Array.isArray(rawItems)) return [];
    const merged = new Map<string, BagToolEntry>();

    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const tipeId = Number(entry.tipe_id);
      if (!Number.isFinite(tipeId) || tipeId <= 0) continue;

      const qty = Math.max(1, Math.floor(Number(entry.jumlah) || 1));
      const kodeId = entry.kode_id ? String(entry.kode_id).trim() : null;
      const key = `${tipeId}_${kodeId || ''}`;

      if (merged.has(key)) {
        const existing = merged.get(key)!;
        if (!kodeId) {
          existing.jumlah += qty;
        }
      } else {
        merged.set(key, {
          tipe_id: tipeId,
          nama_produk: String(entry.nama_produk || ''),
          nama_tipe: String(entry.nama_tipe || ''),
          kategori_barang:
            entry.kategori_barang === 'Alat' || entry.kategori_barang === 'Barang Habis Pakai'
              ? entry.kategori_barang
              : 'Alat',
          tipe_stok: entry.tipe_stok ? String(entry.tipe_stok) : 'unit',
          mode_stok: entry.mode_stok === 'per_id' ? 'per_id' : 'jumlah',
          jumlah: kodeId ? 1 : qty,
          kode_id: kodeId,
          catatan: entry.catatan ? String(entry.catatan).trim() : null
        });
      }
    }

    return Array.from(merged.values());
  }

  private static async enrichBag(row: RawChecklistRow, stockLookup?: Map<number, {
    nama_produk: string;
    nama_tipe: string;
    kategori_barang: 'Alat' | 'Barang Habis Pakai';
    tipe_stok: string;
    mode_stok: 'per_id' | 'jumlah';
    stok_tersedia: number;
  }>): Promise<ToolBagRecord> {
    let parsed: unknown = [];
    try {
      parsed = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : row.items_json;
    } catch {
      parsed = [];
    }

    const baseItems = this.normalizeItems(parsed);
    let lookup = stockLookup;
    if (!lookup) {
      lookup = await this.buildCatalogLookup();
    }

    const enrichedItems = baseItems.map((it) => {
      const live = lookup!.get(it.tipe_id);
      return {
        ...it,
        nama_produk: live?.nama_produk || it.nama_produk || `Tipe #${it.tipe_id}`,
        nama_tipe: live?.nama_tipe || it.nama_tipe || '-',
        kategori_barang: live?.kategori_barang || it.kategori_barang || 'Alat',
        tipe_stok: live?.tipe_stok || it.tipe_stok || 'unit',
        mode_stok: live?.mode_stok || it.mode_stok || 'jumlah',
        stok_tersedia: live ? live.stok_tersedia : 0
      };
    });

    const totalUnit = enrichedItems.reduce((sum, it) => sum + (it.jumlah || 1), 0);

    return {
      id: row.id,
      nama_tas: row.vehicle_or_kit_name || 'Tas Kerja Lapangan',
      keterangan: row.notes || '',
      dibuat_oleh_id: row.technician_id,
      dibuat_oleh_nama: row.technician_name,
      dibuat_pada: row.created_at,
      items: enrichedItems,
      total_unit: totalUnit
    };
  }

  private static async buildCatalogLookup() {
    const products = await CatalogService.listProdukWithFullDetails();
    const map = new Map<number, {
      nama_produk: string;
      nama_tipe: string;
      kategori_barang: 'Alat' | 'Barang Habis Pakai';
      tipe_stok: string;
      mode_stok: 'per_id' | 'jumlah';
      stok_tersedia: number;
    }>();

    for (const p of products) {
      for (const t of p.tipes || []) {
        map.set(t.id, {
          nama_produk: p.nama,
          nama_tipe: t.nama_tipe,
          kategori_barang: p.kategori_barang === 'Alat' ? 'Alat' : 'Barang Habis Pakai',
          tipe_stok: p.tipe_stok || 'unit',
          mode_stok: t.mode_stok === 'per_id' ? 'per_id' : 'jumlah',
          stok_tersedia: Number(t.stok_tersedia || 0)
        });
      }
    }
    return map;
  }

  static async listBags(): Promise<ToolBagRecord[]> {
    const rows = await executeQuery<RawChecklistRow>(
      `SELECT * FROM checklists WHERE inspection_type = 'BAG_TEMPLATE' ORDER BY created_at DESC`
    );
    const lookup = await this.buildCatalogLookup();
    return Promise.all(rows.map((r) => this.enrichBag(r, lookup)));
  }

  static async getBagById(id: string): Promise<ToolBagRecord | null> {
    const rows = await executeQuery<RawChecklistRow>(
      `SELECT * FROM checklists WHERE id = ? AND inspection_type = 'BAG_TEMPLATE'`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return this.enrichBag(rows[0]);
  }

  private static async validateBagPayload(
    namaTas: string,
    rawItems: unknown,
    excludeId?: string
  ): Promise<{ cleanName: string; items: BagToolEntry[] }> {
    const cleanName = String(namaTas || '').trim();
    if (cleanName.length < 2) {
      throw new Error('Nama tas minimal 2 karakter.');
    }

    const existingBags = await executeQuery<RawChecklistRow>(
      `SELECT * FROM checklists WHERE inspection_type = 'BAG_TEMPLATE'`
    );
    const duplicate = existingBags.find(
      (b) => b.id !== excludeId && String(b.vehicle_or_kit_name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Nama tas "${cleanName}" sudah digunakan. Gunakan nama lain.`);
    }

    const normalized = this.normalizeItems(rawItems);
    if (normalized.length === 0) {
      throw new Error('Pilih minimal 1 alat dari katalog untuk dimasukkan ke dalam tas.');
    }

    const lookup = await this.buildCatalogLookup();
    const verifiedItems: BagToolEntry[] = [];

    for (const item of normalized) {
      const cat = lookup.get(item.tipe_id);
      if (!cat) {
        throw new Error(`Varian tipe #${item.tipe_id} tidak ditemukan atau sudah tidak aktif di Katalog.`);
      }
      verifiedItems.push({
        tipe_id: item.tipe_id,
        nama_produk: cat.nama_produk,
        nama_tipe: cat.nama_tipe,
        kategori_barang: cat.kategori_barang,
        tipe_stok: cat.tipe_stok,
        mode_stok: cat.mode_stok,
        jumlah: item.kode_id ? 1 : item.jumlah,
        kode_id: item.kode_id || null,
        catatan: item.catatan || null,
        stok_tersedia: cat.stok_tersedia
      });
    }

    return { cleanName, items: verifiedItems };
  }

  static async createBag(input: {
    namaTas: string;
    keterangan?: string;
    items: unknown;
    userId: string;
    userName: string;
  }): Promise<ToolBagRecord> {
    const { cleanName, items } = await this.validateBagPayload(input.namaTas, input.items);
    const cleanNotes = input.keterangan ? input.keterangan.trim() : '';
    const bagId = `bag-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    await executeQuery(
      `INSERT INTO checklists (id, technician_id, technician_name, inspection_type, vehicle_or_kit_name, notes, items_json)
       VALUES (?, ?, ?, 'BAG_TEMPLATE', ?, ?, ?)`,
      [bagId, input.userId, input.userName, cleanName, cleanNotes, JSON.stringify(items)]
    );

    await ActivityLogService.recordActivity({
      aksi: 'buat_tas_kerja',
      pelaku_id: input.userId,
      actor_id: input.userId,
      actor_nama: input.userName,
      tipe_mutasi: 'SYSTEM',
      reference_type: 'TOOL_BAG',
      reference_number: bagId,
      catatan: `Membuat Tas Kerja "${cleanName}" dengan ${items.length} jenis alat (${items.reduce((s, x) => s + x.jumlah, 0)} unit)`
    });

    const created = await this.getBagById(bagId);
    return created!;
  }

  static async updateBag(
    id: string,
    input: {
      namaTas: string;
      keterangan?: string;
      items: unknown;
      userId: string;
      userName: string;
    }
  ): Promise<ToolBagRecord> {
    const existing = await this.getBagById(id);
    if (!existing) {
      throw new Error(`Tas Kerja #${id} tidak ditemukan.`);
    }

    const { cleanName, items } = await this.validateBagPayload(input.namaTas, input.items, id);
    const cleanNotes = input.keterangan ? input.keterangan.trim() : '';

    await executeQuery(
      `UPDATE checklists SET vehicle_or_kit_name = ?, notes = ?, items_json = ? WHERE id = ? AND inspection_type = 'BAG_TEMPLATE'`,
      [cleanName, cleanNotes, JSON.stringify(items), id]
    );

    await ActivityLogService.recordActivity({
      aksi: 'ubah_tas_kerja',
      pelaku_id: input.userId,
      actor_id: input.userId,
      actor_nama: input.userName,
      tipe_mutasi: 'SYSTEM',
      reference_type: 'TOOL_BAG',
      reference_number: id,
      catatan: `Memperbarui Tas Kerja "${cleanName}" (${items.length} jenis alat)`
    });

    const updated = await this.getBagById(id);
    return updated!;
  }

  static async deleteBag(id: string, userId: string, userName?: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.getBagById(id);
    if (!existing) {
      throw new Error(`Tas Kerja #${id} tidak ditemukan.`);
    }

    await executeQuery(
      `DELETE FROM checklists WHERE id = ? AND inspection_type = 'BAG_TEMPLATE'`,
      [id]
    );

    await ActivityLogService.recordActivity({
      aksi: 'hapus_tas_kerja',
      pelaku_id: userId,
      actor_id: userId,
      actor_nama: userName,
      tipe_mutasi: 'SYSTEM',
      reference_type: 'TOOL_BAG',
      reference_number: id,
      catatan: `Menghapus Tas Kerja "${existing.nama_tas}"`
    });

    return {
      success: true,
      message: `Tas Kerja "${existing.nama_tas}" berhasil dihapus.`
    };
  }
}
