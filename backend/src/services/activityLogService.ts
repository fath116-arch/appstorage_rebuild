/**
 * Activity Log & Canonical Transaction Ledger Service (Append-Only)
 * FieldOps IT — Single Unified Ledger
 * Mencatat seluruh mutasi & aktivitas dengan UTC storage, WIB AKT-YYYYMMDD-NNNN ID,
 * pemisahan actor vs recorded_by, occurred_at vs recorded_at, serta koreksi teraudit.
 */

import crypto from 'crypto';
import { DbTxConnection, executeQuery, runTransaction } from '../db/database';
import { canActOnBehalf } from '../utils/permissions';
import {
  getWibCompactDate,
  normalizeDbDateToIso,
  toMysqlUtcDatetime,
  toMysqlUtcSeconds,
  validateOccurredAt
} from '../utils/timezone';

export interface ActivityDetailInput {
  tipe_id?: number | null;
  item_id?: string | null;
  kode_id?: string | null;
  nama_snapshot: string;
  jumlah?: number;
  status_sebelum?: string | null;
  status_sesudah?: string | null;
}

export interface CreateActivityInput {
  aksi: string;
  pelaku_id: string;
  actor_id?: string | null;
  actor_nama?: string | null;
  recorded_by_id?: string | null;
  recorded_by_nama?: string | null;
  recorded_by_role?: string | null;
  on_behalf_reason?: string | null;
  occurred_at?: string | Date | null;
  penyetuju_id?: string | null;
  request_id?: string | null;
  correction_of_id?: string | null;
  reference_type?: string | null;
  reference_number?: string | null;
  recipient_destination?: string | null;
  qty_total?: number;
  tipe_mutasi?: 'MASUK' | 'KELUAR' | 'TRANSFER' | 'SYSTEM' | null;
  box_asal?: string | null;
  box_tujuan?: string | null;
  catatan?: string | null;
  details?: ActivityDetailInput[];
}

interface ActivityIdRow {
  id_aktivitas: string;
}

interface UserNameRow {
  id: string;
  name: string;
  role?: string;
}

export const USER_AUTH_ACTIONS = [
  'login',
  'logout'
] as const;

export const USER_SESSION_ACTIONS = [
  'cabut_sesi_otomatis',
  'deteksi_token_reuse',
  'cabut_seluruh_sesi_admin'
] as const;

export const USER_ACCOUNT_ACTIONS = [
  'buat_akun',
  'setujui_akun',
  'tolak_akun',
  'ubah_status_akun',
  'ubah_akses_fitur',
  'reset_sandi',
  'hapus_akun'
] as const;

export const USER_ACTIVITY_ACTIONS = [
  ...USER_AUTH_ACTIONS,
  ...USER_SESSION_ACTIONS,
  ...USER_ACCOUNT_ACTIONS
] as const;

export type UserActivityCategory = 'auth' | 'session' | 'account';

export function getUserActivityCategory(aksi: string): UserActivityCategory {
  if ((USER_AUTH_ACTIONS as readonly string[]).includes(aksi)) return 'auth';
  if ((USER_SESSION_ACTIONS as readonly string[]).includes(aksi)) return 'session';
  return 'account';
}

export interface ActivityLogRow {
  id: string;
  id_aktivitas: string;
  aksi: string;
  pelaku_id: string;
  nama_pelaku?: string | null;
  username_pelaku?: string | null;
  role_pelaku?: string | null;
  actor_id?: string | null;
  actor_nama?: string | null;
  recorded_by_id?: string | null;
  recorded_by_nama?: string | null;
  is_on_behalf?: boolean | number;
  on_behalf_reason?: string | null;
  occurred_at?: string | null;
  recorded_at?: string | null;
  penyetuju_id?: string | null;
  nama_penyetuju?: string | null;
  request_id?: string | null;
  correction_of_id?: string | null;
  reference_type?: string | null;
  reference_number?: string | null;
  recipient_destination?: string | null;
  qty_total?: number;
  tipe_mutasi?: string | null;
  box_asal?: string | null;
  box_tujuan?: string | null;
  catatan?: string | null;
  waktu: string;
  total_items: number;
}

