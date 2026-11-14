/**
 * Database Connection & Migration Engine
 * FieldOps IT Inventory - MariaDB 11.x Local Driver with Autonomous Development Fallback
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

/**
 * Inisialisasi Database & Eksekusi Migrasi Skema
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

    // Jalankan migrasi legacy ke v2 secara otomatis dan idempotent
    try {
      const { LegacyMigrationService } = await import('../services/legacyMigrationService');
      await LegacyMigrationService.runMigration();
    } catch (migErr: unknown) {
      console.warn('[FieldOps Database] Warning saat migrasi v2 katalog:', getErrorMessage(migErr));
    }

    return { isMariaDb: true };
  } catch {
    console.warn(`[FieldOps Database] MariaDB (${dbConfig.host}:${dbConfig.port}) belum terhubung. Mengaktifkan adapter lokal mandiri.`);
    isMariaDbActive = false;
    await seedMemoryDb();

    // Jalankan migrasi legacy ke v2 pada memory store
    try {
      const { LegacyMigrationService } = await import('../services/legacyMigrationService');
      await LegacyMigrationService.runMigration();
    } catch (migErr: unknown) {
      console.warn('[FieldOps Database] Warning saat migrasi v2 katalog lokal:', getErrorMessage(migErr));
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
    return rows as T[];
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
    await conn.beginTransaction();
    try {
      const result = await callback({
        query: async <T = any>(sql: string, params?: unknown[]): Promise<T> => {
          const [res] = await conn.query(sql, params);
          return res as T;
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
  handleLegacyMemoryQuery,
  handleAuthMemoryQuery,
  handleCatalogMemoryQuery,
  handleStockMemoryQuery
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
