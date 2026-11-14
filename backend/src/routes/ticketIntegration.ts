/**
 * Ticket Integration Router (Auto-Deduct Stock Webhook API)
 * FieldOps IT Inventory Rebuild - MariaDB 11.x
 */

import express from 'express';
import crypto from 'crypto';
import { executeQuery, runTransaction } from '../db/database';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/authMiddleware';
import { ItemRecord } from '../repositories/inventoryRepository';
import { TransactionService } from '../services/transactionService';
import { getErrorMessage } from '../utils/errorUtils';

interface ApiKeyRecord {
  id: string;
  name: string;
  api_key_hash: string;
  system_name: string;
  is_active: boolean | number;
}

const router = express.Router();

/**
 * Helper untuk verifikasi API Key eksternal (Jira / GLPI / Webhook)
 */
async function authenticateApiKey(req: express.Request): Promise<{ valid: boolean; keyRecord?: ApiKeyRecord; error?: string }> {
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-app-api-key'];
  const authHeader = req.headers['authorization'];
  const bearerKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const rawKey = (apiKeyHeader || bearerKey) as string;

  if (!rawKey) {
    return { valid: false, error: 'API Key wajib disertakan pada header X-API-Key atau Bearer Token.' };
  }

  // Hash key untuk dicocokkan dengan database
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const rows = await executeQuery<ApiKeyRecord>(
    'SELECT * FROM api_keys WHERE api_key_hash = ? AND is_active = TRUE',
    [keyHash]
  );

  if (rows.length === 0) {
    // Juga dukung demo key hash awal untuk integrasi
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
 */
router.post('/consume', async (req: express.Request, res: express.Response) => {
  try {
    // 1. Verifikasi API Key
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

    // 2. Transaksi Atomik Pemotongan Stok
    const result = await runTransaction(async (conn) => {
      const resolvedItems: Array<{ item: ItemRecord; requestedQty: number }> = [];

      // Validasi semua SKU dan ketersediaan stok
      for (const reqIt of requestedItems) {
        const sku = String(reqIt.sku || '').trim().toUpperCase();
        const qty = parseInt(String(reqIt.quantity), 10);

        if (!sku || !qty || qty <= 0) {
          throw new Error(`Item ${JSON.stringify(reqIt)} tidak valid. SKU dan kuantitas (> 0) wajib diisi.`);
        }

        const rows = (await conn.query('SELECT * FROM items WHERE sku = ? AND is_deleted = FALSE', [sku])) as ItemRecord[];
        const it = rows[0];

        if (!it) {
          throw new Error(`SKU "${sku}" tidak ditemukan di master inventori.`);
        }

        if (it.quantity < qty) {
          throw new Error(`Stok "${it.name}" (${sku}) tidak mencukupi! Tersedia: ${it.quantity} ${it.unit}, Diminta: ${qty} ${it.unit}.`);
        }

        resolvedItems.push({ item: it, requestedQty: qty });
      }

      // Potong stok dan catat mutasi jika semua item lolos validasi
      const processed: Array<{
        sku: string;
        name: string;
        deductedQty: number;
        remainingQty: number;
        unit: string;
        status: string;
      }> = [];
      const lowStockAlerts: string[] = [];

      for (const pair of resolvedItems) {
        const prev = pair.item.quantity;
        const next = prev - pair.requestedQty;
        const updated = await TransactionService.syncLegacyItemStock(conn, pair.item, next);

        await TransactionService.recordStockTransaction({
          type: 'OUT',
          tipe_mutasi: 'KELUAR',
          itemId: pair.item.id,
          namaBarang: pair.item.name,
          sku: pair.item.sku,
          satuan: pair.item.unit,
          quantity: pair.requestedQty,
          previousQty: prev,
          newQty: next,
          referenceType: 'EXTERNAL_TICKET',
          referenceNumber: ticketId,
          recipientOrDestination: technicianName || 'Teknisi Lapangan Tiket',
          userId: 'api-system',
          performedBy: systemName || 'Sistem Tiket',
          notes: `${systemName || 'Sistem Tiket'}: ${ticketTitle}`
        }, conn);

        processed.push({
          sku: pair.item.sku,
          name: pair.item.name,
          deductedQty: pair.requestedQty,
          remainingQty: next,
          unit: pair.item.unit,
          status: updated.status
        });

        if (next <= pair.item.min_stock_alert) {
          lowStockAlerts.push(pair.item.name);
        }
      }

      // Perbarui last_used_at API Key
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

// GET /api/tickets/keys (Manajemen API Key - Setting API)
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

// POST /api/tickets/keys (Generate API Key Baru - Setting API)
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
