-- Candidate fixes for the slowest statements, each tried inside a transaction
-- that is rolled back (nothing persists).
--   docker exec -i perf-be-pg-15441 psql -U postgres -d perf < index-experiments.sql > index-experiments.txt
\set u '''pu0000000000000000000000000'''
\pset pager off
SET client_min_messages = warning;
SELECT (now() - interval '1 year')::timestamptz AS y0, now()::timestamptz AS y1 \gset

\echo '### E1 Q4 FindCurrentBudgets rewritten sargable (no new index)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT budget_id, COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * 60 ELSE amount END), 0) FROM transactions
WHERE user_id = :u AND budget_id IS NOT NULL AND type_transation = 'bill'
  AND created_at >= date_trunc('month', CURRENT_DATE) AND created_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
GROUP BY budget_id;

\echo '### E2 Q3 name-sorted page with index (user_id, type_transation, transaction_name, id)'
BEGIN;
CREATE INDEX e2 ON transactions (user_id, type_transation, transaction_name, id);
ANALYZE transactions;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, transaction_name, transaction_description, amount, type_transation, account_id, category_id, budget_id, COALESCE(currency, 'DOP'), created_at
FROM transactions WHERE user_id = :u AND type_transation = 'bill' AND created_at >= :'y0' AND created_at <= :'y1'
ORDER BY transaction_name ASC, id ASC LIMIT 20 OFFSET 480;
\echo '### E2b same index, first page (OFFSET 0)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, transaction_name, amount, created_at
FROM transactions WHERE user_id = :u AND type_transation = 'bill' AND created_at >= :'y0' AND created_at <= :'y1'
ORDER BY transaction_name ASC, id ASC LIMIT 20;
ROLLBACK;

\echo '### E3 Q1 balances with covering index (user_id, account_id) INCLUDE (type_transation, amount)'
BEGIN;
CREATE INDEX e3 ON transactions (user_id, account_id) INCLUDE (type_transation, amount, currency);
ANALYZE transactions;  -- the table is all-visible after the seed's autovacuum, so index-only scans apply
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT account_id, COALESCE(SUM(CASE WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund') THEN amount ELSE -amount END), 0)
FROM transactions WHERE user_id = :u GROUP BY account_id;
\echo '### E4 Q5 balance-by-currency with the same covering index'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT COALESCE(SUM(CASE WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund') THEN amount ELSE -amount END), 0)
FROM transactions WHERE account_id = 'pa0000000000000000000000001' AND user_id = :u AND (currency = 'DOP' OR ('DOP' = 'DOP' AND currency IS NULL));
ROLLBACK;