export interface ActivityDetailRow {
  id: number;
  transaksi_id: string;
  tipe_id?: number | null;
  item_id?: string | null;
  kode_id?: string | null;
  nama_snapshot: string;
  jumlah: number;
  status_sebelum?: string | null;
  status_sesudah?: string | null;
}

export interface CanonicalTransactionView {
  id: string;
  id_aktivitas: string;
  aksi: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'SYSTEM';
  tipe_mutasi: 'MASUK' | 'KELUAR' | 'TRANSFER' | 'SYSTEM';
  item_id: string;
  tipe_id?: number | null;
  item_name: string;
  item_sku: string;
  item_unit: string;
  nama_barang: string;
  sku: string;
  satuan: string;
  quantity: number;
  qty_total: number;
  reference_type: string;
  reference_number: string;
  recipient_destination: string;
  user_id: string;
  performed_by: string;
  pelaku_id: string;
  actor_id: string;
  actor_nama: string;
  recorded_by_id: string;
  recorded_by_nama: string;
  is_on_behalf: boolean;
  on_behalf_reason?: string | null;
  occurred_at: string;
  recorded_at: string;
  created_at: string;
  waktu: string;
  request_id?: string | null;
  correction_of_id?: string | null;
  box_asal?: string | null;
  box_tujuan?: string | null;
  notes?: string | null;
  catatan?: string | null;
  details: ActivityDetailRow[];
}

function inferTipeMutasi(aksi: string): 'MASUK' | 'KELUAR' | 'TRANSFER' | 'SYSTEM' {
  switch (aksi) {
    case 'tambah_item':
    case 'tambah_item_massal':
    case 'tambah_stok_jumlah':
    case 'restore_item':
    case 'saldo_awal':
    case 'kembali_alat':
    case 'kembalikan_request':
      return 'MASUK';
    case 'barang_keluar':
    case 'barang_keluar_jumlah':
    case 'barang_keluar_massal':
    case 'ambil_request':
      return 'KELUAR';
    case 'pindah_box':
      return 'TRANSFER';
    default:
      return 'SYSTEM';
  }
}

function mapMutasiToLegacyType(tipeMutasi: string, aksi: string): 'IN' | 'OUT' | 'TRANSFER' | 'SYSTEM' {
  const m = (tipeMutasi || inferTipeMutasi(aksi)).toUpperCase();
  if (m === 'MASUK') return 'IN';
  if (m === 'KELUAR') return 'OUT';
  if (m === 'TRANSFER') return 'TRANSFER';
  return 'SYSTEM';
}

