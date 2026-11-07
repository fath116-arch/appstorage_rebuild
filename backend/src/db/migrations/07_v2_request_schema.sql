-- ============================================================================
-- FieldOps IT Inventory v2 - Skema Request & Persetujuan Teknisi (Tahap 6)
-- File: 07_v2_request_schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS request (
    id VARCHAR(36) PRIMARY KEY,
    pemohon_id VARCHAR(36) NOT NULL,
    penyetuju_id VARCHAR(36) NULL,
    tipe_id INT NOT NULL,
    box_id VARCHAR(36) NULL,
    kode_id VARCHAR(100) NULL,
    jumlah INT NOT NULL DEFAULT 1,
    alasan TEXT NOT NULL,
    catatan_penolakan TEXT NULL,
    status ENUM('menunggu', 'disetujui', 'ditolak') NOT NULL DEFAULT 'menunggu',
    dibuat_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diproses_pada DATETIME NULL,
    CONSTRAINT fk_request_pemohon FOREIGN KEY (pemohon_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_request_penyetuju FOREIGN KEY (penyetuju_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_request_tipe FOREIGN KEY (tipe_id) REFERENCES tipe(id) ON DELETE CASCADE,
    CONSTRAINT fk_request_box FOREIGN KEY (box_id) REFERENCES box(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_request_pemohon ON request(pemohon_id);
CREATE INDEX idx_request_status ON request(status);
CREATE INDEX idx_request_tipe ON request(tipe_id);
