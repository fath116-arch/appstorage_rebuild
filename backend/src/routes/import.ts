/**
 * Catalog & Initial Stock Import Router
 * FieldOps IT v1.2.8
 */

import express from 'express';
import { AuthenticatedRequest, requireAuth, requireFeature } from '../middleware/authMiddleware';
import { ImportService } from '../services/importService';

const router = express.Router();

router.get(
  '/template',
  requireAuth,
  requireFeature('catalog_import'),
  async (_req, res) => {
    try {
      const buffer = await ImportService.generateTemplateBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Template_Impor_Katalog_FieldOps.xlsx"'
      );
      return res.send(buffer);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/preview',
  requireAuth,
  requireFeature('catalog_import'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { sourceType, fileBase64, fileName, googleSheetUrl, conflictMode } = req.body;
      const preview = await ImportService.previewImport({
        sourceType: sourceType === 'google_sheet' ? 'google_sheet' : 'file',
        fileBase64,
        fileName,
        googleSheetUrl,
        conflictMode
      });
      return res.json({ success: true, preview });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

router.post(
  '/commit',
  requireAuth,
  requireFeature('catalog_import'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rows, conflictMode, sourceLabel } = req.body;
      const result = await ImportService.commitImport({
        rows,
        conflictMode,
        sourceLabel,
        userId: req.user!.id,
        userName: req.user!.name
      });
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

export default router;
