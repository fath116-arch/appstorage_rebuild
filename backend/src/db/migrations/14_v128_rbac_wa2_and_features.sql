-- ==============================================================================
-- 14_v128_rbac_wa2_and_features.sql
-- FieldOps IT v1.2.8:
-- 1. Kolom feature_permissions (JSON override slider ON/OFF per akun pengguna)
-- 2. Peleburan role warehouse_admin & supervisor menjadi admin, superadmin menjadi developer
-- 3. Dukungan Dual WhatsApp Gateway (gateway1 & gateway2 + gateway_mode)
-- 4. Update metadata versi & tier konfirmasi penghapusan
-- ==============================================================================

-- 1. Tambah kolom feature_permissions pada users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS feature_permissions TEXT NULL;

-- 2. Peleburan role warehouse_admin/supervisor -> admin & superadmin -> developer
UPDATE users
SET role = 'admin'
WHERE role IN ('warehouse_admin', 'supervisor');

UPDATE users
SET role = 'developer'
WHERE role = 'superadmin';

-- 3. Tambah kolom dual gateway pada wa_config
ALTER TABLE wa_config
  ADD COLUMN IF NOT EXISTS gateways_json TEXT NULL,
  ADD COLUMN IF NOT EXISTS gateway_mode VARCHAR(24) NOT NULL DEFAULT 'failover';

-- 4. Lengkapi pemetaan tier konfirmasi untuk hapus atribut & item fisik
INSERT IGNORE INTO pengaturan (kunci, nilai, keterangan) VALUES (
  'CONFIRMATION_TIERS',
  '{"stock_move_single":0,"notes_update":0,"stock_out_single":1,"restore_single":1,"request_approve":2,"request_reject":2,"bulk_stock_out":2,"bulk_stock_in":2,"permanent_delete":3,"delete_product":3,"delete_type":3,"delete_kind":3,"delete_box":3,"delete_attribute":3,"delete_item":3,"correct_item_id":3,"change_role":3,"change_id_rule":3}',
  'Pemetaan tingkat konfirmasi bertingkat (Tingkat 0-3)'
);
