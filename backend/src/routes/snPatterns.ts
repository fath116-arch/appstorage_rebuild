/**
 * SN Patterns Router (FieldOps Inventory v1.2.5 UPDATE 2)
 * CRUD Endpoints for Serial Number Patterns & Normalization Rules
 * Access Restricted to Developer and Admin Roles for Mutations
 */

import express from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { executeQuery } from '../db/database';

const router = express.Router();

export interface SNPatternRecord {
  id: string;
  nama: string;
  pola_sederhana: string;
  contoh_sn: string;
  pola_regex: string;
  is_advanced: boolean;
  aktif: boolean;
  auto_uppercase: boolean;
  strip_spaces: boolean;
  strip_prefixes: boolean;
  dibuat_pada: string;
  diperbarui_pada: string;
}

const DEFAULT_PATTERNS: SNPatternRecord[] = [
  {
    id: 'pat-tplink',
    nama: 'TP-Link Router (EN020-F5)',
    pola_sederhana: '#############',
    contoh_sn: '3213067005147',
    pola_regex: '^[0-9]{13}$',
    is_advanced: false,
    aktif: true,
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true,
    dibuat_pada: new Date().toISOString(),
    diperbarui_pada: new Date().toISOString()
  },
  {
    id: 'pat-fiberhome',
    nama: 'FiberHome ONU / Modem',
    pola_sederhana: 'FHTT########',
    contoh_sn: 'FHTT12345678',
    pola_regex: '^FHTT[0-9A-Z]{8}$',
    is_advanced: false,
    aktif: true,
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true,
    dibuat_pada: new Date().toISOString(),
    diperbarui_pada: new Date().toISOString()
  },
  {
    id: 'pat-zte',
    nama: 'ZTE Router / ONU',
    pola_sederhana: 'ZTEG########',
    contoh_sn: 'ZTEG12345678',
    pola_regex: '^ZTEG[0-9A-Z]{8}$',
    is_advanced: false,
    aktif: true,
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true,
    dibuat_pada: new Date().toISOString(),
    diperbarui_pada: new Date().toISOString()
  },
  {
    id: 'pat-huawei',
    nama: 'Huawei ONU / Router',
    pola_sederhana: '48575443########',
    contoh_sn: '4857544312345678',
    pola_regex: '^48575443[0-9A-Z]{8}$',
    is_advanced: false,
    aktif: true,
    auto_uppercase: true,
    strip_spaces: true,
    strip_prefixes: true,
    dibuat_pada: new Date().toISOString(),
    diperbarui_pada: new Date().toISOString()
  }
];

// Helper: Membaca seluruh pola dari DB / Memory Store
async function getPatternsFromDb(): Promise<SNPatternRecord[]> {
  try {
    const rows = await executeQuery<any>('SELECT nilai FROM pengaturan WHERE kunci = ?', ['SN_PATTERNS']);
    if (rows && rows.length > 0 && rows[0].nilai) {
      return JSON.parse(rows[0].nilai);
    }
  } catch {}

  return DEFAULT_PATTERNS;
}

// Helper: Menyimpan seluruh pola ke DB / Memory Store
async function savePatternsToDb(patterns: SNPatternRecord[]): Promise<void> {
  const jsonStr = JSON.stringify(patterns);
  const rows = await executeQuery<any>('SELECT nilai FROM pengaturan WHERE kunci = ?', ['SN_PATTERNS']);
  if (rows && rows.length > 0) {
    await executeQuery('UPDATE pengaturan SET nilai = ?, diperbarui_pada = NOW() WHERE kunci = ?', [jsonStr, 'SN_PATTERNS']);
  } else {
    await executeQuery('INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES (?, ?, ?)', [
      'SN_PATTERNS',
      jsonStr,
      'Konfigurasi Pola Serial Number & Aturan Normalisasi Barcode'
    ]);
  }
}

/**
 * GET /api/sn-patterns
 * Membaca daftar pola SN aktif & nonaktif
 */