export class ActivityLogService {
  /**
   * Menghasilkan ID Aktivitas unik format AKT-YYYYMMDD-NNNN berdasarkan tanggal kalender WIB
   */
  static async generateActivityId(): Promise<string> {
    const wibDate = getWibCompactDate(new Date());
    const prefix = `AKT-${wibDate}-`;

    const rows = await executeQuery<ActivityIdRow>(
      `SELECT id_aktivitas FROM transaksi
       WHERE id_aktivitas LIKE ?
       ORDER BY id_aktivitas DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextSeq = 1;
    if (rows && rows.length > 0 && rows[0].id_aktivitas) {
      const lastId = rows[0].id_aktivitas;
      const parts = lastId.split('-');
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  private static async resolveUserInfo(userId: string): Promise<UserNameRow | null> {
    if (!userId || userId === 'system' || userId === 'terminal' || userId === 'system_cron' || userId === 'api-system') {
      return { id: userId, name: userId === 'api-system' ? 'Integrasi Tiket' : userId };
    }
    const rows = await executeQuery<UserNameRow>('SELECT id, name, role FROM users WHERE id = ?', [userId]);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  /**
   * Mencatat aktivitas transaksi secara atomik (Append-Only) dengan UTC storage & attribution check
   */
  static async recordActivity(input: CreateActivityInput, conn?: DbTxConnection): Promise<{ transaksiId: string; idAktivitas: string; occurredAtIso: string }> {
    const recordedById = (input.recorded_by_id || input.pelaku_id || 'system').trim();
    const actorId = (input.actor_id || input.pelaku_id || recordedById).trim();
    const isOnBehalf = actorId !== recordedById;

    let recordedByRole = input.recorded_by_role || null;
    let recordedByName = input.recorded_by_nama || null;
    let actorName = input.actor_nama || null;

    if (!recordedByRole || !recordedByName) {
      const recUser = await this.resolveUserInfo(recordedById);
      if (recUser) {
        recordedByName = recordedByName || recUser.name;
        recordedByRole = recordedByRole || recUser.role || null;
      }
    }

    if (isOnBehalf) {
      if (recordedByRole && !canActOnBehalf(recordedByRole)) {
        throw new Error('Peran Anda tidak memiliki izin mencatat transaksi atas nama pengguna lain.');
      }
      if (!input.on_behalf_reason || input.on_behalf_reason.trim().length < 3) {
        throw new Error('Alasan pencatatan atas nama pengguna lain (on_behalf_reason) wajib diisi minimal 3 karakter.');
      }
    }

    if (!actorName) {
      if (actorId === recordedById && recordedByName) {
        actorName = recordedByName;
      } else {
        const actorUser = await this.resolveUserInfo(actorId);
        actorName = actorUser?.name || actorId;
      }
    }

    const timeCheck = validateOccurredAt({
      occurredAt: input.occurred_at,
      role: recordedByRole
    });
    if (!timeCheck.valid) {
      throw new Error(timeCheck.message || 'Waktu kejadian tidak valid.');
    }

    const nowUtcSql = toMysqlUtcDatetime(new Date());
    const waktuSql = toMysqlUtcSeconds(timeCheck.utcIso);
    const occurredSql = timeCheck.mysqlDatetimeUtc;
    const tipeMutasi = input.tipe_mutasi || inferTipeMutasi(input.aksi);
    const qtyTotal =
      typeof input.qty_total === 'number'
        ? input.qty_total
        : input.details && input.details.length > 0
          ? input.details.reduce((acc, d) => acc + (Number(d.jumlah) || 1), 0)
          : 0;

    const runner = async (c: DbTxConnection) => {
      const idAktivitas = await this.generateActivityId();
      const transaksiId = `tx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      await c.query(
        `INSERT INTO transaksi (
           id, id_aktivitas, aksi, pelaku_id, actor_id, actor_nama,
           recorded_by_id, recorded_by_nama, is_on_behalf, on_behalf_reason,
           penyetuju_id, request_id, correction_of_id, reference_type, reference_number,
           recipient_destination, qty_total, tipe_mutasi,
           box_asal, box_tujuan, catatan, waktu, occurred_at, recorded_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaksiId,
          idAktivitas,
          input.aksi,
          actorId,
          actorId,
          actorName,
          recordedById,
          recordedByName || recordedById,
          isOnBehalf ? 1 : 0,
          isOnBehalf ? input.on_behalf_reason!.trim() : null,
          input.penyetuju_id || null,
          input.request_id || null,
          input.correction_of_id || null,
          input.reference_type || input.aksi.toUpperCase(),
          input.reference_number || idAktivitas,
          input.recipient_destination || input.box_tujuan || input.box_asal || null,
          qtyTotal,
          tipeMutasi,
          input.box_asal || null,
          input.box_tujuan || null,
          input.catatan || null,
          waktuSql,
          occurredSql,
          nowUtcSql
        ]
      );

      if (input.details && input.details.length > 0) {
        for (const d of input.details) {
          await c.query(
            `INSERT INTO transaksi_detail (transaksi_id, tipe_id, item_id, kode_id, nama_snapshot, jumlah, status_sebelum, status_sesudah)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              transaksiId,
              d.tipe_id || null,
              d.item_id || null,
              d.kode_id || null,
              d.nama_snapshot,
              d.jumlah || 1,
              d.status_sebelum || null,
              d.status_sesudah || null
            ]
          );
        }
      }

      return { transaksiId, idAktivitas, occurredAtIso: timeCheck.utcIso };
    };

    if (conn) {
      return await runner(conn);
    }
    return await runTransaction(runner);
  }

  /**
   * Mengambil daftar log aktivitas mentah dengan filter
   */
  static async getLogs(filters: {
    search?: string;
    action?: string;
    actions?: readonly string[];
    excludeActions?: readonly string[];
    actorId?: string;
    requestId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ActivityLogRow[]> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    let sql = `
      SELECT t.id, t.id_aktivitas, t.aksi, t.pelaku_id,
             COALESCE(t.actor_id, t.pelaku_id) as actor_id,
             COALESCE(t.actor_nama, u.name, t.pelaku_id) as actor_nama,
             COALESCE(t.actor_nama, u.name, t.pelaku_id) as nama_pelaku,
             u.username as username_pelaku,
             u.role as role_pelaku,
             COALESCE(t.recorded_by_id, t.pelaku_id) as recorded_by_id,
             COALESCE(t.recorded_by_nama, ur.name, t.pelaku_id) as recorded_by_nama,
             t.is_on_behalf, t.on_behalf_reason,
             t.penyetuju_id, up.name as nama_penyetuju,
             t.request_id, t.correction_of_id,
             t.reference_type, t.reference_number, t.recipient_destination,
             t.qty_total, t.tipe_mutasi,
             t.box_asal, t.box_tujuan, t.catatan,
             COALESCE(t.occurred_at, t.waktu) as occurred_at,
             COALESCE(t.recorded_at, t.waktu) as recorded_at,
             COALESCE(t.occurred_at, t.waktu) as waktu,
             COUNT(td.id) as total_items
      FROM transaksi t
      LEFT JOIN users u ON COALESCE(t.actor_id, t.pelaku_id) = u.id
      LEFT JOIN users ur ON COALESCE(t.recorded_by_id, t.pelaku_id) = ur.id
      LEFT JOIN users up ON t.penyetuju_id = up.id
      LEFT JOIN transaksi_detail td ON t.id = td.transaksi_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.requestId) {
      sql += ' AND t.request_id = ?';
      params.push(filters.requestId);
    }

    if (filters.action) {
      sql += ' AND t.aksi = ?';
      params.push(filters.action);
    }

    if (filters.actions && filters.actions.length > 0) {
      const placeholders = filters.actions.map(() => '?').join(', ');
      sql += ` AND t.aksi IN (${placeholders})`;
      params.push(...filters.actions);
    }

    if (filters.excludeActions && filters.excludeActions.length > 0) {
      const placeholders = filters.excludeActions.map(() => '?').join(', ');
      sql += ` AND t.aksi NOT IN (${placeholders})`;
      params.push(...filters.excludeActions);
    }

    if (filters.search && filters.search.trim()) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      sql +=
        " AND (LOWER(t.id_aktivitas) LIKE ? OR LOWER(t.aksi) LIKE ? OR LOWER(COALESCE(t.catatan, '')) LIKE ? OR LOWER(COALESCE(t.actor_nama, u.name, '')) LIKE ? OR LOWER(COALESCE(u.username, '')) LIKE ?)";
      params.push(q, q, q, q, q);
    }

    if (filters.actorId) {
      sql += ' AND (t.pelaku_id = ? OR t.actor_id = ?)';
      params.push(filters.actorId, filters.actorId);
    }

    if (filters.dateFrom) {
      sql += ' AND COALESCE(t.occurred_at, t.waktu) >= ?';
      params.push(toMysqlUtcDatetime(filters.dateFrom));
    }

    if (filters.dateTo) {
      sql += ' AND COALESCE(t.occurred_at, t.waktu) <= ?';
      params.push(toMysqlUtcDatetime(filters.dateTo));
    }

    sql += ' GROUP BY t.id ORDER BY COALESCE(t.occurred_at, t.waktu) DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await executeQuery<ActivityLogRow>(sql, params);
  }

  /**
   * Mengambil detail barang dari suatu ID transaksi
   */
  static async getActivityDetails(transaksiId: string): Promise<ActivityDetailRow[]> {
    return await executeQuery<ActivityDetailRow>(
      `SELECT id, transaksi_id, tipe_id, item_id, kode_id, nama_snapshot, jumlah, status_sebelum, status_sesudah
       FROM transaksi_detail WHERE transaksi_id = ?`,
      [transaksiId]
    );
  }

  /**
   * Mengambil log aktivitas khusus pengguna (login, logout, sesi, & manajemen akun)
   * Terpisah dari Riwayat Barang Masuk & Barang Keluar.
   */
  static async getUserActivityLogs(filters?: {
    category?: 'all' | UserActivityCategory;
    actorId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<ActivityLogRow & { category: UserActivityCategory }>> {
    const category = filters?.category || 'all';
    let targetActions: readonly string[] = USER_ACTIVITY_ACTIONS;
    if (category === 'auth') targetActions = USER_AUTH_ACTIONS;
    else if (category === 'session') targetActions = USER_SESSION_ACTIONS;
    else if (category === 'account') targetActions = USER_ACCOUNT_ACTIONS;

    const safeLimit = Math.min(Math.max(Number(filters?.limit) || 100, 1), 500);
    const safeOffset = Math.max(Number(filters?.offset) || 0, 0);

    const rows = await this.getLogs({
      actions: targetActions,
      actorId: filters?.actorId,
      search: filters?.search,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
      limit: safeLimit,
      offset: safeOffset
    });

    return rows.map((row) => {
      const occurredIso = normalizeDbDateToIso(row.occurred_at || row.waktu) || new Date().toISOString();
      const recordedIso = normalizeDbDateToIso(row.recorded_at || row.waktu) || occurredIso;
      return {
        ...row,
        occurred_at: occurredIso,
        recorded_at: recordedIso,
        waktu: occurredIso,
        category: getUserActivityCategory(row.aksi)
      };
    });
  }

  /**
   * Unified Canonical Transaction Feed untuk Riwayat, Dashboard, dan Laporan
   * Secara default mengecualikan aktivitas otentikasi/sesi/manajemen akun user.
   */
  static async getTransactionsFeed(filters?: {
    type?: 'IN' | 'OUT' | 'TRANSFER' | 'SYSTEM';
    actorId?: string;
    requestId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit?: number;
    includeUserLogs?: boolean;
  }): Promise<CanonicalTransactionView[]> {
    const logs = await this.getLogs({
      actorId: filters?.actorId,
      requestId: filters?.requestId,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
      excludeActions: filters?.includeUserLogs ? undefined : USER_ACTIVITY_ACTIONS,
      limit: filters?.limit || 300
    });

    const result: CanonicalTransactionView[] = [];
    const searchLower = filters?.search ? filters.search.trim().toLowerCase() : '';

    for (const log of logs) {
      const details = await this.getActivityDetails(log.id);
      const tipeMutasi = (log.tipe_mutasi as any) || inferTipeMutasi(log.aksi);
      const txType = mapMutasiToLegacyType(tipeMutasi, log.aksi);

      if (filters?.type && txType !== filters.type) {
        continue;
      }

      const firstDetail = details[0];
      const totalDetailQty = details.reduce((acc, d) => acc + (Number(d.jumlah) || 1), 0);
      const quantity = Number(log.qty_total || totalDetailQty || 0);

      let itemName = firstDetail?.nama_snapshot || log.catatan || log.aksi;
      if (details.length > 1) {
        itemName = `${firstDetail.nama_snapshot} (+${details.length - 1} item)`;
      }
      const itemSku = firstDetail?.kode_id || (firstDetail?.tipe_id ? `TIPE-${firstDetail.tipe_id}` : log.id_aktivitas);

      let unit = 'unit';
      if (firstDetail?.tipe_id) {
        const tipeRows = await executeQuery<{ tipe_stok?: string }>(
          `SELECT p.tipe_stok FROM tipe t JOIN produk p ON t.produk_id = p.id WHERE t.id = ?`,
          [firstDetail.tipe_id]
        );
        if (tipeRows[0]?.tipe_stok) unit = tipeRows[0].tipe_stok;
      }

      const occurredIso = normalizeDbDateToIso(log.occurred_at || log.waktu) || new Date().toISOString();
      const recordedIso = normalizeDbDateToIso(log.recorded_at || log.waktu) || occurredIso;
      const actorId = log.actor_id || log.pelaku_id;
      const actorNama = log.actor_nama || log.nama_pelaku || actorId;
      const recordedById = log.recorded_by_id || log.pelaku_id;
      const recordedByNama = log.recorded_by_nama || recordedById;
      const isOnBehalf = Boolean(log.is_on_behalf) || actorId !== recordedById;

      const view: CanonicalTransactionView = {
        id: log.id,
        id_aktivitas: log.id_aktivitas,
        aksi: log.aksi,
        type: txType,
        tipe_mutasi: tipeMutasi,
        item_id: firstDetail?.item_id || (firstDetail?.tipe_id ? String(firstDetail.tipe_id) : log.id),
        tipe_id: firstDetail?.tipe_id || null,
        item_name: itemName,
        item_sku: itemSku,
        item_unit: unit,
        nama_barang: itemName,
        sku: itemSku,
        satuan: unit,
        quantity,
        qty_total: quantity,
        reference_type: log.reference_type || log.aksi.toUpperCase(),
        reference_number: log.reference_number || log.id_aktivitas,
        recipient_destination: log.recipient_destination || log.box_tujuan || log.box_asal || '-',
        user_id: actorId,
        performed_by: actorNama,
        pelaku_id: actorId,
        actor_id: actorId,
        actor_nama: actorNama,
        recorded_by_id: recordedById,
        recorded_by_nama: recordedByNama,
        is_on_behalf: isOnBehalf,
        on_behalf_reason: log.on_behalf_reason || null,
        occurred_at: occurredIso,
        recorded_at: recordedIso,
        created_at: occurredIso,
        waktu: occurredIso,
        request_id: log.request_id || null,
        correction_of_id: log.correction_of_id || null,
        box_asal: log.box_asal || null,
        box_tujuan: log.box_tujuan || null,
        notes: log.catatan || null,
        catatan: log.catatan || null,
        details
      };

      if (searchLower) {
        const hay = [
          view.id_aktivitas,
          view.item_name,
          view.item_sku,
          view.actor_nama,
          view.recorded_by_nama,
          view.reference_number,
          view.recipient_destination,
          view.notes || '',
          ...details.map(d => `${d.kode_id || ''} ${d.nama_snapshot}`)
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(searchLower)) continue;
      }

      result.push(view);
    }

    return result;
  }

  /**
   * Membuat entri koreksi eksplisit (immutable ledger — transaksi final tidak pernah di-edit/hapus)
   */
  static async createCorrectionEntry(input: {
    targetTransactionId: string;
    recordedById: string;
    recordedByName: string;
    recordedByRole: string;
    alasanKoreksi: string;
    occurredAt?: string | null;
  }): Promise<{ transaksiId: string; idAktivitas: string }> {
    if (!input.alasanKoreksi || input.alasanKoreksi.trim().length < 5) {
      throw new Error('Alasan koreksi wajib diisi minimal 5 karakter.');
    }

    const rows = await executeQuery<ActivityLogRow>(
      'SELECT * FROM transaksi WHERE id = ?',
      [input.targetTransactionId]
    );
    if (!rows || rows.length === 0) {
      throw new Error(`Transaksi "${input.targetTransactionId}" tidak ditemukan.`);
    }
    const target = rows[0];
    const targetDetails = await this.getActivityDetails(target.id);

    return await this.recordActivity({
      aksi: 'koreksi_transaksi',
      pelaku_id: input.recordedById,
      actor_id: target.actor_id || target.pelaku_id,
      actor_nama: target.actor_nama || target.nama_pelaku || undefined,
      recorded_by_id: input.recordedById,
      recorded_by_nama: input.recordedByName,
      recorded_by_role: input.recordedByRole,
      on_behalf_reason:
        (target.actor_id || target.pelaku_id) !== input.recordedById
          ? `Koreksi transaksi ${target.id_aktivitas}: ${input.alasanKoreksi.trim()}`
          : null,
      occurred_at: input.occurredAt || target.occurred_at || target.waktu,
      request_id: target.request_id || null,
      correction_of_id: target.id,
      reference_type: 'KOREKSI_AUDIT',
      reference_number: `KOR-${target.id_aktivitas}`,
      recipient_destination: target.recipient_destination || target.box_tujuan || target.box_asal || null,
      qty_total: 0,
      tipe_mutasi: 'SYSTEM',
      box_asal: target.box_asal || null,
      box_tujuan: target.box_tujuan || null,
      catatan: `Koreksi atas ${target.id_aktivitas}: ${input.alasanKoreksi.trim()}`,
      details: targetDetails.map(d => ({
        tipe_id: d.tipe_id || null,
        item_id: d.item_id || null,
        kode_id: d.kode_id || null,
        nama_snapshot: d.nama_snapshot,
        jumlah: d.jumlah,
        status_sebelum: d.status_sesudah || null,
        status_sesudah: d.status_sesudah || null
      }))
    });
  }
}
