/**
 * Catalog Router (Jenis, Atribut, Produk, Tipe)
 * FieldOps Inventory v2 - Tahap 2: Katalog Bertingkat
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireRole, requireConfirmation } from '../middleware/authMiddleware';
import { CatalogService } from '../services/catalogService';

const router = express.Router();

// ============================================================================
// JENIS (Golongan Besar)
// ============================================================================

router.get('/jenis', requireAuth, async (_req, res) => {
  try {
    const list = await CatalogService.listJenis();
    return res.json({ success: true, jenis: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/jenis/:id', requireAuth, async (req, res) => {
  try {
    const item = await CatalogService.getJenisById(parseInt(String(req.params.id), 10));
    if (!item) return res.status(404).json({ success: false, message: 'Jenis tidak ditemukan.' });
    return res.json({ success: true, jenis: item });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/jenis',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { nama, sumber_id_bawaan, prefix_id_bawaan, atributs } = req.body;
      if (!nama || String(nama).trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Nama Jenis wajib diisi.' });
      }

      const created = await CatalogService.createJenis(
        { nama, sumber_id_bawaan, prefix_id_bawaan, atributs },
        req.user!.id
      );

      return res.status(201).json({ success: true, message: 'Jenis berhasil dibuat.', jenis: created });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.put(
  '/jenis/:id',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const { nama, sumber_id_bawaan, prefix_id_bawaan } = req.body;

      const updated = await CatalogService.updateJenis(
        id,
        { nama, sumber_id_bawaan, prefix_id_bawaan },
        req.user!.id
      );

      return res.json({ success: true, message: 'Jenis berhasil diperbarui.', jenis: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/jenis/:id',
  requireAuth,
  requireRole(['developer', 'admin']),
  requireConfirmation('delete_kind', req => String(req.params.id)),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const result = await CatalogService.deleteJenis(id, req.user!.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ============================================================================
// ATRIBUT
// ============================================================================

router.get('/jenis/:id/attributes', requireAuth, async (req, res) => {
  try {
    const jenisId = parseInt(String(req.params.id), 10);
    const atributs = await CatalogService.listAtributByJenis(jenisId);
    return res.json({ success: true, atributs });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/attributes',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req, res) => {
    try {
      const { jenis_id, kode, nama, tipe_isian, satuan, wajib, urutan, masuk_nama, opsi } = req.body;
      if (!jenis_id || !kode || !nama || !tipe_isian) {
        return res.status(400).json({ success: false, message: 'Parameter atribut belum lengkap.' });
      }

      const created = await CatalogService.createAtribut({
        jenis_id: parseInt(String(jenis_id), 10),
        kode,
        nama,
        tipe_isian,
        satuan,
        wajib,
        urutan,
        masuk_nama,
        opsi
      });

      return res.status(201).json({ success: true, message: 'Atribut berhasil ditambahkan.', atribut: created });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/attributes/:id/options',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req, res) => {
    try {
      const atributId = parseInt(String(req.params.id), 10);
      const { nilai } = req.body;
      if (!nilai || String(nilai).trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Nilai opsi tidak boleh kosong.' });
      }

      const option = await CatalogService.addAtributOpsi(atributId, String(nilai).trim());
      return res.status(201).json({ success: true, option });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ============================================================================
// PRODUK
// ============================================================================

router.get('/products', requireAuth, async (req, res) => {
  try {
    const { jenis_id, kategori, search } = req.query;
    const prods = await CatalogService.listProduk({
      jenis_id: jenis_id ? parseInt(String(jenis_id), 10) : undefined,
      kategori: kategori as string,
      search: search as string
    });
    return res.json({ success: true, products: prods });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/products/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const prod = await CatalogService.getProdukById(id);
    if (!prod) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    return res.json({ success: true, product: prod });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/products',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { jenis_id, nama, kategori, catatan } = req.body;
      if (!jenis_id || !nama) {
        return res.status(400).json({ success: false, message: 'Jenis dan nama produk wajib diisi.' });
      }

      const created = await CatalogService.createProduk(
        {
          jenis_id: parseInt(String(jenis_id), 10),
          nama,
          kategori: kategori === 'recycle' ? 'recycle' : 'fast_moving',
          catatan
        },
        req.user!.id
      );

      return res.status(201).json({ success: true, message: 'Produk berhasil dibuat.', product: created });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.put(
  '/products/:id',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const { nama, kategori, catatan } = req.body;

      const updated = await CatalogService.updateProduk(
        id,
        {
          nama,
          kategori: kategori === 'recycle' ? 'recycle' : 'fast_moving',
          catatan
        },
        req.user!.id
      );

      return res.json({ success: true, message: 'Produk berhasil diperbarui.', product: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/products/:id',
  requireAuth,
  requireRole(['developer', 'admin']),
  requireConfirmation('delete_product', req => String(req.params.id)),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const result = await CatalogService.deleteProduk(id, req.user!.id);
      if (!result.success) return res.status(400).json(result);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ============================================================================
// TIPE (Varian Produk & Otomatisasi Nama Tipe)
// ============================================================================

router.get('/products/:id/types', requireAuth, async (req, res) => {
  try {
    const prodId = parseInt(String(req.params.id), 10);
    const types = await CatalogService.listTipeByProduk(prodId);
    return res.json({ success: true, types });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post(
  '/types',
  requireAuth,
  requireRole(['developer', 'admin', 'warehouse_admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { produk_id, catatan, sumber_id, prefix_id, pola_id, nilai_atribut } = req.body;
      if (!produk_id || !nilai_atribut || !Array.isArray(nilai_atribut)) {
        return res.status(400).json({ success: false, message: 'produk_id dan nilai_atribut wajib disertakan.' });
      }

      const created = await CatalogService.createTipe(
        {
          produk_id: parseInt(String(produk_id), 10),
          catatan,
          sumber_id,
          prefix_id,
          pola_id,
          nilai_atribut
        },
        req.user!.id
      );

      return res.status(201).json({ success: true, message: 'Tipe berhasil ditambahkan.', type: created });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.put(
  '/types/:id/id-rule',
  requireAuth,
  requireRole(['developer', 'admin']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const tipeId = parseInt(String(req.params.id), 10);
      const { sumber_id, prefix_id, pola_id, alasan, confirmation_token } = req.body;

      if (!alasan || String(alasan).trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Alasan koreksi ID wajib diisi.' });
      }

      const tipe = await CatalogService.getTipeById(tipeId);
      if (!tipe) return res.status(404).json({ success: false, message: 'Tipe tidak ditemukan.' });

      // Jika id_dikunci = 1, wajibkan token konfirmasi tingkat 3!
      if (tipe.id_dikunci) {
        const { ConfirmationService } = await import('../services/confirmationService');
        const validation = await ConfirmationService.consumeConfirmationToken(
          confirmation_token,
          req.user!.id,
          'change_id_rule',
          String(tipeId)
        );
        if (!validation.valid) {
          return res.status(403).json({
            success: false,
            message: `Aturan ID tipe ini sudah dikunci karena sudah pernah ada stok masuk. ${validation.message}`,
            requiresConfirmation: true,
            actionType: 'change_id_rule',
            targetId: String(tipeId)
          });
        }
      }

      const updated = await CatalogService.updateAturanId(
        tipeId,
        { sumber_id, prefix_id, pola_id, alasan },
        req.user!.id
      );

      return res.json({ success: true, message: 'Aturan ID tipe berhasil diperbarui.', type: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ============================================================================
// LABELS (Tahap 7: Label Batch & Cetak A4 Presisi)
// ============================================================================

router.get('/labels', requireAuth, async (req, res) => {
  try {
    const jenisId = req.query.jenis_id ? parseInt(String(req.query.jenis_id), 10) : undefined;
    const labels = await CatalogService.getLabelData({ jenis_id: jenisId });
    return res.json({ success: true, labels });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
