/**
 * FieldOps IT - Backend Server Entry Point
 * Express 5 + MariaDB 11.x (UTC) + Vite Middleware Dev Integration
 */

process.env.TZ = 'UTC';

import express from 'express';
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

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      app: 'FieldOps IT Inventory',
      version: '1.2.8',
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

  const frontendDir = path.resolve(PROJECT_ROOT_DIR, 'frontend');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
  const distDir = path.resolve(frontendDir, 'dist');

  app.use(express.static(distDir, {
    setHeaders(res, filePath) {
      if (/[\\/](index\.html|sw\.js|registerSW\.js|manifest\.webmanifest)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    if (path.extname(req.path)) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-cache');
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
