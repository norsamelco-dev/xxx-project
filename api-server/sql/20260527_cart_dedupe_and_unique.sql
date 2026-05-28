-- Run on posdb_adv BEFORE testing batch-aware cart adds.
-- Step 1: Remove duplicate cart rows (keeps highest ID per user+barcode+batch).
DELETE c1
FROM cart c1
INNER JOIN cart c2
  ON c1.USERID = c2.USERID
 AND c1.BARCODE = c2.BARCODE
 AND c1.BATCHID = c2.BATCHID
 AND c1.ID < c2.ID;

-- Step 2: Add unique index so ON DUPLICATE KEY UPDATE works.
-- Skip if index already exists (MySQL will error; safe to run once).
ALTER TABLE cart
  ADD UNIQUE KEY cart_user_line (USERID, BARCODE, BATCHID);
