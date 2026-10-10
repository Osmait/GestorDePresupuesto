-- EXPLAIN (ANALYZE, BUFFERS) of the top statements from pg_stat_statements
-- under the mixed workload, with the heavy user's parameters (50k rows).
--   docker exec -i perf-be-pg-15441 psql -U postgres -d perf < explain.sql > explain.txt
-- Dates: "1y" = last 12 months, "month" = current month.
\set u '''pu0000000000000000000000000'''
\pset pager off
SET client_min_messages = warning;
SELECT (date_trunc('month', now()))::timestamptz AS m0, (date_trunc('month', now()) + interval '1 month - 1 second')::timestamptz AS m1,
       (now() - interval '1 year')::timestamptz AS y0, now()::timestamptz AS y1 \gset

\echo '### Q1 account balances (AccountRepository.Balances) — GET /account, dashboard-summary'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT account_id, COALESCE(SUM(CASE WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund') THEN amount ELSE -amount END), 0) AS total
FROM transactions WHERE user_id = :u GROUP BY account_id;

\echo '### Q2 category expenses, all time (AnalyticsRepository.GetCategoryExpenses) — GET /analytics/category-expenses'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT c.id, c.name, COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.amount * 60 ELSE t.amount END), 0) AS total, c.color, COUNT(*),
       COALESCE(SUM(CASE WHEN t.currency = 'DOP' THEN t.amount ELSE 0 END), 0), COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.amount ELSE 0 END), 0)
FROM transactions t JOIN categorys c ON t.category_id = c.id
WHERE t.user_id = :u AND t.type_transation = 'bill' GROUP BY c.id, c.name, c.color;

\echo '### Q3 transaction page sorted by name, bills, 1y, page 25 (buildTransactionQuery) — GET /transaction?sort_by=transaction_name'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, transaction_name, transaction_description, amount, type_transation, account_id, category_id, budget_id, COALESCE(currency, 'DOP'), created_at
FROM transactions WHERE user_id = :u AND type_transation = 'bill' AND created_at >= :'y0' AND created_at <= :'y1'
ORDER BY transaction_name ASC, id ASC LIMIT 20 OFFSET 480;

\echo '### Q4 budget spent this month (TransactionRepository.FindCurrentBudgets) — GET /budget'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT budget_id, COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * 60 ELSE amount END), 0) FROM transactions
WHERE user_id = :u AND budget_id IS NOT NULL AND type_transation = 'bill'
  AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE) GROUP BY budget_id;

\echo '### Q5 account balance by currency under FOR UPDATE (funds.Require -> BalanceByCurrency) — card payments, loans, investments'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT COALESCE(SUM(CASE WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund') THEN amount ELSE -amount END), 0)
FROM transactions WHERE account_id = 'pa0000000000000000000000001' AND user_id = :u AND (currency = 'DOP' OR ('DOP' = 'DOP' AND currency IS NULL));

\echo '### Q6 page count, bills 1y (CountWithFilters) — every GET /transaction, even cache hits'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT COUNT(*) FROM transactions WHERE user_id = :u AND type_transation = 'bill' AND created_at >= :'y0' AND created_at <= :'y1';

\echo '### Q7 category expenses in range, month (GetCategoryExpensesInRange) — dashboard-summary'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT c.id, c.name, COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.amount * 60 ELSE t.amount END), 0), c.color, COUNT(*)
FROM transactions t JOIN categorys c ON t.category_id = c.id
WHERE t.user_id = :u AND t.type_transation = 'bill' AND (NULLIF('', '') IS NULL OR t.account_id::text = '')
  AND (NULLIF('', '') IS NULL OR t.category_id::text = '') AND ('' = '' OR '' = 'bill')
  AND (NULL::numeric IS NULL OR t.amount >= NULL) AND (NULL::numeric IS NULL OR t.amount <= NULL)
  AND t.created_at >= :'m0' AND t.created_at <= :'m1' GROUP BY c.id, c.name, c.color;

\echo '### Q8 monthly summary in range, 1y (GetMonthlySummaryInRange) — dashboard-summary 1y'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT EXTRACT(YEAR FROM created_at)::int AS year, EXTRACT(MONTH FROM created_at)::int AS month,
  COALESCE(SUM(CASE WHEN type_transation = 'income' AND currency = 'USD' THEN amount * 60 WHEN type_transation = 'income' THEN amount ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN type_transation = 'bill' AND currency = 'USD' THEN amount * 60 WHEN type_transation = 'bill' THEN amount ELSE 0 END), 0)
FROM transactions WHERE user_id = :u AND created_at >= :'y0' AND created_at <= :'y1' GROUP BY year, month ORDER BY year, month;

\echo '### Q9 monthly summary, all time (GetMonthlySummary) — GET /analytics/monthly-summary'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT EXTRACT(YEAR FROM created_at)::int AS year, EXTRACT(MONTH FROM created_at)::int AS month,
  COALESCE(SUM(CASE WHEN type_transation = 'income' THEN amount ELSE 0 END), 0), COALESCE(SUM(CASE WHEN type_transation = 'bill' THEN amount ELSE 0 END), 0)
FROM transactions WHERE user_id = :u GROUP BY year, month ORDER BY year, month;

\echo '### Q10 recent page, month, created_at desc (tx_recent / dashboard findAllSimple)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, transaction_name, amount, created_at FROM transactions
WHERE user_id = :u AND created_at >= :'m0' AND created_at <= :'m1' ORDER BY created_at DESC, id DESC LIMIT 100;

\echo '### Q11 single budget spent (FindCurrentBudget) — budget alert goroutine after each bill'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * 60 ELSE amount END), 0) FROM transactions
WHERE budget_id = 'pb0000000000000000000000004' AND user_id = :u AND type_transation = 'bill'
  AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE);

\echo '### Q12 auth user lookup (UserRepository.FindUserById) — every authenticated request'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT id, name, last_name, email, password, confirmed, is_demo, COALESCE(ip_address, ''), role, created_at FROM users WHERE id = :u AND deleted_at IS NULL;
