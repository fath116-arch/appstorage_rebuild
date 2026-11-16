/**
 * Ticket Integration Router (Auto-Deduct Stock Webhook API — Canonical Catalog)
 * FieldOps IT — Single Unified Model
 */

import express from 'express';
import crypto from 'crypto';
import { executeQuery, runTransaction } from '../db/database';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';
import { ActivityLogService } from '../services/activityLogService';
import { StockService } from '../services/stockService';
import { getErrorMessage } from '../utils/errorUtils';

interface ApiKeyRecord {
  id: string;
  name: string;
  api_key_hash: string;
  system_name: string;
  is_active: boolean | number;
}

const router = express.Router();

async function authenticateApiKey(req: express.Request): Promise<{ valid: boolean; keyRecord?: ApiKeyRecord; error?: string }> {
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-app-api-key'];
  const authHeader = req.headers['authorization'];
  const bearerKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const rawKey = (apiKeyHeader || bearerKey) as string;

  if (!rawKey) {
    return { valid: false, error: 'API Key wajib disertakan pada header X-API-Key atau Bearer Token.' };
  }

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const rows = await executeQuery<ApiKeyRecord>(
    'SELECT * FROM api_keys WHERE api_key_hash = ? AND is_active = TRUE',
    [keyHash]
  );

  if (rows.length === 0) {
    const demoRows = await executeQuery<ApiKeyRecord>('SELECT * FROM api_keys WHERE is_active = TRUE');
    const matched = demoRows.find(k => k.api_key_hash === rawKey || k.api_key_hash === keyHash);
    if (matched) {
      return { valid: true, keyRecord: matched };
    }
    return { valid: false, error: 'API Key tidak valid atau telah dinonaktifkan.' };
  }

  return { valid: true, keyRecord: rows[0] };
}

/**
 * POST /api/tickets/consume
 * Webhook resmi auto-deduct suku cadang oleh sistem tiket eksternal (Jira, GLPI, Zendesk)
 * Menggunakan katalog & stok kanonis (item fisik atau stok_jumlah).
 */
