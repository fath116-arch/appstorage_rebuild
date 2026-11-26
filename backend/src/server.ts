/**
 * FieldOps IT - Backend Server Entry Point
 * Express 5 + MariaDB 11.x (UTC) + Vite Middleware Dev Integration
 */

process.env.TZ = 'UTC';

import express from 'express';
import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT_DIR, initDatabase, loadLayeredEnv } from './db/database';
import { authenticate, requireAuth, requireFeature } from './middleware/authMiddleware';
import authRoutes from './routes/auth';
import activitiesRoutes from './routes/activities';
import ticketRoutes from './routes/ticketIntegration';
import checklistRoutes from './routes/checklist';
import reportRoutes from './routes/reports';
import whatsappRoutes from './routes/whatsapp';
import catalogRoutes from './routes/catalog';
import boxRoutes from './routes/box';
import stockRoutes from './routes/stock';
import requestRoutes from './routes/request';
import snPatternsRoutes from './routes/snPatterns';
import setupRoutes from './routes/setup';
import importRoutes from './routes/import';
import { BackupService } from './services/backupService';

loadLayeredEnv();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Security Headers Middleware (SEC-05)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Inisialisasi Database MariaDB (UTC +00:00) & Konsolidasi Data Kanonis
  await initDatabase();

  // Inisialisasi Cron Backup Harian Terpisah
  BackupService.initDailyBackupCron();

  // Pasang Middleware Autentikasi Sesi Server
  app.use(authenticate);

  const frontendDir = path.resolve(PROJECT_ROOT_DIR, 'frontend');
  const distDir = path.resolve(frontendDir, 'dist');
  const bootFallbackBuildId = `boot-${Date.now().toString(36)}`;

  const readBuildMeta = (): { buildId: string; builtAt?: string } => {
    try {
      const metaPath = path.resolve(distDir, 'build-meta.json');
      if (fs.existsSync(metaPath)) {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const parsed = JSON.parse(raw) as { buildId?: string; builtAt?: string };
        if (parsed && typeof parsed.buildId === 'string' && parsed.buildId.trim()) {
          return {
            buildId: parsed.buildId.trim(),
            builtAt: parsed.builtAt,
          };
        }
      }
    } catch {
      // Abaikan jika gagal membaca build-meta.json
    }
    return { buildId: process.env.NODE_ENV === 'production' ? bootFallbackBuildId : 'dev' };
  };

  // Health check endpoint (tanpa cache agar klien selalu mendapat buildId terbaru)
  app.get('/api/health', (_req, res) => {
    const buildMeta = readBuildMeta();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({
      status: 'healthy',
      app: 'FieldOps IT Inventory',
      version: '1.2.8',
      buildId: buildMeta.buildId,
      builtAt: buildMeta.builtAt || null,
      database: 'MariaDB 11.x (Single Canonical Model, UTC)',
      tunnel: 'Cloudflare Tunnel Ready',
      timestamp: new Date().toISOString()
    });
  });

  // Mount Canonical API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/activities', activitiesRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/checklists', checklistRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/boxes', boxRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/sn-patterns', snPatternsRoutes);
  app.use('/api/setup', setupRoutes);
  app.use('/api/import', importRoutes);

  // Endpoint Backup Khusus Data Barang (Bebas Akun) - Khusus yang memiliki fitur setup_database
  app.get('/api/backup/inventory/download', requireAuth, requireFeature('setup_database'), async (_req, res) => {
    try {
      const result = await BackupService.createInventoryBackup('user-download');
      res.download(result.filePath, result.filename);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 404 handler khusus rute /api agar tidak jatuh ke HTML SPA
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint API tidak ditemukan.' });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const applyNoCacheHeaders = (res: express.Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    };

    app.use(express.static(distDir, {
      setHeaders(res, filePath) {
        if (/[\\/](index\.html|sw\.js|registerSW\.js|manifest\.webmanifest|build-meta\.json|workbox-[^\\/]+\.js)$/.test(filePath)) {
          applyNoCacheHeaders(res);
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));

    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      if (path.extname(req.path)) return res.status(404).end();
      applyNoCacheHeaders(res);
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: frontendDir,
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FieldOps IT Server] Berjalan pada http://0.0.0.0:${PORT} (TZ: ${process.env.TZ}, Mode: ${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer().catch(err => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
