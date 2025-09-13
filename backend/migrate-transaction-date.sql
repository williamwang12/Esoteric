-- Migration: Change transaction_date from DATE to TIMESTAMP to store exact timestamps
-- This allows storing both date and time information for transactions

-- First, let's add a new column with the correct type
ALTER TABLE loan_transactions 
ADD COLUMN transaction_timestamp TIMESTAMP;

-- Copy existing data, setting time to start of day for existing records
UPDATE loan_transactions 
SET transaction_timestamp = transaction_date::timestamp;

-- Make the new column NOT NULL after populating it
ALTER TABLE loan_transactions 
ALTER COLUMN transaction_timestamp SET NOT NULL;

-- Drop the old column
ALTER TABLE loan_transactions 
DROP COLUMN transaction_date;

-- Rename the new column to the original name
ALTER TABLE loan_transactions 
RENAME COLUMN transaction_timestamp TO transaction_date;

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'loan_transactions' 
AND column_name = 'transaction_date';