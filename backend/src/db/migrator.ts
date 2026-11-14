/**
 * SQL Migration Runner & Statement Splitter
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getErrorMessage } from '../utils/errorUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_FILES = [
  '01_auth_schema.sql',
  '02_inventory_schema.sql',
  '03_audit_trail_schema.sql',
  '04_v2_foundation_schema.sql',
  '05_v2_catalog_schema.sql',
  '06_v2_stock_schema.sql',
  '07_v2_request_schema.sql',
  '08_v125_paket4_schema.sql',
  '09_v125_paket6_wa_alert.sql',
  '10_v2_unify_stock_and_sessions.sql',
  '11_drop_transactions_item_id_fk.sql'
];

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
 * Menjalankan migrasi SQL berurutan
 */
export async function runMigrations(dbPool: mysql.Pool): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) continue;

    const sql = fs.readFileSync(filePath, 'utf-8');
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
      try {
        await dbPool.query(statement);
      } catch (e: unknown) {
        const message = getErrorMessage(e, '');
        // Ignore index already exists error or fk already dropped error
        if (
          !message.includes('Duplicate key name') &&
          !message.includes("Can't DROP") &&
          !message.includes('check that column/key exists')
        ) {
          console.warn(`[Migration Warning] ${file}: ${message}`);
        }
      }
    }
    console.log(`[FieldOps Migration] Berhasil menjalankan: ${file}`);
  }
}
