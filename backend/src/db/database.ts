/**
 * Database Connection & Migration Engine
 * FieldOps IT Inventory - MariaDB 11.x Local Driver with Autonomous Development Fallback
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  connectionLimit: number;
}

export const dbConfig: DbConfig = {
  host: process.env.DB_HOST || process.env.MARIADB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.MARIADB_PORT || '3306', 10),
  user: process.env.DB_USER || process.env.MARIADB_USER || 'fieldops_user',
  password: process.env.DB_PASSWORD || process.env.MARIADB_PASSWORD || 'fieldops_secret',
  database: process.env.DB_NAME || process.env.MARIADB_DATABASE || 'fieldops_inventory',
  connectionLimit: 10,
};

let pool: mysql.Pool | null = null;
let isMariaDbActive = false;

// Fallback in-memory database storage for preview/development when MariaDB is offline
class MemoryDbStore {
  users: Map<string, any> = new Map();
  sessions: Map<string, any> = new Map();
  sesi: Map<string, any> = new Map();
  pengaturan: Map<string, any> = new Map();
  categories: Map<string, any> = new Map();
  items: Map<string, any> = new Map();
  transactions: Map<string, any> = new Map();
  transaksi_v2: Map<string, any> = new Map();
  transaksi_detail_v2: any[] = [];
  sampah_hapus: Map<string, any> = new Map();
  token_konfirmasi: Map<string, any> = new Map();
  checklists: Map<string, any> = new Map();
  api_keys: Map<string, any> = new Map();
  whatsapp_config: Map<string, any> = new Map();
  whatsapp_logs: Map<string, any> = new Map();
  audit_logs: any[] = [];
  jenis: Map<number, any> = new Map();
  atribut: Map<number, any> = new Map();
  atribut_opsi: Map<number, any> = new Map();
  produk: Map<number, any> = new Map();
  tipe: Map<number, any> = new Map();
  tipe_nilai: Map<string, any> = new Map();
  box: Map<string, any> = new Map();
  item_v2: Map<string, any> = new Map();
  stok_jumlah: Map<string, any> = new Map();
}

const memoryStore = new MemoryDbStore();

/**
 * Inisialisasi Database & Eksekusi Migrasi Dua File Skema
 */
