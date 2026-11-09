/**
 * FieldOps IT - Backend Server Entry Point
 * Express 5 + MariaDB 11.x + Vite Middleware Dev Integration
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database';
import { authenticate, requireAuth, requireRole } from './middleware/authMiddleware';
import authRoutes from './routes/auth';
import inventoryRoutes from './routes/inventory';
import transactionRoutes from './routes/transactions';
import ticketRoutes from './routes/ticketIntegration';
import checklistRoutes from './routes/checklist';
import reportRoutes from './routes/reports';
import whatsappRoutes from './routes/whatsapp';
import catalogRoutes from './routes/catalog';
import boxRoutes from './routes/box';
import stockRoutes from './routes/stock';
import requestRoutes from './routes/request';
import snPatternsRoutes from './routes/snPatterns';
import { BackupService } from './services/backupService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

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

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Inisialisasi Database MariaDB & Migrasi Skema
  await initDatabase();

  // Inisialisasi Cron Backup Harian Terpisah
  BackupService.initDailyBackupCron();

  // Pasang Middleware Autentikasi Sesi Server
  app.use(authenticate);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      app: 'FieldOps IT Backend Rebuild',
      version: '1.0.0',
      database: 'MariaDB 11.x (Separated Business vs Account Files)',
      tunnel: 'Cloudflare Tunnel Ready',
      timestamp: new Date().toISOString()
    });
  });

  // Mount API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/checklists', checklistRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/boxes', boxRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/sn-patterns', snPatternsRoutes);

  // Endpoint Backup Khusus Data Barang (Bebas Akun) - Khusus Developer & Admin
  app.get('/api/backup/inventory/download', requireAuth, requireRole(['developer', 'admin']), async (_req, res) => {
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

  const frontendDir = path.resolve(rootDir, 'frontend');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const distDir = path.resolve(frontendDir, 'dist');
    app.use(express.static(distDir));

    // Fallback SPA routing (Express 5 compatible)
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    // Import Vite secara dinamis hanya di mode development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: frontendDir,
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FieldOps IT Rebuild Server] Berjalan pada http://0.0.0.0:${PORT} (Mode: ${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer().catch(err => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
