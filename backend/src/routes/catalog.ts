/**
 * Catalog Router (Jenis, Atribut, Produk, Tipe)
 * FieldOps Inventory v2 - Tahap 2: Katalog Bertingkat
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireFeature } from '../middleware/authMiddleware';
import { CatalogService } from '../services/catalogService';
import { ConfirmationService } from '../services/confirmationService';

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
  requireFeature('catalog_manage'),
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
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const { nama, sumber_id_bawaan, prefix_id_bawaan } = req.body;
      if (!nama || String(nama).trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi.' });
      }

      const updated = await CatalogService.updateJenis(
        id,
        { nama, sumber_id_bawaan, prefix_id_bawaan },
        req.user!.id
      );

      return res.json({ success: true, message: 'Kategori berhasil diperbarui.', jenis: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/jenis/bulk',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = Array.from(new Set(rawIds.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n) && n > 0))) as number[];
      const preCheck = await CatalogService.canDeleteJenisBulk(ids);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Kategori terpilih tidak dapat dihapus.' });
      }

      const targetId = `bulk:${ids.map(String).sort().join(',')}`;
      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_kind',
        targetId
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_kind',
          targetId
        });
      }

      const result = await CatalogService.deleteJenisBulk(ids, req.user!.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/jenis/:id',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const preCheck = await CatalogService.canDeleteJenis(id);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Kategori tidak dapat dihapus.' });
      }

      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_kind',
        String(id)
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_kind',
          targetId: String(id)
        });
      }

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
  requireFeature('catalog_manage'),
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

router.put(
  '/attributes/:id',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const { kode, nama, tipe_isian, satuan, wajib, urutan, masuk_nama, opsi } = req.body;
      if (!kode || !nama) {
        return res.status(400).json({ success: false, message: 'Kode dan nama atribut wajib diisi.' });
      }

      const updated = await CatalogService.updateAtribut(
        id,
        { kode, nama, tipe_isian, satuan, wajib, urutan, masuk_nama, opsi },
        req.user!.id
      );
      return res.json({ success: true, message: 'Atribut berhasil diperbarui.', atribut: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/attributes/bulk',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = Array.from(new Set(rawIds.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n) && n > 0))) as number[];
      const preCheck = await CatalogService.canDeleteAtributBulk(ids);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Atribut terpilih tidak dapat dihapus.' });
      }

      const targetId = `bulk:${ids.map(String).sort().join(',')}`;
      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_attribute',
        targetId
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_attribute',
          targetId
        });
      }

      const result = await CatalogService.deleteAtributBulk(ids, req.user!.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/attributes/:id',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const preCheck = await CatalogService.canDeleteAtribut(id);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Atribut tidak dapat dihapus.' });
      }

      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_attribute',
        String(id)
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_attribute',
          targetId: String(id)
        });
      }

      const result = await CatalogService.deleteAtribut(id, req.user!.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/attributes/:id/options',
  requireAuth,
  requireFeature('catalog_manage'),
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

router.get('/tipe-stok-suggestions', requireAuth, async (_req, res) => {
  try {
    const suggestions = await CatalogService.getTipeStokSuggestions();
    return res.json({ success: true, suggestions });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/products', requireAuth, async (req, res) => {
  try {
    const { jenis_id, kategori_id, kategori, kategori_barang, search, status } = req.query;
    const prods = await CatalogService.listProdukWithFullDetails({
      jenis_id: jenis_id || kategori_id ? parseInt(String(jenis_id || kategori_id), 10) : undefined,
      kategori: kategori as string,
      kategori_barang: kategori_barang as string,
      search: search as string,
      status: status as string
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
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { jenis_id, nama, kategori, kategori_barang, tipe_stok, catatan, stok_awal } = req.body;
      if (!jenis_id || !nama) {
        return res.status(400).json({ success: false, message: 'Jenis dan nama produk wajib diisi.' });
      }

      const created = await CatalogService.createProduk(
        {
          jenis_id: parseInt(String(jenis_id), 10),
          nama,
          kategori: kategori === 'recycle' ? 'recycle' : 'fast_moving',
          kategori_barang: kategori_barang === 'Alat' ? 'Alat' : 'Barang Habis Pakai',
          tipe_stok: tipe_stok ? String(tipe_stok) : 'unit',
          catatan,
          stok_awal: stok_awal ? parseInt(String(stok_awal), 10) : 0
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
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const { nama, kategori, kategori_barang, tipe_stok, catatan } = req.body;

      const updated = await CatalogService.updateProduk(
        id,
        {
          nama,
          kategori: kategori === 'recycle' ? 'recycle' : 'fast_moving',
          kategori_barang: kategori_barang === 'Alat' ? 'Alat' : 'Barang Habis Pakai',
          tipe_stok: tipe_stok ? String(tipe_stok) : 'unit',
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
  '/products/bulk',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = Array.from(new Set(rawIds.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n) && n > 0))) as number[];
      const preCheck = await CatalogService.canDeleteProdukBulk(ids);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Produk terpilih tidak dapat dihapus.' });
      }

      const targetId = `bulk:${ids.map(String).sort().join(',')}`;
      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_product',
        targetId
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_product',
          targetId
        });
      }

      const result = await CatalogService.deleteProdukBulk(ids, req.user!.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/products/:id',
  requireAuth,
  requireFeature('catalog_manage'),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const preCheck = await CatalogService.canDeleteProduk(id);
      if (!preCheck.canDelete) {
        return res.status(400).json({ success: false, message: preCheck.message || 'Produk tidak dapat dihapus.' });
      }

      const confirmationToken = (req.headers['x-confirmation-token'] as string) || req.body?.confirmation_token;
      const validation = await ConfirmationService.consumeConfirmationToken(
        confirmationToken,
        req.user!.id,
        'delete_product',
        String(id)
      );
      if (!validation.valid) {
        return res.status(403).json({
          success: false,
          message: validation.message,
          requiresConfirmation: true,
          actionType: 'delete_product',
          targetId: String(id)
        });
      }

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
  requireFeature('catalog_manage'),
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
  requireFeature('catalog_manage'),
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
