ALTER TABLE sales_series
  ADD COLUMN IF NOT EXISTS x_report_printed_at DATETIME NULL AFTER lockbatch,
  ADD COLUMN IF NOT EXISTS x_report_printed_by VARCHAR(100) NULL AFTER x_report_printed_at,
  ADD COLUMN IF NOT EXISTS z_report_printed_at DATETIME NULL AFTER x_report_printed_by,
  ADD COLUMN IF NOT EXISTS z_report_printed_by VARCHAR(100) NULL AFTER z_report_printed_at;
