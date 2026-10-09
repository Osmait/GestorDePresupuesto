DROP INDEX IF EXISTS idx_recurring_transactions_next_execution_date;
ALTER TABLE recurring_transactions DROP COLUMN IF EXISTS next_execution_date;