router.get('/', async (_req, res) => {
  try {
    const patterns = await getPatternsFromDb();
    return res.json({ success: true, patterns });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/sn-patterns
 * Tambah pola SN baru (Khusus Admin / Developer)
 */
router.post('/', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { nama, pola_sederhana, contoh_sn, pola_regex, is_advanced, auto_uppercase, strip_spaces, strip_prefixes } = req.body;

    if (!nama || !nama.trim()) {
      return res.status(400).json({ success: false, message: 'Nama pola SN wajib diisi.' });
    }

    if (!contoh_sn || !contoh_sn.trim()) {
      return res.status(400).json({ success: false, message: 'Contoh SN wajib diisi.' });
    }

    const reg = pola_regex || '^.*$';

    // Validasi Regex Syntax
    try {
      new RegExp(reg, 'i');
    } catch {
      return res.status(400).json({ success: false, message: 'Format Regex tidak valid.' });
    }

    // Validasi Match: Contoh SN harus cocok dengan regex
    try {
      const matcher = new RegExp(reg, 'i');
      if (!matcher.test(contoh_sn.trim())) {
        return res.status(400).json({
          success: false,
          message: `Contoh SN "${contoh_sn}" tidak cocok dengan polanya.`
        });
      }
    } catch {
      return res.status(400).json({ success: false, message: 'Gagal mencocokkan contoh SN dengan pola.' });
    }

    const currentList = await getPatternsFromDb();
    const newPattern: SNPatternRecord = {
      id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nama: nama.trim(),
      pola_sederhana: (pola_sederhana || '').trim(),
      contoh_sn: contoh_sn.trim(),
      pola_regex: reg,
      is_advanced: Boolean(is_advanced),
      aktif: true,
      auto_uppercase: auto_uppercase !== false,
      strip_spaces: strip_spaces !== false,
      strip_prefixes: strip_prefixes !== false,
      dibuat_pada: new Date().toISOString(),
      diperbarui_pada: new Date().toISOString()
    };

    currentList.push(newPattern);
    await savePatternsToDb(currentList);

    return res.json({ success: true, message: 'Pola SN berhasil ditambahkan.', pattern: newPattern });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/sn-patterns/:id
 * Edit pola SN (Khusus Admin / Developer)
 */
router.put('/:id', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { nama, pola_sederhana, contoh_sn, pola_regex, is_advanced, aktif, auto_uppercase, strip_spaces, strip_prefixes } = req.body;

    const currentList = await getPatternsFromDb();
    const idx = currentList.findIndex(p => p.id === id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Pola SN tidak ditemukan.' });
    }

    const reg = pola_regex || currentList[idx].pola_regex;
    const sampleSN = contoh_sn !== undefined ? contoh_sn.trim() : currentList[idx].contoh_sn;

    // Validasi Match
    try {
      const matcher = new RegExp(reg, 'i');
      if (sampleSN && !matcher.test(sampleSN)) {
        return res.status(400).json({
          success: false,
          message: `Contoh SN "${sampleSN}" tidak cocok dengan polanya.`
        });
      }
    } catch {
      return res.status(400).json({ success: false, message: 'Format Regex tidak valid.' });
    }

    currentList[idx] = {
      ...currentList[idx],
      nama: nama !== undefined ? nama.trim() : currentList[idx].nama,
      pola_sederhana: pola_sederhana !== undefined ? pola_sederhana.trim() : currentList[idx].pola_sederhana,
      contoh_sn: sampleSN,
      pola_regex: reg,
      is_advanced: is_advanced !== undefined ? Boolean(is_advanced) : currentList[idx].is_advanced,
      aktif: aktif !== undefined ? Boolean(aktif) : currentList[idx].aktif,
      auto_uppercase: auto_uppercase !== undefined ? Boolean(auto_uppercase) : currentList[idx].auto_uppercase,
      strip_spaces: strip_spaces !== undefined ? Boolean(strip_spaces) : currentList[idx].strip_spaces,
      strip_prefixes: strip_prefixes !== undefined ? Boolean(strip_prefixes) : currentList[idx].strip_prefixes,
      diperbarui_pada: new Date().toISOString()
    };

    await savePatternsToDb(currentList);
    return res.json({ success: true, message: 'Pola SN berhasil diperbarui.', pattern: currentList[idx] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/sn-patterns/:id
 * Hapus pola SN (Khusus Admin / Developer)
 */
router.delete('/:id', requireAuth, requireRole(['developer', 'admin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    let currentList = await getPatternsFromDb();
    const filtered = currentList.filter(p => p.id !== id);

    if (filtered.length === currentList.length) {
      return res.status(404).json({ success: false, message: 'Pola SN tidak ditemukan.' });
    }

    await savePatternsToDb(filtered);
    return res.json({ success: true, message: 'Pola SN berhasil dihapus.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
