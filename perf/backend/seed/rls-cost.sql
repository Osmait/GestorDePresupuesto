-- SQL-level cost of the FORCE RLS policies: the same statements run as the
-- owner role "perf" (policies enforced, needs reset-db.sh ... norls) inside a
-- transaction with the app's set_config(), vs. the superuser (policies bypassed).
--   docker exec -i perf-be-pg-15441 psql -U perf -d perf < rls-cost.sql
\pset pager off
\timing off
SET ROLE perf;
BEGIN;
SELECT set_config('app.current_user_id', 'pu0000000000000000000000000', true), set_config('app.is_admin', 'false', true);
\echo '### RLS enforced: balances (Q1)'
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON)
SELECT account_id, SUM(CASE WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund') THEN amount ELSE -amount END)
FROM transactions WHERE user_id = 'pu0000000000000000000000000' GROUP BY account_id;
\echo '### RLS enforced: card balances (EXISTS-join policy)'
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM card_balances;
COMMIT;
RESET ROLE;
\echo '### RLS bypassed (superuser): balances (Q1)'
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON)
SELECT account_id, SUM(CASE WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund') THEN amount ELSE -amount END)
FROM transactions WHERE user_id = 'pu0000000000000000000000000' GROUP BY account_id;
\echo '### RLS bypassed (superuser): card balances'
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM card_balances;