export async function initDatabase(): Promise<{ isMariaDb: boolean }> {
  try {
    const testPool = mysql.createPool(dbConfig);
    const conn = await testPool.getConnection();
    await conn.ping();
    conn.release();
    pool = testPool;
    isMariaDbActive = true;
    console.log(`[FieldOps Database] Terhubung ke MariaDB di ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

    // Jalankan migrasi file skema berversi
    await runMigrations(pool);
    return { isMariaDb: true };
  } catch (err: any) {
    console.warn(`[FieldOps Database] MariaDB (${dbConfig.host}:${dbConfig.port}) belum terhubung. Mengaktifkan adapter lokal mandiri.`);
    isMariaDbActive = false;
    await seedMemoryDb();
    return { isMariaDb: false };
  }
}

/**
 * Helper memecah pernyataan SQL dengan aman tanpa merusak semicolon di dalam kutipan string
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const prevChar = i > 0 ? sql[i - 1] : '';

    if (char === "'" && !inDoubleQuote && !inBacktick && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inBacktick && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote && prevChar !== '\\') {
      inBacktick = !inBacktick;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const remainder = current.trim();
  if (remainder.length > 0) {
    statements.push(remainder);
  }

  return statements;
}

/**
 * Menjalankan migrasi SQL berurutan (File 1: Auth, File 2: Inventory, File 3: Audit)
 */
async function runMigrations(dbPool: mysql.Pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = [
    '01_auth_schema.sql',
    '02_inventory_schema.sql',
    '03_audit_trail_schema.sql',
    '04_v2_foundation_schema.sql',
    '05_v2_catalog_schema.sql',
    '06_v2_stock_schema.sql'
  ];

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    if (fs.existsSync(filePath)) {
      const sql = fs.readFileSync(filePath, 'utf-8');
      const statements = splitSqlStatements(sql);

      for (const statement of statements) {
        try {
          await dbPool.query(statement);
        } catch (e: any) {
          // Ignore index already exists error
          if (!e.message.includes('Duplicate key name')) {
            console.warn(`[Migration Warning] ${file}: ${e.message}`);
          }
        }
      }
      console.log(`[FieldOps Migration] Berhasil menjalankan: ${file}`);
    }
  }
}

/**
 * Seeding data awal ke memory store (jika MariaDB offline saat preview)
 */
async function seedMemoryDb() {
  const seedsDir = path.join(__dirname, 'seeds');
  const authSeedPath = path.join(seedsDir, 'auth_seed.json');
  const itemsSeedPath = path.join(seedsDir, 'items_seed.json');

  if (fs.existsSync(authSeedPath)) {
    const users: any[] = JSON.parse(fs.readFileSync(authSeedPath, 'utf-8'));
    users.forEach(u => memoryStore.users.set(u.id, { ...u, created_at: new Date().toISOString() }));
  }

  if (fs.existsSync(itemsSeedPath)) {
    const data: { categories: any[]; items: any[] } = JSON.parse(fs.readFileSync(itemsSeedPath, 'utf-8'));
    data.categories.forEach(c => memoryStore.categories.set(c.id, { ...c, created_at: new Date().toISOString() }));
    data.items.forEach(it => memoryStore.items.set(it.id, { ...it, is_deleted: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
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

  // Set default v2 Pengaturan Sistem
  const defaultSettings: Array<[string, string, string]> = [
    ['ACCESS_TOKEN_TTL_DETIK', '900', 'Masa berlaku access token (15 menit)'],
    ['IDLE_TIMEOUT_MENIT', '30', 'Sesi mati bila tidak ada aktivitas (30 menit)'],
    ['ABSOLUTE_TIMEOUT_JAM', '12', 'Sesi mati mutlak setelah 12 jam'],
    ['MAX_SESI_PER_AKUN', '1', 'Batas sesi aktif per akun (login baru mencabut sesi lama)'],
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
    // Atribut Adaptor
    memoryStore.atribut.set(1, { id: 1, jenis_id: 1, kode: 'tegangan', nama: 'Tegangan', tipe_isian: 'angka', satuan: 'V', wajib: 1, urutan: 1, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(2, { id: 2, jenis_id: 1, kode: 'arus', nama: 'Arus', tipe_isian: 'pilihan', satuan: 'A', wajib: 1, urutan: 2, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    memoryStore.atribut.set(3, { id: 3, jenis_id: 1, kode: 'jack', nama: 'Jenis Jack', tipe_isian: 'pilihan', satuan: null, wajib: 0, urutan: 3, masuk_nama: 1, dibuat_pada: new Date().toISOString() });
    // Opsi
    memoryStore.atribut_opsi.set(1, { id: 1, atribut_id: 2, nilai: '1A', urutan: 0 });
    memoryStore.atribut_opsi.set(2, { id: 2, atribut_id: 2, nilai: '2A', urutan: 1 });
    memoryStore.atribut_opsi.set(3, { id: 3, atribut_id: 2, nilai: '3A', urutan: 2 });
    memoryStore.atribut_opsi.set(4, { id: 4, atribut_id: 2, nilai: '5A', urutan: 3 });
    memoryStore.atribut_opsi.set(5, { id: 5, atribut_id: 3, nilai: 'Jack 5.5mm', urutan: 0 });
    memoryStore.atribut_opsi.set(6, { id: 6, atribut_id: 3, nilai: 'Jack 3.5mm', urutan: 1 });

    // Produk: Adaptor 12V Standar
    memoryStore.produk.set(1, { id: 1, jenis_id: 1, nama: 'Adaptor 12V Standar', kategori: 'fast_moving', catatan: 'Untuk ONU dan Router rumahan', aktif: 1, dibuat_oleh: 'system', dibuat_pada: new Date().toISOString() });
    // Tipe Varian
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
export function persistUsersToSeed() {
  try {
    const seedsDir = path.join(__dirname, 'seeds');
    const authSeedPath = path.join(seedsDir, 'auth_seed.json');
    const users = Array.from(memoryStore.users.values());
    fs.writeFileSync(authSeedPath, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[FieldOps Database] Gagal menyimpan user ke auth_seed.json:', err);
  }
}

/**
 * Unified Query Executor
 */
export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (isMariaDbActive && pool) {
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  }

  // Simulated query parser for development fallback
  return runMemoryQuery(sql, params);
}

/**
 * Transaksi Atomik Database Wrapper
 */
export async function runTransaction<T>(callback: (conn: { query: (sql: string, params?: any[]) => Promise<any> }) => Promise<T>): Promise<T> {
  if (isMariaDbActive && pool) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      const result = await callback({
        query: async (sql, params) => {
          const [res] = await conn.query(sql, params);
          return res;
        }
      });
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // In-memory atomic block
  return await callback({
    query: async (sql, params) => runMemoryQuery(sql, params || [])
  });
}

/**
 * Memory query router for preview development
 */
function runMemoryQuery(sql: string, params: any[]): any {
  if (memoryStore.users.size === 0) {
    seedMemoryDb();
  }
  const cleanSql = sql.trim();
  const upper = cleanSql.toUpperCase();

  // SELECT items
  if (upper.startsWith('SELECT') && upper.includes('FROM ITEMS')) {
    let list = Array.from(memoryStore.items.values()).filter(it => !it.is_deleted);
    if (upper.includes('WHERE ID = ?')) {
      const match = memoryStore.items.get(params[0]);
      return match && !match.is_deleted ? [match] : [];
    }
    if (upper.includes('WHERE SKU = ?')) {
      const match = list.find(it => it.sku.toLowerCase() === String(params[0]).toLowerCase());
      return match ? [match] : [];
    }
    return list;
  }

  // SELECT categories
  if (upper.startsWith('SELECT') && upper.includes('FROM CATEGORIES')) {
    if (upper.includes('WHERE ID = ?')) {
      const match = memoryStore.categories.get(params[0]);
      return match ? [match] : [];
    }
    return Array.from(memoryStore.categories.values());
  }

  // SELECT transactions
  if (upper.startsWith('SELECT') && upper.includes('FROM TRANSACTIONS')) {
    if (upper.includes('WHERE ID = ?') || upper.includes('WHERE T.ID = ?')) {
      const match = memoryStore.transactions.get(params[0]);
      return match ? [match] : [];
    }
    if (upper.includes('WHERE ITEM_ID = ?') || upper.includes('WHERE T.ITEM_ID = ?')) {
      const filtered = Array.from(memoryStore.transactions.values()).filter(t => t.item_id === params[0]);
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return filtered;
    }
    let list = Array.from(memoryStore.transactions.values());
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }

  // SELECT api_keys
  if (upper.startsWith('SELECT') && upper.includes('FROM API_KEYS')) {
    if (upper.includes('WHERE API_KEY_HASH = ?')) {
      const match = Array.from(memoryStore.api_keys.values()).find(k => k.api_key_hash === params[0] && k.is_active);
      return match ? [match] : [];
    }
    return Array.from(memoryStore.api_keys.values());
  }

  // SELECT users
  if (upper.startsWith('SELECT') && upper.includes('FROM USERS')) {
    if (upper.includes('WHERE ID = ?')) {
      const match = memoryStore.users.get(params[0]);
      return match ? [match] : [];
    }
    if (upper.includes('WHERE') && (upper.includes('USERNAME') || upper.includes('EMAIL'))) {
      const target1 = String(params[0] || '').toLowerCase().trim();
      const target2 = params[1] ? String(params[1]).toLowerCase().trim() : target1;
      const match = Array.from(memoryStore.users.values()).find(u => {
        const uName = String(u.username || '').toLowerCase().trim();
        const uEmail = String(u.email || '').toLowerCase().trim();
        return uName === target1 || uEmail === target1 || uName === target2 || uEmail === target2;
      });
      return match ? [match] : [];
    }
    return Array.from(memoryStore.users.values());
  }

  // SELECT sessions
  if (upper.startsWith('SELECT') && upper.includes('FROM SESSIONS')) {
    if (upper.includes('WHERE SESSION_ID = ?')) {
      const s = memoryStore.sessions.get(params[0]);
      if (!s) return [];
      if (new Date(s.expires_at).getTime() < Date.now()) {
        memoryStore.sessions.delete(params[0]);
        return [];
      }
      return [s];
    }
  }

  // SELECT checklists
  if (upper.startsWith('SELECT') && upper.includes('FROM CHECKLISTS')) {
    if (upper.includes('WHERE ID = ?')) {
      const match = memoryStore.checklists.get(params[0]);
      return match ? [match] : [];
    }
    return Array.from(memoryStore.checklists.values()).reverse();
  }

  // SELECT whatsapp_config
  if (upper.startsWith('SELECT') && upper.includes('FROM WHATSAPP_CONFIG')) {
    const cfg = memoryStore.whatsapp_config.get('1') || {
      id: 1,
      gateway_type: 'fonnte',
      api_url: 'https://api.fonnte.com/send',
      api_token: '',
      target_phones: '',
      auto_alert_enabled: true
    };
    return [cfg];
  }

  // SELECT whatsapp_logs
  if (upper.startsWith('SELECT') && upper.includes('FROM WHATSAPP_LOGS')) {
    return Array.from(memoryStore.whatsapp_logs.values()).reverse();
  }

  // INSERT / UPDATE handlers
  if (upper.startsWith('INSERT INTO SESSIONS')) {
    memoryStore.sessions.set(params[0], {
      session_id: params[0],
      user_id: params[1],
      ip_address: params[2],
      user_agent: params[3],
      expires_at: params[4],
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM SESSIONS WHERE SESSION_ID = ?')) {
    memoryStore.sessions.delete(params[0]);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM SESSIONS WHERE USER_ID = ?')) {
    const targetUserId = params[0];
    for (const [sId, sess] of memoryStore.sessions.entries()) {
      if (sess.user_id === targetUserId) {
        memoryStore.sessions.delete(sId);
      }
    }
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO USERS')) {
    let user: any;
    if (params.length === 7) {
      // Query from setupAdmin: [userId, username, name, email, role, hash, salt]
      user = {
        id: params[0],
        username: String(params[1]).trim(),
        name: String(params[2]).trim(),
        email: String(params[3]).trim(),
        role: params[4],
        department: 'Dev & Master System Engineering',
        phone: '',
        password_hash: params[5],
        salt: params[6] || '',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      };
    } else {
      user = {
        id: params[0],
        username: String(params[1]).trim(),
        name: String(params[2]).trim(),
        email: String(params[3]).trim(),
        role: params[4],
        department: params[5] || 'IT Operations',
        phone: params[6] || '',
        password_hash: params[7],
        salt: params[8] || '',
        status: params[9] || 'ACTIVE',
        created_at: new Date().toISOString()
      };
    }
    memoryStore.users.set(user.id, user);
    persistUsersToSeed();
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE USERS SET')) {
    const lastParam = params[params.length - 1];
    let user = memoryStore.users.get(lastParam);
    if (!user) {
      user = Array.from(memoryStore.users.values()).find(
        u => u.username === lastParam || u.id === lastParam || u.email === lastParam
      );
    }
    if (user) {
      if (upper.includes('PASSWORD_HASH = ?') && upper.includes('SALT = ?')) {
        user.password_hash = params[0];
        user.salt = params[1] || '';
        user.updated_at = new Date().toISOString();
      } else if (upper.includes('STATUS = ?') && params.length === 2) {
        user.status = params[0];
        user.updated_at = new Date().toISOString();
      } else if (params.length >= 4) {
        user.password_hash = params[0];
        user.salt = params[1] || '';
        user.role = params[2] || user.role;
        user.status = 'ACTIVE';
        user.updated_at = new Date().toISOString();
      } else if (upper.includes('ROLE = ?') && upper.includes('STATUS = ?')) {
        user.role = params[0];
        user.status = params[1];
        user.updated_at = new Date().toISOString();
      }
      memoryStore.users.set(user.id, user);
      persistUsersToSeed();
    }
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM USERS WHERE ID = ?') || upper.startsWith('DELETE FROM USERS WHERE USERNAME = ?')) {
    const target = params[0];
    const user = memoryStore.users.get(target) || Array.from(memoryStore.users.values()).find(u => u.username === target || u.id === target);
    if (user) {
      memoryStore.users.delete(user.id);
      for (const [sId, sess] of memoryStore.sessions.entries()) {
        if (sess.user_id === user.id) {
          memoryStore.sessions.delete(sId);
        }
      }
      persistUsersToSeed();
    }
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO ITEMS')) {
    const item = {
      id: params[0],
      sku: params[1],
      barcode: params[2],
      name: params[3],
      category_id: params[4],
      quantity: params[5],
      min_stock_alert: params[6],
      unit: params[7],
      location: params[8],
      specs: params[9],
      unit_cost: params[10],
      status: params[11],
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryStore.items.set(item.id, item);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO CATEGORIES')) {
    memoryStore.categories.set(params[0], {
      id: params[0],
      code: params[1],
      name: params[2],
      description: params[3] || '',
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM ITEMS WHERE ID = ?')) {
    memoryStore.items.delete(params[0]);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE ITEMS SET')) {
    if (upper.includes('IS_DELETED = TRUE')) {
      const item = memoryStore.items.get(params[0]);
      if (item) {
        item.is_deleted = true;
        item.deleted_at = new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
    if (upper.includes('IS_DELETED = FALSE')) {
      const item = memoryStore.items.get(params[0]);
      if (item) {
        item.is_deleted = false;
        item.deleted_at = null;
      }
      return { affectedRows: 1 };
    }
    if (upper.includes('QUANTITY = ?')) {
      const item = memoryStore.items.get(params[params.length - 1]);
      if (item) {
        item.quantity = params[0];
        item.status = params[1];
        item.updated_at = new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
    if (upper.includes('NAME = ?')) {
      const itemId = params[params.length - 1];
      const item = memoryStore.items.get(itemId);
      if (item) {
        item.name = params[0];
        item.category_id = params[1];
        item.quantity = params[2];
        item.min_stock_alert = params[3];
        item.unit = params[4];
        item.location = params[5];
        item.specs = params[6];
        item.unit_cost = params[7];
        item.status = params[8];
        item.updated_at = new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
  }

  if (upper.startsWith('INSERT INTO TRANSACTIONS')) {
    const tx = {
      id: params[0],
      type: params[1],
      item_id: params[2],
      quantity: params[3],
      previous_qty: params[4],
      new_qty: params[5],
      reference_type: params[6],
      reference_number: params[7],
      recipient_destination: params[8],
      user_id: params[9],
      performed_by: params[10],
      notes: params[11],
      created_at: new Date().toISOString()
    };
    memoryStore.transactions.set(tx.id, tx);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO API_KEYS')) {
    memoryStore.api_keys.set(params[0], {
      id: params[0],
      name: params[1],
      api_key_hash: params[2],
      system_name: params[3],
      allowed_actions: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
      is_active: true,
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO CHECKLISTS')) {
    memoryStore.checklists.set(params[0], {
      id: params[0],
      technician_id: params[1],
      technician_name: params[2],
      inspection_type: params[3],
      vehicle_or_kit_name: params[4],
      notes: params[5] || '',
      items_json: params[6],
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO AUDIT_LOGS')) {
    memoryStore.audit_logs.push({
      id: memoryStore.audit_logs.length + 1,
      user_id: params[0],
      action: params[1],
      table_name: params[2],
      record_id: params[3],
      before_state: params[4],
      after_state: params[5],
      ip_address: params[6],
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  // --- V2 FOUNDATION HANDLERS (Tahap 1) ---

  // PENGATURAN
  if (upper.startsWith('SELECT') && upper.includes('FROM PENGATURAN')) {
    if (upper.includes('WHERE KUNCI = ?')) {
      const p = memoryStore.pengaturan.get(params[0]);
      return p ? [p] : [];
    }
    return Array.from(memoryStore.pengaturan.values());
  }

  if (upper.startsWith('INSERT INTO PENGATURAN')) {
    memoryStore.pengaturan.set(params[0], {
      kunci: params[0],
      nilai: String(params[1]),
      keterangan: params[2] || null,
      diperbarui_pada: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  // SESI (v2 Server-Authoritative Sessions)
  if (upper.startsWith('SELECT') && upper.includes('FROM SESI')) {
    const list = Array.from(memoryStore.sesi.values());
    if (upper.includes('WHERE USER_ID = ? AND DICABUT_PADA IS NULL')) {
      const filtered = list.filter(s => s.user_id === params[0] && !s.dicabut_pada);
      filtered.sort((a, b) => new Date(a.dibuat_pada).getTime() - new Date(b.dibuat_pada).getTime());
      return filtered;
    }
    if (upper.includes('WHERE S.ID = ?') || upper.includes('WHERE ID = ?')) {
      const match = memoryStore.sesi.get(params[0]);
      if (!match) return [];
      const user = memoryStore.users.get(match.user_id) || {};
      return [{ ...match, username: user.username, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, status: user.status }];
    }
    if (upper.includes('WHERE S.REFRESH_HASH = ?') || upper.includes('WHERE REFRESH_HASH = ?')) {
      const match = list.find(s => s.refresh_hash === params[0]);
      if (!match) return [];
      const user = memoryStore.users.get(match.user_id) || {};
      return [{ ...match, username: user.username, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, status: user.status }];
    }
    return list;
  }

  if (upper.startsWith('INSERT INTO SESI')) {
    memoryStore.sesi.set(params[0], {
      id: params[0],
      user_id: params[1],
      refresh_hash: params[2],
      device_id_hash: params[3],
      user_agent: params[4],
      ip: params[5],
      dibuat_pada: new Date().toISOString(),
      aktivitas_terakhir: new Date().toISOString(),
      kedaluwarsa_mutlak: params[6] instanceof Date ? params[6].toISOString() : String(params[6]),
      dicabut_pada: null
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE SESI')) {
    if (upper.includes('SET DICABUT_PADA = NOW() WHERE ID = ?')) {
      const s = memoryStore.sesi.get(params[0]);
      if (s) s.dicabut_pada = new Date().toISOString();
      return { affectedRows: s ? 1 : 0 };
    }
    if (upper.includes('SET DICABUT_PADA = NOW() WHERE USER_ID = ?')) {
      let count = 0;
      for (const s of memoryStore.sesi.values()) {
        if (s.user_id === params[0] && !s.dicabut_pada) {
          s.dicabut_pada = new Date().toISOString();
          count++;
        }
      }
      return { affectedRows: count };
    }
    if (upper.includes('SET AKTIVITAS_TERAKHIR = NOW() WHERE ID = ?')) {
      const s = memoryStore.sesi.get(params[0]);
      if (s) s.aktivitas_terakhir = new Date().toISOString();
      return { affectedRows: s ? 1 : 0 };
    }
    if (upper.includes('SET REFRESH_HASH = ?')) {
      const s = memoryStore.sesi.get(params[params.length - 1]);
      if (s) {
        s.refresh_hash = params[0];
        s.aktivitas_terakhir = new Date().toISOString();
        s.ip = params[1];
        s.user_agent = params[2];
      }
      return { affectedRows: s ? 1 : 0 };
    }
  }

  // TRANSAKSI & TRANSAKSI_DETAIL
  if (upper.startsWith('SELECT') && upper.includes('FROM TRANSAKSI')) {
    if (upper.includes('WHERE ID_AKTIVITAS LIKE ?')) {
      const prefix = String(params[0]).replace('%', '');
      const list = Array.from(memoryStore.transaksi_v2.values())
        .filter(t => t.id_aktivitas.startsWith(prefix));
      list.sort((a, b) => b.id_aktivitas.localeCompare(a.id_aktivitas));
      return list.slice(0, 1);
    }
    const list = Array.from(memoryStore.transaksi_v2.values());
    list.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
    return list;
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM TRANSAKSI_DETAIL')) {
    if (upper.includes('WHERE TRANSAKSI_ID = ?')) {
      return memoryStore.transaksi_detail_v2.filter(d => d.transaksi_id === params[0]);
    }
    return memoryStore.transaksi_detail_v2;
  }

  if (upper.startsWith('INSERT INTO TRANSAKSI (')) {
    const tx = {
      id: params[0],
      id_aktivitas: params[1],
      aksi: params[2],
      pelaku_id: params[3],
      penyetuju_id: params[4] || null,
      request_id: params[5] || null,
      box_asal: params[6] || null,
      box_tujuan: params[7] || null,
      catatan: params[8] || null,
      waktu: new Date().toISOString()
    };
    memoryStore.transaksi_v2.set(tx.id, tx);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO TRANSAKSI_DETAIL')) {
    const d = {
      id: memoryStore.transaksi_detail_v2.length + 1,
      transaksi_id: params[0],
      tipe_id: params[1] || null,
      item_id: params[2] || null,
      kode_id: params[3] || null,
      nama_snapshot: params[4],
      jumlah: params[5] || 1,
      status_sebelum: params[6] || null,
      status_sesudah: params[7] || null
    };
    memoryStore.transaksi_detail_v2.push(d);
    return { affectedRows: 1 };
  }

  // SAMPAH_HAPUS
  if (upper.startsWith('SELECT') && upper.includes('FROM SAMPAH_HAPUS')) {
    const list = Array.from(memoryStore.sampah_hapus.values());
    if (upper.includes('WHERE S.STATUS = \'MENUNGGU\'') || upper.includes('WHERE STATUS = \'MENUNGGU\'')) {
      if (upper.includes('PURGE_SETELAH <= NOW()')) {
        const now = Date.now();
        return list.filter(s => s.status === 'menunggu' && new Date(s.purge_setelah).getTime() <= now);
      }
      const filtered = list.filter(s => s.status === 'menunggu');
      filtered.sort((a, b) => new Date(b.dibuat_pada || b.dihapus_pada).getTime() - new Date(a.dibuat_pada || a.dihapus_pada).getTime());
      return filtered;
    }
    if (upper.includes('WHERE S.ID = ?') || upper.includes('WHERE ID = ?')) {
      const match = memoryStore.sampah_hapus.get(params[0]);
      return match ? [match] : [];
    }
    return list;
  }

  if (upper.startsWith('INSERT INTO SAMPAH_HAPUS')) {
    const s = {
      id: params[0],
      jenis_objek: params[1],
      objek_id: params[2],
      snapshot: params[3],
      dihapus_oleh: params[4],
      dihapus_pada: new Date().toISOString(),
      aktivitas_id: params[5],
      purge_setelah: params[6] instanceof Date ? params[6].toISOString() : String(params[6]),
      status: 'menunggu'
    };
    memoryStore.sampah_hapus.set(s.id, s);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE SAMPAH_HAPUS')) {
    const s = memoryStore.sampah_hapus.get(params[params.length - 1]);
    if (s) {
      if (upper.includes('STATUS = "DIPULIHKAN"')) s.status = 'dipulihkan';
      if (upper.includes("STATUS = 'DIBERSIHKAN'")) {
        s.status = 'dibersihkan';
        s.snapshot = '';
      }
    }
    return { affectedRows: s ? 1 : 0 };
  }

  // TOKEN_KONFIRMASI
  if (upper.startsWith('SELECT') && upper.includes('FROM TOKEN_KONFIRMASI')) {
    if (upper.includes('WHERE TOKEN_HASH = ?')) {
      const match = Array.from(memoryStore.token_konfirmasi.values()).find(t => t.token_hash === params[0]);
      return match ? [match] : [];
    }
    return Array.from(memoryStore.token_konfirmasi.values());
  }

  if (upper.startsWith('INSERT INTO TOKEN_KONFIRMASI')) {
    const t = {
      id: params[0],
      token_hash: params[1],
      user_id: params[2],
      action_type: params[3],
      target_id: params[4],
      tier: params[5],
      expires_at: params[6] instanceof Date ? params[6].toISOString() : String(params[6]),
      used_at: null,
      created_at: new Date().toISOString()
    };
    memoryStore.token_konfirmasi.set(t.id, t);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE TOKEN_KONFIRMASI SET USED_AT = NOW() WHERE ID = ?')) {
    const t = memoryStore.token_konfirmasi.get(params[0]);
    if (t && !t.used_at) {
      t.used_at = new Date().toISOString();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // ============================================================================
  // KATALOG V2 (JENIS, ATRIBUT, ATRIBUT_OPSI, PRODUK, TIPE, TIPE_NILAI)
  // ============================================================================

  // JENIS
  if (upper.startsWith('INSERT INTO JENIS')) {
    const nextId = memoryStore.jenis.size + 1;
    const j = {
      id: nextId,
      nama: params[0],
      sumber_id_bawaan: params[1] || 'manual',
      prefix_id_bawaan: params[2] || null,
      aktif: 1,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.jenis.set(nextId, j);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE JENIS SET NAMA =')) {
    const id = parseInt(String(params[3]), 10);
    const j = memoryStore.jenis.get(id);
    if (j) {
      j.nama = params[0];
      j.sumber_id_bawaan = params[1] || 'manual';
      j.prefix_id_bawaan = params[2] || null;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE JENIS SET AKTIF = 0 WHERE ID = ?')) {
    const id = parseInt(String(params[0]), 10);
    const j = memoryStore.jenis.get(id);
    if (j) {
      j.aktif = 0;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('SELECT J.*') && upper.includes('FROM JENIS J')) {
    const list = Array.from(memoryStore.jenis.values())
      .filter(j => j.aktif === 1 || j.aktif === true)
      .map(j => {
        const prodCount = Array.from(memoryStore.produk.values()).filter(p => p.jenis_id === j.id && (p.aktif === 1 || p.aktif === true)).length;
        return { ...j, total_produk: prodCount };
      });
    list.sort((a, b) => a.nama.localeCompare(b.nama));
    return list;
  }

  if (upper.startsWith('SELECT * FROM JENIS WHERE ID = ?')) {
    const id = parseInt(String(params[0]), 10);
    const j = memoryStore.jenis.get(id);
    return j ? [{ ...j }] : [];
  }

  // ATRIBUT & ATRIBUT_OPSI
  if (upper.startsWith('INSERT INTO ATRIBUT (')) {
    const nextId = memoryStore.atribut.size + 1;
    const a = {
      id: nextId,
      jenis_id: parseInt(String(params[0]), 10),
      kode: params[1],
      nama: params[2],
      tipe_isian: params[3],
      satuan: params[4] || null,
      wajib: params[5] === 1 || params[5] === true ? 1 : 0,
      urutan: params[6] || 0,
      masuk_nama: params[7] === 1 || params[7] === true ? 1 : 0,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.atribut.set(nextId, a);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('SELECT * FROM ATRIBUT WHERE JENIS_ID = ?')) {
    const jenisId = parseInt(String(params[0]), 10);
    const list = Array.from(memoryStore.atribut.values())
      .filter(a => a.jenis_id === jenisId);
    list.sort((a, b) => a.urutan - b.urutan || a.id - b.id);
    return list.map(item => ({ ...item }));
  }

  if (upper.startsWith('INSERT INTO ATRIBUT_OPSI')) {
    const nextId = memoryStore.atribut_opsi.size + 1;
    const ao = {
      id: nextId,
      atribut_id: parseInt(String(params[0]), 10),
      nilai: params[1],
      urutan: params[2] || 0
    };
    memoryStore.atribut_opsi.set(nextId, ao);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('SELECT * FROM ATRIBUT_OPSI WHERE ATRIBUT_ID = ?')) {
    const atributId = parseInt(String(params[0]), 10);
    if (upper.includes('LOWER(NILAI) = LOWER(?)')) {
      const target = String(params[1]).toLowerCase();
      const match = Array.from(memoryStore.atribut_opsi.values())
        .filter(o => o.atribut_id === atributId && o.nilai.toLowerCase() === target);
      return match.map(m => ({ ...m }));
    }
    const list = Array.from(memoryStore.atribut_opsi.values())
      .filter(o => o.atribut_id === atributId);
    list.sort((a, b) => a.urutan - b.urutan || a.id - b.id);
    return list.map(item => ({ ...item }));
  }

  // PRODUK
  if (upper.startsWith('INSERT INTO PRODUK (')) {
    const nextId = memoryStore.produk.size + 1;
    const p = {
      id: nextId,
      jenis_id: parseInt(String(params[0]), 10),
      nama: params[1],
      kategori: params[2] || 'fast_moving',
      catatan: params[3] || null,
      aktif: 1,
      dibuat_oleh: params[4] || null,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.produk.set(nextId, p);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE PRODUK SET NAMA =')) {
    const id = parseInt(String(params[3]), 10);
    const p = memoryStore.produk.get(id);
    if (p) {
      p.nama = params[0];
      p.kategori = params[1];
      p.catatan = params[2] || null;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE PRODUK SET AKTIF = 0 WHERE ID = ?')) {
    const id = parseInt(String(params[0]), 10);
    const p = memoryStore.produk.get(id);
    if (p) {
      p.aktif = 0;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.includes('FROM PRODUK P') && upper.includes('WHERE P.ID = ?')) {
    const id = parseInt(String(params[0]), 10);
    const p = memoryStore.produk.get(id);
    if (!p) return [];
    const j = memoryStore.jenis.get(p.jenis_id);
    return [{ ...p, jenis_nama: j ? j.nama : '' }];
  }

  if (upper.includes('SELECT ID FROM PRODUK WHERE JENIS_ID = ? AND AKTIF = 1')) {
    const jenisId = parseInt(String(params[0]), 10);
    const prods = Array.from(memoryStore.produk.values())
      .filter(p => p.jenis_id === jenisId && (p.aktif === 1 || p.aktif === true));
    return prods.map(p => ({ id: p.id }));
  }

  if (upper.startsWith('SELECT P.*') && upper.includes('FROM PRODUK P')) {
    let list = Array.from(memoryStore.produk.values())
      .filter(p => p.aktif === 1 || p.aktif === true);

    let paramIdx = 0;
    if (upper.includes('AND P.JENIS_ID = ?')) {
      const jId = parseInt(String(params[paramIdx++]), 10);
      list = list.filter(p => p.jenis_id === jId);
    }
    if (upper.includes('AND P.KATEGORI = ?')) {
      const kat = String(params[paramIdx++]);
      list = list.filter(p => p.kategori === kat);
    }
    if (upper.includes('AND (LOWER(P.NAMA) LIKE ? OR LOWER(J.NAMA) LIKE ?)')) {
      const query = String(params[paramIdx]).replace(/%/g, '').toLowerCase();
      list = list.filter(p => {
        const j = memoryStore.jenis.get(p.jenis_id);
        const jName = j ? j.nama.toLowerCase() : '';
        return p.nama.toLowerCase().includes(query) || jName.includes(query);
      });
    }

    const mapped = list.map(p => {
      const j = memoryStore.jenis.get(p.jenis_id);
      const totalTipe = Array.from(memoryStore.tipe.values())
        .filter(t => t.produk_id === p.id && (t.aktif === 1 || t.aktif === true)).length;
      return { ...p, jenis_nama: j ? j.nama : '', total_tipe: totalTipe };
    });
    mapped.sort((a, b) => a.nama.localeCompare(b.nama));
    return mapped;
  }

  // TIPE
  if (upper.startsWith('INSERT INTO TIPE (')) {
    const nextId = memoryStore.tipe.size + 1;
    const t = {
      id: nextId,
      produk_id: parseInt(String(params[0]), 10),
      nama_tipe: params[1],
      catatan: params[2] || null,
      sumber_id: params[3] || 'manual',
      mode_stok: params[4] || 'per_id',
      prefix_id: params[5] || null,
      pola_id: params[6] || null,
      id_dikunci: 0,
      aktif: 1,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.tipe.set(nextId, t);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE TIPE SET SUMBER_ID =')) {
    const id = parseInt(String(params[params.length - 1]), 10);
    const t = memoryStore.tipe.get(id);
    if (t) {
      t.sumber_id = params[0];
      t.mode_stok = params[1];
      t.prefix_id = params[2] || null;
      t.pola_id = params[3] || null;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.includes('SELECT ID FROM TIPE WHERE PRODUK_ID = ? AND NAMA_TIPE = ? AND AKTIF = 1')) {
    const prodId = parseInt(String(params[0]), 10);
    const namaTipe = String(params[1]);
    const match = Array.from(memoryStore.tipe.values())
      .filter(t => t.produk_id === prodId && t.nama_tipe === namaTipe && (t.aktif === 1 || t.aktif === true));
    return match.map(m => ({ id: m.id }));
  }

  if (upper.startsWith('SELECT T.*') && upper.includes('FROM TIPE T')) {
    if (upper.includes('WHERE T.ID = ?')) {
      const id = parseInt(String(params[0]), 10);
      const t = memoryStore.tipe.get(id);
      if (!t) return [];
      const prod = memoryStore.produk.get(t.produk_id);
      const jenis = prod ? memoryStore.jenis.get(prod.jenis_id) : null;
      return [{
        ...t,
        produk_nama: prod ? prod.nama : '',
        jenis_nama: jenis ? jenis.nama : ''
      }];
    }

    if (upper.includes('WHERE T.PRODUK_ID = ? AND T.AKTIF = 1')) {
      const prodId = parseInt(String(params[0]), 10);
      const list = Array.from(memoryStore.tipe.values())
        .filter(t => t.produk_id === prodId && (t.aktif === 1 || t.aktif === true));
      list.sort((a, b) => a.nama_tipe.localeCompare(b.nama_tipe));
      return list.map(t => {
        const prod = memoryStore.produk.get(t.produk_id);
        const jenis = prod ? memoryStore.jenis.get(prod.jenis_id) : null;
        return {
          ...t,
          produk_nama: prod ? prod.nama : '',
          jenis_nama: jenis ? jenis.nama : ''
        };
      });
    }
  }

  // TIPE_NILAI
  if (upper.startsWith('INSERT INTO TIPE_NILAI')) {
    const key = `${params[0]}_${params[1]}`;
    memoryStore.tipe_nilai.set(key, {
      tipe_id: parseInt(String(params[0]), 10),
      atribut_id: parseInt(String(params[1]), 10),
      nilai_angka: params[2] !== undefined && params[2] !== null ? Number(params[2]) : null,
      opsi_id: params[3] !== undefined && params[3] !== null ? parseInt(String(params[3]), 10) : null,
      nilai_teks: params[4] || null
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('SELECT TN.*') && upper.includes('FROM TIPE_NILAI TN')) {
    const tipeId = parseInt(String(params[0]), 10);
    const list = Array.from(memoryStore.tipe_nilai.values())
      .filter(tn => tn.tipe_id === tipeId);

    const enriched = list.map(tn => {
      const a = memoryStore.atribut.get(tn.atribut_id);
      const ao = tn.opsi_id ? memoryStore.atribut_opsi.get(tn.opsi_id) : null;
      return {
        tipe_id: tn.tipe_id,
        atribut_id: tn.atribut_id,
        nilai_angka: tn.nilai_angka,
        opsi_id: tn.opsi_id,
        nilai_teks: tn.nilai_teks,
        atribut_nama: a ? a.nama : '',
        tipe_isian: a ? a.tipe_isian : 'teks',
        satuan: a ? a.satuan : null,
        opsi_nilai: ao ? ao.nilai : null
      };
    });

    return enriched;
  }

  // UPDATE TIPE SET ID_DIKUNCI = 1
  if (upper.startsWith('UPDATE TIPE SET ID_DIKUNCI = 1')) {
    const id = parseInt(String(params[0]), 10);
    const t = memoryStore.tipe.get(id);
    if (t) {
      t.id_dikunci = 1;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // ============================================================================
  // STOK V2 (BOX, ITEM, STOK_JUMLAH)
  // ============================================================================

  // BOX
  if (upper.startsWith('INSERT INTO BOX')) {
    const b = {
      id: params[0],
      kode: params[1],
      keterangan: params[2] || null,
      aktif: 1,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.box.set(b.id, b);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('SELECT B.*') && upper.includes('FROM BOX B')) {
    const list = Array.from(memoryStore.box.values()).filter(b => b.aktif === 1 || b.aktif === true);
    const enriched = list.map(b => {
      const activeItemsCount = Array.from(memoryStore.item_v2.values()).filter(i => i.box_id === b.id && i.status === 'aktif').length;
      const sjCount = Array.from(memoryStore.stok_jumlah.values()).filter(s => s.box_id === b.id).reduce((acc, c) => acc + (c.jumlah || 0), 0);
      return { ...b, total_item: activeItemsCount + sjCount };
    });
    enriched.sort((a, b) => a.kode.localeCompare(b.kode));
    return enriched;
  }

  if (upper.startsWith('SELECT * FROM BOX WHERE ID = ?')) {
    const b = memoryStore.box.get(params[0]);
    return b ? [{ ...b }] : [];
  }

  if (upper.startsWith('SELECT * FROM BOX WHERE UPPER(KODE) = ?')) {
    const code = String(params[0]).toUpperCase();
    const match = Array.from(memoryStore.box.values()).find(b => b.kode.toUpperCase() === code);
    return match ? [{ ...match }] : [];
  }

  // ITEM
  if (upper.startsWith('INSERT INTO ITEM (')) {
    const it = {
      id: params[0],
      kode_id: params[1],
      tipe_id: parseInt(String(params[2]), 10),
      box_id: params[3],
      status: params[4] || 'aktif',
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.item_v2.set(it.id, it);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE ITEM SET BOX_ID = ? WHERE ID = ?')) {
    const it = memoryStore.item_v2.get(params[1]);
    if (it) {
      it.box_id = params[0];
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('SELECT I.*') && upper.includes('FROM ITEM I')) {
    if (upper.includes('WHERE UPPER(I.KODE_ID) = UPPER(?)')) {
      const target = String(params[0]).toUpperCase();
      const match = Array.from(memoryStore.item_v2.values()).find(i => i.kode_id.toUpperCase() === target);
      if (!match) return [];
      const b = memoryStore.box.get(match.box_id);
      const t = memoryStore.tipe.get(match.tipe_id);
      const p = t ? memoryStore.produk.get(t.produk_id) : null;
      return [{
        ...match,
        kode_box: b ? b.kode : '',
        nama_tipe: t ? t.nama_tipe : '',
        nama_produk: p ? p.nama : ''
      }];
    }

    if (upper.includes('WHERE I.BOX_ID = ? AND I.STATUS = \'AKTIF\'')) {
      const boxId = params[0];
      const list = Array.from(memoryStore.item_v2.values()).filter(i => i.box_id === boxId && i.status === 'aktif');
      const enriched = list.map(i => {
        const t = memoryStore.tipe.get(i.tipe_id);
        const p = t ? memoryStore.produk.get(t.produk_id) : null;
        const j = p ? memoryStore.jenis.get(p.jenis_id) : null;
        return {
          ...i,
          nama_tipe: t ? t.nama_tipe : '',
          nama_produk: p ? p.nama : '',
          jenis_nama: j ? j.nama : ''
        };
      });
      enriched.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk) || a.nama_tipe.localeCompare(b.nama_tipe) || a.kode_id.localeCompare(b.kode_id));
      return enriched;
    }
  }

  if (upper.startsWith('SELECT * FROM ITEM WHERE ID = ?')) {
    const it = memoryStore.item_v2.get(params[0]);
    return it ? [{ ...it }] : [];
  }

  if (upper.startsWith('SELECT KODE_ID FROM ITEM WHERE ID = ?')) {
    const it = memoryStore.item_v2.get(params[0]);
    return it ? [{ kode_id: it.kode_id }] : [];
  }

  // STOK_JUMLAH
  if (upper.startsWith('SELECT * FROM STOK_JUMLAH WHERE TIPE_ID = ? AND BOX_ID = ?')) {
    const key = `${params[0]}_${params[1]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    return sj ? [{ ...sj }] : [];
  }

  if (upper.startsWith('UPDATE STOK_JUMLAH SET JUMLAH = JUMLAH - ? WHERE TIPE_ID = ? AND BOX_ID = ?')) {
    const key = `${params[1]}_${params[2]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    if (sj) {
      sj.jumlah = Math.max(0, sj.jumlah - Number(params[0]));
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE STOK_JUMLAH SET JUMLAH = JUMLAH + ? WHERE TIPE_ID = ? AND BOX_ID = ?')) {
    const key = `${params[1]}_${params[2]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    if (sj) {
      sj.jumlah += Number(params[0]);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('INSERT INTO STOK_JUMLAH')) {
    const key = `${params[0]}_${params[1]}`;
    memoryStore.stok_jumlah.set(key, {
      tipe_id: parseInt(String(params[0]), 10),
      box_id: params[1],
      jumlah: Number(params[2])
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('SELECT SJ.*') && upper.includes('FROM STOK_JUMLAH SJ')) {
    const boxId = params[0];
    const list = Array.from(memoryStore.stok_jumlah.values()).filter(s => s.box_id === boxId && s.jumlah > 0);
    const enriched = list.map(s => {
      const t = memoryStore.tipe.get(s.tipe_id);
      const p = t ? memoryStore.produk.get(t.produk_id) : null;
      const j = p ? memoryStore.jenis.get(p.jenis_id) : null;
      return {
        ...s,
        nama_tipe: t ? t.nama_tipe : '',
        nama_produk: p ? p.nama : '',
        jenis_nama: j ? j.nama : ''
      };
    });
    enriched.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk) || a.nama_tipe.localeCompare(b.nama_tipe));
    return enriched;
  }

  return [];
}

export { memoryStore };
