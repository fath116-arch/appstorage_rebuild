/**
 * In-Memory Database Store
 * Holds fallback collections when MariaDB is unavailable during local/preview runs.
 */

export class MemoryDbStore {
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
  request: Map<string, any> = new Map();
}

export const memoryStore = new MemoryDbStore();
