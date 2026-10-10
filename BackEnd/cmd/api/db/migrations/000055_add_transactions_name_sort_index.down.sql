-- Single statement: DROP INDEX CONCURRENTLY cannot run in a transaction block.
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_type_name_id;