router.post('/consume', async (req: express.Request, res: express.Response) => {
  try {
    const authRes = await authenticateApiKey(req);
    if (!authRes.valid) {
      return res.status(401).json({ success: false, message: authRes.error });
    }

    const { ticketId, ticketTitle, systemName, technicianName, items: requestedItems } = req.body;

    if (!ticketId || !ticketTitle || !requestedItems || !Array.isArray(requestedItems) || requestedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Payload tidak lengkap. Wajib menyertakan ticketId, ticketTitle, dan array items [{ sku, quantity }].'
      });
    }

    const result = await runTransaction(async (conn) => {
      const processed: Array<{
        sku: string;
        name: string;
        deductedQty: number;
        remainingQty: number;
        unit: string;
        status: string;
      }> = [];
      const lowStockAlerts: string[] = [];

      for (const reqIt of requestedItems) {
        const sku = String(reqIt.sku || reqIt.kode_id || '').trim();
        const qty = parseInt(String(reqIt.quantity || 1), 10);

        if (!sku || !qty || qty <= 0) {
          throw new Error(`Item ${JSON.stringify(reqIt)} tidak valid. SKU/Kode dan kuantitas (> 0) wajib diisi.`);
        }

        // 1. Cek jika cocok langsung ke kode_id item fisik
        const itemDup = await StockService.checkDuplicateKodeId(sku);
        if (itemDup.exists && itemDup.item) {
          if (itemDup.item.status !== 'aktif' || itemDup.item.kondisi === 'Rusak') {
            throw new Error(`Item "${sku}" tidak tersedia (${itemDup.item.status} / ${itemDup.item.kondisi || 'Baik'}).`);
          }
          await conn.query('UPDATE item SET status = "keluar" WHERE id = ?', [itemDup.item.id]);
          const remaining = Math.max(0, (await StockService.getStock(itemDup.item.tipe_id)) - 1);

          await ActivityLogService.recordActivity({
            aksi: 'barang_keluar',
            pelaku_id: 'api-system',
            actor_id: 'api-system',
            actor_nama: technicianName || 'Teknisi Tiket',
            recorded_by_id: 'api-system',
            recorded_by_nama: systemName || 'Sistem Tiket',
            tipe_mutasi: 'KELUAR',
            reference_type: 'EXTERNAL_TICKET',
            reference_number: ticketId,
            recipient_destination: technicianName || 'Teknisi Lapangan Tiket',
            box_asal: itemDup.item.kode_box,
            qty_total: 1,
            catatan: `${systemName || 'Sistem Tiket'}: ${ticketTitle}`,
            details: [
              {
                tipe_id: itemDup.item.tipe_id,
                item_id: itemDup.item.id,
                kode_id: itemDup.item.kode_id,
                nama_snapshot: `${itemDup.item.nama_produk} - ${itemDup.item.nama_tipe}`,
                jumlah: 1,
                status_sebelum: 'aktif',
                status_sesudah: 'keluar'
              }
            ]
          }, conn);

          processed.push({
            sku: itemDup.item.kode_id,
            name: `${itemDup.item.nama_produk} - ${itemDup.item.nama_tipe}`,
            deductedQty: 1,
            remainingQty: remaining,
            unit: 'unit',
            status: remaining === 0 ? 'OUT_OF_STOCK' : remaining <= 3 ? 'LOW_STOCK' : 'NORMAL'
          });
          if (remaining <= 3) lowStockAlerts.push(`${itemDup.item.nama_produk} - ${itemDup.item.nama_tipe}`);
          continue;
        }

        // 2. Cocokkan ke tipe berdasarkan prefix_id, nama_tipe, atau TIPE-<id>
        const tipeRows = await executeQuery<{ id: number; nama_tipe: string; prefix_id?: string; produk_nama?: string; tipe_stok?: string }>(
          `SELECT t.id, t.nama_tipe, t.prefix_id, p.nama as produk_nama, p.tipe_stok
           FROM tipe t
           JOIN produk p ON t.produk_id = p.id
           WHERE t.aktif = 1 AND p.aktif = 1
             AND (UPPER(t.prefix_id) = UPPER(?) OR UPPER(t.nama_tipe) = UPPER(?) OR CONCAT('TIPE-', t.id) = UPPER(?) OR UPPER(p.nama) = UPPER(?))
           LIMIT 1`,
          [sku, sku, sku, sku]
        );

        const matchedTipe = tipeRows[0];
        if (!matchedTipe) {
          throw new Error(`SKU / Tipe "${sku}" tidak ditemukan di master katalog.`);
        }

        const tipeItems = await StockService.getItemsByTipe(matchedTipe.id, { excludeRusak: true });
        const totalAvail = await StockService.getStock(matchedTipe.id);
        if (totalAvail < qty) {
          throw new Error(`Stok "${matchedTipe.produk_nama} - ${matchedTipe.nama_tipe}" (${sku}) tidak mencukupi! Tersedia: ${totalAvail}, Diminta: ${qty}.`);
        }

        // Potong dari stok_jumlah atau item aktif
        if (tipeItems.stokJumlah.length > 0) {
          let remainingToDeduct = qty;
          for (const sj of tipeItems.stokJumlah) {
            if (remainingToDeduct <= 0) break;
            const availBox = Math.max(0, sj.jumlah - (sj.reserved_qty || 0));
            if (availBox <= 0) continue;
            const take = Math.min(availBox, remainingToDeduct);
            await conn.query(
              'UPDATE stok_jumlah SET jumlah = jumlah - ? WHERE tipe_id = ? AND box_id = ?',
              [take, matchedTipe.id, sj.box_id]
            );
            remainingToDeduct -= take;
          }
        } else {
          const toPick = tipeItems.items.slice(0, qty);
          for (const it of toPick) {
            await conn.query('UPDATE item SET status = "keluar" WHERE id = ?', [it.id]);
          }
        }

        const nextStock = Math.max(0, totalAvail - qty);
        await ActivityLogService.recordActivity({
          aksi: 'barang_keluar',
          pelaku_id: 'api-system',
          actor_id: 'api-system',
          actor_nama: technicianName || 'Teknisi Tiket',
          recorded_by_id: 'api-system',
          recorded_by_nama: systemName || 'Sistem Tiket',
          tipe_mutasi: 'KELUAR',
          reference_type: 'EXTERNAL_TICKET',
          reference_number: ticketId,
          recipient_destination: technicianName || 'Teknisi Lapangan Tiket',
          qty_total: qty,
          catatan: `${systemName || 'Sistem Tiket'}: ${ticketTitle}`,
          details: [
            {
              tipe_id: matchedTipe.id,
              item_id: null,
              kode_id: matchedTipe.prefix_id || `TIPE-${matchedTipe.id}`,
              nama_snapshot: `${matchedTipe.produk_nama} - ${matchedTipe.nama_tipe}`,
              jumlah: qty,
              status_sebelum: 'aktif',
              status_sesudah: 'keluar'
            }
          ]
        }, conn);

        processed.push({
          sku,
          name: `${matchedTipe.produk_nama} - ${matchedTipe.nama_tipe}`,
          deductedQty: qty,
          remainingQty: nextStock,
          unit: matchedTipe.tipe_stok || 'unit',
          status: nextStock === 0 ? 'OUT_OF_STOCK' : nextStock <= 3 ? 'LOW_STOCK' : 'NORMAL'
        });

        if (nextStock <= 3) {
          lowStockAlerts.push(`${matchedTipe.produk_nama} - ${matchedTipe.nama_tipe}`);
        }
      }

      if (authRes.keyRecord?.id) {
        await conn.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [authRes.keyRecord.id]);
      }

      return {
        success: true,
        message: `Pemotongan stok otomatis untuk tiket "${ticketId}" berhasil diproses.`,
        ticketId,
        systemName: systemName || authRes.keyRecord?.system_name || 'Helpdesk',
        technicianName,
        processedItems: processed,
        lowStockAlerts
      };
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    return res.status(400).json({
      success: false,
      message: getErrorMessage(err, 'Gagal memproses pemotongan stok tiket.')
    });
  }
});

// GET /api/tickets/keys
router.get('/keys', requireAuth, requireRole(['developer', 'admin']), async (_req, res) => {
  try {
    const keys = await executeQuery<Omit<ApiKeyRecord, 'api_key_hash'>>(
      'SELECT id, name, system_name, is_active, created_at, last_used_at FROM api_keys ORDER BY created_at DESC'
    );
    res.json({ success: true, keys });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// POST /api/tickets/keys
router.post('/keys', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, systemName } = req.body;
    if (!name || !systemName) {
      return res.status(400).json({ success: false, message: 'Nama dan Nama Sistem wajib diisi.' });
    }

    const rawKey = `fops_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyId = `key-${Date.now()}`;

    await executeQuery(
      `INSERT INTO api_keys (id, name, api_key_hash, system_name, allowed_actions, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [keyId, name, keyHash, systemName, JSON.stringify(['tickets.consume', 'inventory.read'])]
    );

    res.status(201).json({
      success: true,
      message: 'API Key berhasil digenerate. Harap simpan key ini sekarang, karena tidak akan ditampilkan kembali.',
      apiKey: rawKey,
      keyId,
      name,
      systemName
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

export default router;
