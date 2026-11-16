/**
 * Database Connection & Migration Engine
 * FieldOps IT Inventory - MariaDB 11.x Local Driver with Autonomous Development Fallback
 * Strict UTC session timezone (+00:00)
 */

import mysql from 'mysql2/promise';
import { getErrorMessage } from '../utils/errorUtils';
import { memoryStore } from './memoryStore';
import { persistUsersToSeed, seedMemoryDb } from './memorySeed';
import { runMigrations, splitSqlStatements } from './migrator';
import { handleLegacyMemoryQuery } from './memoryHandlers/legacyMemory';
import { handleAuthMemoryQuery } from './memoryHandlers/authMemory';
import { handleCatalogMemoryQuery } from './memoryHandlers/catalogMemory';
import { handleStockMemoryQuery } from './memoryHandlers/stockMemory';
import { normalizeDbDateToIso } from '../utils/timezone';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  connectionLimit: number;
  timezone: string;
}

export const dbConfig: DbConfig = {
  host: process.env.DB_HOST || process.env.MARIADB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.MARIADB_PORT || '3306', 10),
  user: process.env.DB_USER || process.env.MARIADB_USER || 'fieldops_user',
  password: process.env.DB_PASSWORD || process.env.MARIADB_PASSWORD || 'fieldops_secret',
  database: process.env.DB_NAME || process.env.MARIADB_DATABASE || 'fieldops_inventory',
  connectionLimit: 10,
  timezone: '+00:00'
};

let pool: mysql.Pool | null = null;
let isMariaDbActive = false;

const DATE_COLUMNS = new Set([
  'waktu',
  'occurred_at',
  'recorded_at',
  'created_at',
  'updated_at',
  'dibuat_pada',
  'diproses_pada',
  'taken_at',
  'returned_at',
  'diperbarui_pada',
  'dihapus_pada',
  'purge_setelah',
  'expires_at',
  'used_at',
  'dicabut_pada',
  'aktivitas_terakhir',
  'kedaluwarsa_mutlak',
  'last_used_at'
]);

function normalizeRowDates<T>(rows: T): T {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row: any) => {
    if (!row || typeof row !== 'object') return row;
    const out: Record<string, any> = { ...row };
    for (const key of Object.keys(out)) {
      const val = out[key];
      if (val instanceof Date) {
        out[key] = val.toISOString();
      } else if (DATE_COLUMNS.has(key) && typeof val === 'string' && val.trim() !== '') {
        const iso = normalizeDbDateToIso(val);
        if (iso) out[key] = iso;
      }
    }
    return out;
  }) as unknown as T;
}

/**
 * Inisialisasi Database & Eksekusi Migrasi Skema
 */
export async function initDatabase(): Promise<{ isMariaDb: boolean }> {
  try {
    const testPool = mysql.createPool(dbConfig);
    testPool.on('connection', (connection) => {
      connection.query("SET time_zone = '+00:00'");
    });
    const conn = await testPool.getConnection();
    await conn.query("SET time_zone = '+00:00'");
    await conn.ping();
    conn.release();
    pool = testPool;
    isMariaDbActive = true;
    console.log(`[FieldOps Database] Terhubung ke MariaDB (UTC +00:00) di ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

    // Jalankan migrasi file skema berversi
    await runMigrations(pool);

    // Konsolidasi & backup data historis ke model tunggal secara idempotent
    try {
      const { DataConsolidationService } = await import('../services/dataConsolidationService');
      await DataConsolidationService.consolidateAll();
    } catch (migErr: unknown) {
      console.warn('[FieldOps Database] Warning saat konsolidasi data:', getErrorMessage(migErr));
    }

    return { isMariaDb: true };
  } catch {
    console.warn(`[FieldOps Database] MariaDB (${dbConfig.host}:${dbConfig.port}) belum terhubung. Mengaktifkan adapter lokal mandiri (UTC).`);
    isMariaDbActive = false;
    await seedMemoryDb();

    try {
      const { DataConsolidationService } = await import('../services/dataConsolidationService');
      await DataConsolidationService.consolidateAll();
    } catch (migErr: unknown) {
      console.warn('[FieldOps Database] Warning saat konsolidasi data lokal:', getErrorMessage(migErr));
    }

    return { isMariaDb: false };
  }
}

/**
 * Unified Query Executor
 */
export async function executeQuery<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (isMariaDbActive && pool) {
    const [rows] = await pool.query(sql, params);
    return normalizeRowDates(rows) as T[];
  }

  return runMemoryQuery(sql, params);
}

export interface DbTxConnection {
  query: <T = any>(sql: string, params?: unknown[]) => Promise<T>;
}

/**
 * Transaksi Atomik Database Wrapper
 */
export async function runTransaction<T>(
  callback: (conn: DbTxConnection) => Promise<T>
): Promise<T> {
  if (isMariaDbActive && pool) {
    const conn = await pool.getConnection();
    await conn.query("SET time_zone = '+00:00'");
    await conn.beginTransaction();
    try {
      const result = await callback({
        query: async <T = any>(sql: string, params?: unknown[]): Promise<T> => {
          const [res] = await conn.query(sql, params);
          return normalizeRowDates(res) as T;
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

const MEMORY_HANDLERS = [
  handleAuthMemoryQuery,
  handleCatalogMemoryQuery,
  handleStockMemoryQuery,
  handleLegacyMemoryQuery
];

/**
 * Memory query router for preview development
 */
function runMemoryQuery(sql: string, params: unknown[]): any {
  if (memoryStore.users.size === 0) {
    seedMemoryDb();
  }
  const cleanSql = sql.trim();
  const upper = cleanSql.toUpperCase();

  for (const handler of MEMORY_HANDLERS) {
    const result = handler(cleanSql, upper, params);
    if (result !== undefined) {
      return result;
    }
  }

  return [];
}

export { memoryStore, persistUsersToSeed, splitSqlStatements };
