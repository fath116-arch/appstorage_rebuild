-- ==============================================================================
-- 09_v125_paket6_wa_alert.sql
-- FIELD OPS INVENTORY V1.2.5 - PAKET 6: WA ALERT (FONNTE) & AMBANG BERJENJANG
-- Skema Konfigurasi WA, Ambang Berjenjang (Tipe > Produk > Global),
-- Daftar Pantauan (Watchlist), Anti-Duplikat Status, dan Log Pengiriman
-- ==============================================================================

-- 1. Tabel Konfigurasi WA Alert
CREATE TABLE IF NOT EXISTS wa_config (
  id VARCHAR(36) PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cooldown_minutes INT NOT NULL DEFAULT 15,
  last_sent_at DATETIME NULL,
  active_hours_start VARCHAR(5) NULL,
  active_hours_end VARCHAR(5) NULL,
  alert_on_out_of_stock BOOLEAN NOT NULL DEFAULT TRUE,
  alert_on_low_stock BOOLEAN NOT NULL DEFAULT TRUE,
  alert_on_early_warning BOOLEAN NOT NULL DEFAULT TRUE,
  global_low_stock_threshold INT NOT NULL DEFAULT 3,
  global_early_warning_threshold INT NOT NULL DEFAULT 5,
  recipients_json TEXT NOT NULL,
  api_url VARCHAR(255) NOT NULL DEFAULT 'https://api.fonnte.com/send',
  api_token VARCHAR(255) NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Tabel Ambang Berjenjang (tipe > produk > global) & Daftar Pantauan (Watchlist)
CREATE TABLE IF NOT EXISTS wa_thresholds (
  id VARCHAR(36) PRIMARY KEY,
  level ENUM('produk', 'tipe') NOT NULL,
  produk_id INT NULL,
  tipe_id INT NULL,
  low_stock_threshold INT NULL,
  early_warning_threshold INT NULL,
  is_watchlist BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wa_thresh_level (level),
  INDEX idx_wa_thresh_prod (produk_id),
  INDEX idx_wa_thresh_tipe (tipe_id)
);

-- 3. Tabel Status Alert (Anti-Duplikat & Queue 15 Menit)
CREATE TABLE IF NOT EXISTS wa_alert_status (
  id VARCHAR(50) PRIMARY KEY,
  target_type ENUM('item', 'tipe', 'produk') NOT NULL,
  target_id VARCHAR(50) NOT NULL,
  current_status VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
  last_alert_status VARCHAR(30) NULL,
  last_alert_sent_at DATETIME NULL,
  pending_in_queue BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wa_status_target (target_type, target_id)
);

-- 4. Tabel Riwayat Pengiriman WA Alert
CREATE TABLE IF NOT EXISTS wa_delivery_logs (
  id VARCHAR(50) PRIMARY KEY,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  trigger_type VARCHAR(50) NOT NULL,
  recipients TEXT NOT NULL,
  message_snippet TEXT NOT NULL,
  summary_counts TEXT NULL,
  fonnte_status VARCHAR(30) NOT NULL,
  fonnte_response TEXT NULL,
  operator_id VARCHAR(50) NULL,
  INDEX idx_wa_logs_sent_at (sent_at)
);

-- 5. Data Default Konfigurasi Awal (Idempotent)
INSERT IGNORE INTO wa_config (
  id, is_enabled, cooldown_minutes, alert_on_out_of_stock, alert_on_low_stock,
  alert_on_early_warning, global_low_stock_threshold, global_early_warning_threshold,
  recipients_json, api_url, api_token
) VALUES (
  'main', TRUE, 15, TRUE, TRUE, TRUE, 3, 5,
  '["081290008888"]', 'https://api.fonnte.com/send', ''
);
