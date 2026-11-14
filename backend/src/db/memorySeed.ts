/**
 * Memory Database Seeding & Auth Seed Persistence
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { memoryStore } from './memoryStore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Seeding data awal ke memory store (jika MariaDB offline saat preview)
 */
export async function seedMemoryDb(): Promise<void> {
  const seedsDir = path.join(__dirname, 'seeds');
  const authSeedPath = path.join(seedsDir, 'auth_seed.json');
  const itemsSeedPath = path.join(seedsDir, 'items_seed.json');

  if (fs.existsSync(authSeedPath)) {
    const users: Array<Record<string, unknown>> = JSON.parse(fs.readFileSync(authSeedPath, 'utf-8'));
    users.forEach((u) => {
      if (typeof u.id === 'string') {
        memoryStore.users.set(u.id, { ...u, created_at: new Date().toISOString() });
      }
    });
  }

  if (fs.existsSync(itemsSeedPath)) {
    const data: { categories: Array<Record<string, unknown>>; items: Array<Record<string, unknown>> } = JSON.parse(
      fs.readFileSync(itemsSeedPath, 'utf-8')
    );
    data.categories.forEach((c) => {
      if (typeof c.id === 'string') {
        memoryStore.categories.set(c.id, { ...c, created_at: new Date().toISOString() });
      }
    });
    data.items.forEach((it) => {
      if (typeof it.id === 'string') {
        memoryStore.items.set(it.id, {
          ...it,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });
  }

  // Set default WhatsApp Config
  memoryStore.whatsapp_config.set('1', {
    id: 1,
    gateway_type: process.env.WHATSAPP_GATEWAY_TYPE || 'fonnte',
    api_url: process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send',
    api_token: process.env.WHATSAPP_API_TOKEN || '',
    target_phones: process.env.WHATSAPP_TARGET_PHONES || '',
    auto_alert_enabled: process.env.WHATSAPP_AUTO_ALERT !== 'false',
    updated_at: new Date().toISOString()
  });

  // Set default v2 Pengaturan Sistem (30 Hari Persistent Session & Multi-Perangkat)
  const defaultSettings: Array<[string, string, string]> = [
    ['ACCESS_TOKEN_TTL_DETIK', '2592000', 'Masa berlaku access token (30 hari)'],
    ['IDLE_TIMEOUT_MENIT', '43200', 'Sesi mati bila tidak ada aktivitas (30 hari)'],
    ['ABSOLUTE_TIMEOUT_JAM', '720', 'Sesi mati mutlak setelah 30 hari'],
    ['MAX_SESI_PER_AKUN', '50', 'Batas sesi aktif per akun (multi-perangkat diizinkan)'],
    ['REAUTH_MENIT', '15', 'Batas waktu re-autentikasi password untuk aksi tingkat 3'],
    ['RETENSI_SAMPAH_HARI', '14', 'Masa simpan sampah hapus permanen sebelum dibersihkan'],
    ['CONFIRMATION_TOKEN_TTL_DETIK', '120', 'Masa berlaku token konfirmasi bertingkat sekali pakai'],
    ['CONFIRMATION_TIERS', JSON.stringify({
      stock_move_single: 0,
      notes_update: 0,
      stock_out_single: 1,
      restore_single: 1,
      request_approve: 2,
      request_reject: 2,
      bulk_stock_out: 2,
      bulk_stock_in: 2,
      permanent_delete: 3,
      delete_product: 3,
      delete_type: 3,
      delete_kind: 3,
      delete_box: 3,
      correct_item_id: 3,
      change_role: 3,
      change_id_rule: 3
    }), 'Pemetaan tingkat konfirmasi bertingkat (Tingkat 0-3)']
  ];

  defaultSettings.forEach(([kunci, nilai, keterangan]) => {
    if (!memoryStore.pengaturan.has(kunci)) {
      memoryStore.pengaturan.set(kunci, { kunci, nilai, keterangan, diperbarui_pada: new Date().toISOString() });
    }
  });

  // Seed Default Katalog Bertingkat v2
  if (memoryStore.jenis.size === 0) {
    // 1. Jenis: Adaptor
    memoryStore.jenis.set(1, { id: 1, nama: 'Adaptor', sumber_id_bawaan: 'manual', prefix_id_bawaan: 'ADP', aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(1, { id: 1, jenis_id: 1, kode: 'tegangan', nama: 'Tegangan', tipe_isian: 'angka', satuan: 'V', wajib: 1, urutan: 1, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(2, { id: 2, jenis_id: 1, kode: 'arus', nama: 'Arus', tipe_isian: 'pilihan', satuan: 'A', wajib: 1, urutan: 2, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(3, { id: 3, jenis_id: 1, kode: 'jack', nama: 'Jenis Jack', tipe_isian: 'pilihan', satuan: null, wajib: 0, urutan: 3, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut_opsi.set(1, { id: 1, atribut_id: 2, nilai: '1A', urutan: 0 });
    memoryStore.atribut_opsi.set(2, { id: 2, atribut_id: 2, nilai: '2A', urutan: 1 });
    memoryStore.atribut_opsi.set(3, { id: 3, atribut_id: 2, nilai: '3A', urutan: 2 });
    memoryStore.atribut_opsi.set(4, { id: 4, atribut_id: 2, nilai: '5A', urutan: 3 });
    memoryStore.atribut_opsi.set(5, { id: 5, atribut_id: 3, nilai: 'Jack 5.5mm', urutan: 0 });
    memoryStore.atribut_opsi.set(6, { id: 6, atribut_id: 3, nilai: 'Jack 3.5mm', urutan: 1 });

    memoryStore.produk.set(1, { id: 1, jenis_id: 1, nama: 'Adaptor 12V Standar', kategori: 'fast_moving', catatan: 'Untuk ONU dan Router rumahan', aktif: 1, dibuat_oleh: 'system', dibuat_pada: new Date().toISOString() });
    memoryStore.tipe.set(1, { id: 1, produk_id: 1, nama_tipe: '12V / 1A', catatan: null, sumber_id: 'otomatis', mode_stok: 'per_id', prefix_id: 'ADP12-1A', pola_id: null, id_dikunci: 0, aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.tipe_nilai.set('1_1', { tipe_id: 1, atribut_id: 1, nilai_angka: 12, opsi_id: null, nilai_teks: null });
    memoryStore.tipe_nilai.set('1_2', { tipe_id: 1, atribut_id: 2, nilai_angka: null, opsi_id: 1, nilai_teks: null });

    memoryStore.tipe.set(2, { id: 2, produk_id: 1, nama_tipe: '12V / 2A', catatan: null, sumber_id: 'otomatis', mode_stok: 'per_id', prefix_id: 'ADP12-2A', pola_id: null, id_dikunci: 0, aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.tipe_nilai.set('2_1', { tipe_id: 2, atribut_id: 1, nilai_angka: 12, opsi_id: null, nilai_teks: null });
    memoryStore.tipe_nilai.set('2_2', { tipe_id: 2, atribut_id: 2, nilai_angka: null, opsi_id: 2, nilai_teks: null });

    memoryStore.tipe.set(3, { id: 3, produk_id: 1, nama_tipe: '12V / 3A / Jack 5.5mm', catatan: null, sumber_id: 'scan_sn', mode_stok: 'per_id', prefix_id: null, pola_id: '^SN[0-9]{8}$', id_dikunci: 0, aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.tipe_nilai.set('3_1', { tipe_id: 3, atribut_id: 1, nilai_angka: 12, opsi_id: null, nilai_teks: null });
    memoryStore.tipe_nilai.set('3_2', { tipe_id: 3, atribut_id: 2, nilai_angka: null, opsi_id: 3, nilai_teks: null });
    memoryStore.tipe_nilai.set('3_3', { tipe_id: 3, atribut_id: 3, nilai_angka: null, opsi_id: 5, nilai_teks: null });

    // 2. Jenis: Kabel
    memoryStore.jenis.set(2, { id: 2, nama: 'Kabel', sumber_id_bawaan: 'tanpa_id', prefix_id_bawaan: 'CAB', aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(4, { id: 4, jenis_id: 2, kode: 'kategori_kabel', nama: 'Kategori Kabel', tipe_isian: 'pilihan', satuan: null, wajib: 1, urutan: 1, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(5, { id: 5, jenis_id: 2, kode: 'panjang', nama: 'Panjang Roll', tipe_isian: 'angka', satuan: 'm', wajib: 1, urutan: 2, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut_opsi.set(7, { id: 7, atribut_id: 4, nilai: 'Cat5e', urutan: 0 });
    memoryStore.atribut_opsi.set(8, { id: 8, atribut_id: 4, nilai: 'Cat6', urutan: 1 });
    memoryStore.atribut_opsi.set(9, { id: 9, atribut_id: 4, nilai: 'Dropcore 1 Core', urutan: 2 });

    memoryStore.produk.set(2, { id: 2, jenis_id: 2, nama: 'Kabel UTP LAN', kategori: 'fast_moving', catatan: 'Roll kabel tarikan indoor/outdoor', aktif: 1, dibuat_oleh: 'system', dibuat_pada: new Date().toISOString() });
    memoryStore.tipe.set(4, { id: 4, produk_id: 2, nama_tipe: 'Cat6 / 305m', catatan: null, sumber_id: 'tanpa_id', mode_stok: 'jumlah', prefix_id: null, pola_id: null, id_dikunci: 0, aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.tipe_nilai.set('4_4', { tipe_id: 4, atribut_id: 4, nilai_angka: null, opsi_id: 8, nilai_teks: null });
    memoryStore.tipe_nilai.set('4_5', { tipe_id: 4, atribut_id: 5, nilai_angka: 305, opsi_id: null, nilai_teks: null });

    // 3. Jenis: Modem/ONU
    memoryStore.jenis.set(3, { id: 3, nama: 'Modem/ONU', sumber_id_bawaan: 'scan_sn', prefix_id_bawaan: 'ONU', aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(6, { id: 6, jenis_id: 3, kode: 'jaringan', nama: 'Jaringan', tipe_isian: 'pilihan', satuan: null, wajib: 1, urutan: 1, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(7, { id: 7, jenis_id: 3, kode: 'port_lan', nama: 'Port LAN', tipe_isian: 'angka', satuan: 'Port', wajib: 1, urutan: 2, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut_opsi.set(10, { id: 10, atribut_id: 6, nilai: 'EPON', urutan: 0 });
    memoryStore.atribut_opsi.set(11, { id: 11, atribut_id: 6, nilai: 'GPON', urutan: 1 });
    memoryStore.atribut_opsi.set(12, { id: 12, atribut_id: 6, nilai: 'XPON', urutan: 2 });

    memoryStore.produk.set(3, { id: 3, jenis_id: 3, nama: 'ONU FiberHome Dualband', kategori: 'fast_moving', catatan: 'ONU Gigabit Wi-Fi 5', aktif: 1, dibuat_oleh: 'system', dibuat_pada: new Date().toISOString() });
    memoryStore.tipe.set(5, { id: 5, produk_id: 3, nama_tipe: 'XPON / 4Port', catatan: null, sumber_id: 'scan_sn', mode_stok: 'per_id', prefix_id: null, pola_id: '^FHTT[0-9A-Z]{8}$', id_dikunci: 0, aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.tipe_nilai.set('5_6', { tipe_id: 5, atribut_id: 6, nilai_angka: null, opsi_id: 12, nilai_teks: null });
    memoryStore.tipe_nilai.set('5_7', { tipe_id: 5, atribut_id: 7, nilai_angka: 4, opsi_id: null, nilai_teks: null });
  }

  // Seed Default Box Storage
  if (memoryStore.box.size === 0) {
    memoryStore.box.set('box-1', { id: 'box-1', kode: 'BOX-A-01', keterangan: 'Rak Utama Suku Cadang - Rak A Level 1', aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.box.set('box-2', { id: 'box-2', kode: 'BOX-A-02', keterangan: 'Rak Utama Suku Cadang - Rak A Level 2', aktif: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.box.set('box-3', { id: 'box-3', kode: 'BOX-A-03', keterangan: 'Box Penyimpanan Material Campuran', aktif: 1, dibuat_pada: new Date().toISOString() });
  }
}

/**
 * Persist memory users to seeds/auth_seed.json so newly created accounts survive reloads & CLI commands
 */
export function persistUsersToSeed(): void {
  try {
    const seedsDir = path.join(__dirname, 'seeds');
    const authSeedPath = path.join(seedsDir, 'auth_seed.json');
    const users = Array.from(memoryStore.users.values());
    fs.writeFileSync(authSeedPath, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[FieldOps Database] Gagal menyimpan user ke auth_seed.json:', err);
  }
}
