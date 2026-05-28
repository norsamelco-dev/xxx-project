-- Damage Reports module tables

CREATE TABLE IF NOT EXISTS damage_reason_options (
  id INT NOT NULL AUTO_INCREMENT,
  reason_code VARCHAR(50) NOT NULL,
  reason_label VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_damage_reason_code (reason_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO damage_reason_options (reason_code, reason_label, sort_order) VALUES
  ('rat_damage', 'Rat damage', 1),
  ('flood', 'Flood', 2),
  ('expired', 'Expired', 3),
  ('accident', 'Accident', 4),
  ('other', 'Other', 99)
ON DUPLICATE KEY UPDATE reason_label = VALUES(reason_label), sort_order = VALUES(sort_order);

CREATE TABLE IF NOT EXISTS damage_reports (
  id INT NOT NULL AUTO_INCREMENT,
  report_number VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  remarks TEXT NULL,
  created_by_user_id VARCHAR(45) DEFAULT NULL,
  created_by_username VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  synced_by_user_id VARCHAR(45) DEFAULT NULL,
  synced_by_username VARCHAR(255) DEFAULT NULL,
  synced_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_damage_report_number (report_number),
  KEY idx_damage_reports_status (status),
  KEY idx_damage_reports_created_at (created_at),
  KEY idx_damage_reports_synced_at (synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS damage_report_items (
  id INT NOT NULL AUTO_INCREMENT,
  damage_report_id INT NOT NULL,
  product_id INT DEFAULT NULL,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  product_barcode VARCHAR(100) NOT NULL,
  qty_damaged INT NOT NULL,
  damage_reason VARCHAR(100) NOT NULL,
  remarks TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_damage_report_items_report (damage_report_id),
  CONSTRAINT fk_damage_report_items_report
    FOREIGN KEY (damage_report_id) REFERENCES damage_reports (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS damage_report_sync_logs (
  id INT NOT NULL AUTO_INCREMENT,
  damage_report_id INT NOT NULL,
  report_number VARCHAR(30) NOT NULL,
  sync_batch_id VARCHAR(64) NOT NULL,
  synced_by_user_id VARCHAR(45) DEFAULT NULL,
  synced_by_username VARCHAR(255) DEFAULT NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL,
  error_summary TEXT NULL,
  warnings_json TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_damage_sync_logs_report (damage_report_id),
  KEY idx_damage_sync_logs_batch (sync_batch_id),
  KEY idx_damage_sync_logs_synced_at (synced_at),
  KEY idx_damage_sync_logs_report_number (report_number),
  KEY idx_damage_sync_logs_username (synced_by_username),
  CONSTRAINT fk_damage_sync_logs_report
    FOREIGN KEY (damage_report_id) REFERENCES damage_reports (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS damage_report_sync_log_items (
  id INT NOT NULL AUTO_INCREMENT,
  sync_log_id INT NOT NULL,
  damage_report_item_id INT DEFAULT NULL,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  product_barcode VARCHAR(100) NOT NULL,
  qty_requested INT NOT NULL DEFAULT 0,
  qty_deducted INT NOT NULL DEFAULT 0,
  damage_reason VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_damage_sync_log_items_log (sync_log_id),
  CONSTRAINT fk_damage_sync_log_items_log
    FOREIGN KEY (sync_log_id) REFERENCES damage_report_sync_logs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS damage_report_sync_log_batches (
  id INT NOT NULL AUTO_INCREMENT,
  sync_log_item_id INT NOT NULL,
  product_batch_id INT NOT NULL,
  batch_id VARCHAR(100) DEFAULT NULL,
  cost_price DECIMAL(10,2) DEFAULT NULL,
  qty_before INT NOT NULL DEFAULT 0,
  qty_deducted INT NOT NULL DEFAULT 0,
  qty_after INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_damage_sync_log_batches_item (sync_log_item_id),
  KEY idx_damage_sync_log_batches_batch (product_batch_id),
  CONSTRAINT fk_damage_sync_log_batches_item
    FOREIGN KEY (sync_log_item_id) REFERENCES damage_report_sync_log_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
