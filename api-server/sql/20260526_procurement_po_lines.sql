-- Procurement PO line items (avoids legacy purchase_order_items table).
-- Safe to run on databases that already have the old purchase_order_items schema.

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
  KEY idx_po_lines_po (purchase_order_id),
  CONSTRAINT fk_po_lines_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
