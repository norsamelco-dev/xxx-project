ALTER TABLE receipt_heading
  ADD COLUMN IF NOT EXISTS print_logo_width INT NOT NULL DEFAULT 240 AFTER business_logo_path,
  ADD COLUMN IF NOT EXISTS print_logo_align VARCHAR(10) NOT NULL DEFAULT 'center' AFTER print_logo_width,
  ADD COLUMN IF NOT EXISTS print_logo_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER print_logo_align;
