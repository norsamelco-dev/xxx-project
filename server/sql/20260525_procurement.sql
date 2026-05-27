-- Procurement module tables

CREATE TABLE IF NOT EXISTS suppliers (
  id INT NOT NULL AUTO_INCREMENT,
  supplier_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) DEFAULT NULL,
  contact_phone VARCHAR(100) DEFAULT NULL,
  contact_email VARCHAR(255) DEFAULT NULL,
  payment_terms VARCHAR(100) DEFAULT 'Net 30',
  address TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_suppliers_active (is_active),
  KEY idx_suppliers_name (supplier_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id INT NOT NULL AUTO_INCREMENT,
  pr_number VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  preferred_supplier_id INT DEFAULT NULL,
  remarks TEXT DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  created_by_user_id VARCHAR(45) DEFAULT NULL,
  created_by_username VARCHAR(255) DEFAULT NULL,
  submitted_at DATETIME DEFAULT NULL,
  approved_by_user_id VARCHAR(45) DEFAULT NULL,
  approved_by_username VARCHAR(255) DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  rejected_by_user_id VARCHAR(45) DEFAULT NULL,
  rejected_by_username VARCHAR(255) DEFAULT NULL,
  rejected_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pr_number (pr_number),
  KEY idx_pr_status (status),
  KEY idx_pr_created_at (created_at),
  KEY idx_pr_supplier (preferred_supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS purchase_requisition_items (
  id INT NOT NULL AUTO_INCREMENT,
  purchase_requisition_id INT NOT NULL,
  product_id INT DEFAULT NULL,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  product_barcode VARCHAR(100) NOT NULL,
  qty_requested INT NOT NULL,
  unit_snapshot VARCHAR(50) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pr_items_pr (purchase_requisition_id),
  CONSTRAINT fk_pr_items_pr
    FOREIGN KEY (purchase_requisition_id) REFERENCES purchase_requisitions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT NOT NULL AUTO_INCREMENT,
  po_number VARCHAR(30) NOT NULL,
  purchase_requisition_id INT NOT NULL,
  supplier_id INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  expected_delivery_date DATE DEFAULT NULL,
  cancel_reason TEXT DEFAULT NULL,
  created_by_user_id VARCHAR(45) DEFAULT NULL,
  created_by_username VARCHAR(255) DEFAULT NULL,
  sent_by_user_id VARCHAR(45) DEFAULT NULL,
  sent_by_username VARCHAR(255) DEFAULT NULL,
  sent_at DATETIME DEFAULT NULL,
  cancelled_by_user_id VARCHAR(45) DEFAULT NULL,
  cancelled_by_username VARCHAR(255) DEFAULT NULL,
  cancelled_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_po_number (po_number),
  KEY idx_po_status (status),
  KEY idx_po_pr (purchase_requisition_id),
  KEY idx_po_supplier (supplier_id),
  CONSTRAINT fk_po_pr
    FOREIGN KEY (purchase_requisition_id) REFERENCES purchase_requisitions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_po_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Named purchase_order_lines to avoid conflict with legacy purchase_order_items (po_item_id/po_id).
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id INT NOT NULL AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  purchase_requisition_item_id INT DEFAULT NULL,
  product_id INT DEFAULT NULL,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  product_barcode VARCHAR(100) NOT NULL,
  qty_ordered INT NOT NULL,
  qty_received INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_po_items_po (purchase_order_id),
  CONSTRAINT fk_po_items_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS receiving_reports (
  id INT NOT NULL AUTO_INCREMENT,
  rr_number VARCHAR(30) NOT NULL,
  purchase_order_id INT NOT NULL,
  supplier_dr_number VARCHAR(100) DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  remarks TEXT DEFAULT NULL,
  created_by_user_id VARCHAR(45) DEFAULT NULL,
  created_by_username VARCHAR(255) DEFAULT NULL,
  received_by_user_id VARCHAR(45) DEFAULT NULL,
  received_by_username VARCHAR(255) DEFAULT NULL,
  received_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rr_number (rr_number),
  KEY idx_rr_po (purchase_order_id),
  KEY idx_rr_status (status),
  CONSTRAINT fk_rr_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS receiving_report_items (
  id INT NOT NULL AUTO_INCREMENT,
  receiving_report_id INT NOT NULL,
  purchase_order_item_id INT NOT NULL,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  product_barcode VARCHAR(100) NOT NULL,
  qty_received INT NOT NULL,
  item_condition VARCHAR(20) NOT NULL DEFAULT 'good',
  expiry_date DATE DEFAULT NULL,
  batch_number VARCHAR(100) DEFAULT NULL,
  unit_cost_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rr_items_rr (receiving_report_id),
  KEY idx_rr_items_po_item (purchase_order_item_id),
  CONSTRAINT fk_rr_items_rr
    FOREIGN KEY (receiving_report_id) REFERENCES receiving_reports (id) ON DELETE CASCADE,
  CONSTRAINT fk_rr_items_po_item
    FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_lines (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id INT NOT NULL AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  invoice_date DATE DEFAULT NULL,
  amount_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_terms VARCHAR(100) DEFAULT NULL,
  created_by_user_id VARCHAR(45) DEFAULT NULL,
  created_by_username VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_si_po (purchase_order_id),
  KEY idx_si_status (status),
  CONSTRAINT fk_si_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS supplier_invoice_items (
  id INT NOT NULL AUTO_INCREMENT,
  supplier_invoice_id INT NOT NULL,
  purchase_order_item_id INT DEFAULT NULL,
  product_name VARCHAR(500) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  product_barcode VARCHAR(100) NOT NULL,
  qty_invoiced INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_si_items_invoice (supplier_invoice_id),
  CONSTRAINT fk_si_items_invoice
    FOREIGN KEY (supplier_invoice_id) REFERENCES supplier_invoices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS procurement_match_reviews (
  id INT NOT NULL AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'needs_review',
  discrepancy_json TEXT DEFAULT NULL,
  reviewed_by_user_id VARCHAR(45) DEFAULT NULL,
  reviewed_by_username VARCHAR(255) DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_po (purchase_order_id),
  CONSTRAINT fk_match_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS accounts_payable_payments (
  id INT NOT NULL AUTO_INCREMENT,
  purchase_order_id INT NOT NULL,
  supplier_invoice_id INT DEFAULT NULL,
  supplier_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  amount_due DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_terms VARCHAR(100) DEFAULT NULL,
  payment_date DATE DEFAULT NULL,
  payment_method VARCHAR(50) DEFAULT NULL,
  paid_by_user_id VARCHAR(45) DEFAULT NULL,
  paid_by_username VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ap_po (purchase_order_id),
  KEY idx_ap_status (status),
  KEY idx_ap_supplier (supplier_id),
  CONSTRAINT fk_ap_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ap_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
