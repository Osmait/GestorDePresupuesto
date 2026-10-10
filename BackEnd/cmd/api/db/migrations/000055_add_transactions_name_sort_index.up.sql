-- Index for name-sorted transaction pages:
--   WHERE user_id = $1 AND type_transation = $2 [AND created_at range ...]
--   ORDER BY transaction_name {ASC|DESC}, id {ASC|DESC} LIMIT/OFFSET
-- (transactionRepository.buildTransactionQuery). Without it every page is a
-- seq scan + top-N sort of all the user's rows (14.9 ms -> 0.9 ms measured).
--
-- CONCURRENTLY: no write lock on transactions while the index is built (SHARE
-- UPDATE EXCLUSIVE only; it waits for transactions that started before it).
-- It cannot run inside a transaction block, so this file must contain exactly
-- this ONE statement: golang-migrate's postgres driver sends the file as one
-- simple-protocol query, and a multi-statement query is an implicit
-- transaction block.
-- If it fails half-way it leaves an INVALID index and a dirty migration: run
-- DROP INDEX CONCURRENTLY idx_transactions_user_type_name_id; then
-- `migrate force 54` and restart. IF NOT EXISTS allows creating the index by
-- hand ahead of the deploy.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_type_name_id
    ON transactions (user_id, type_transation, transaction_name, id);
