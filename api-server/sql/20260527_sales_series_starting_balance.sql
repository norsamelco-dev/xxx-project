ALTER TABLE sales_series
ADD COLUMN IF NOT EXISTS starting_balance DECIMAL(12,2) NULL AFTER seriesno;
