-- ============================================================
-- Migration 000062: calendar months in the app time zone
--
-- Transactions are instants (timestamptz). Their calendar day and month are
-- those of the app time zone (APP_TIMEZONE, America/Santo_Domingo), not UTC:
-- a bill paid on Oct 31 at 21:30 in Santo Domingo is 2026-11-01T01:30Z and
-- belongs to October.
--
-- app_timezone() is that zone for SQL. Queries use it to cut months/days, e.g.
-- the start of the current local month as timestamptz:
--   date_trunc('month', now() AT TIME ZONE app_timezone()) AT TIME ZONE app_timezone()
-- It must match the backend's APP_TIMEZONE; the backend logs a warning at
-- startup when they differ (and the analytics repository then aggregates the
-- ledger instead of this rollup). To change the zone, replace this function in
-- a new migration and rebuild the rollup like below.
--
-- transaction_monthly_rollup (000054) bucketed months in UTC; its trigger
-- function now buckets in app_timezone() and the table is rebuilt.
-- ============================================================

-- Fail fast instead of queueing behind long transactions (and making every
-- later writer queue behind this migration). Transaction-local.
SELECT set_config('lock_timeout', '10s', true);

CREATE OR REPLACE FUNCTION app_timezone()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT 'America/Santo_Domingo'::text $$;

CREATE OR REPLACE FUNCTION fn_transaction_monthly_rollup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path FROM CURRENT
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO transaction_monthly_rollup AS r
            (user_id, month, category_id, type_transation, currency, amount_sum, tx_count)
        SELECT n.user_id,
               (date_trunc('month', n.created_at AT TIME ZONE app_timezone()))::date,
               n.category_id, n.type_transation, COALESCE(n.currency, ''),
               SUM(n.amount), COUNT(*)
        FROM rollup_new n
        GROUP BY 1, 2, 3, 4, 5
        ORDER BY 1, 2, 3, 4, 5
        ON CONFLICT (user_id, month, category_id, type_transation, currency) DO UPDATE
            SET amount_sum = r.amount_sum + EXCLUDED.amount_sum,
                tx_count   = r.tx_count + EXCLUDED.tx_count;

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO transaction_monthly_rollup AS r
            (user_id, month, category_id, type_transation, currency, amount_sum, tx_count)
        SELECT d.user_id, d.month, d.category_id, d.type_transation, d.currency,
               SUM(d.amount), SUM(d.cnt)
        FROM (
            SELECT n.user_id,
                   (date_trunc('month', n.created_at AT TIME ZONE app_timezone()))::date AS month,
                   n.category_id, n.type_transation, COALESCE(n.currency, '') AS currency,
                   n.amount, 1 AS cnt
            FROM rollup_new n
            UNION ALL
            SELECT o.user_id,
                   (date_trunc('month', o.created_at AT TIME ZONE app_timezone()))::date,
                   o.category_id, o.type_transation, COALESCE(o.currency, ''),
                   -o.amount, -1
            FROM rollup_old o
        ) d
        GROUP BY 1, 2, 3, 4, 5
        -- rows whose key and amount did not change cancel out: no rollup write
        HAVING SUM(d.amount) <> 0 OR SUM(d.cnt) <> 0
        ORDER BY 1, 2, 3, 4, 5
        ON CONFLICT (user_id, month, category_id, type_transation, currency) DO UPDATE
            SET amount_sum = r.amount_sum + EXCLUDED.amount_sum,
                tx_count   = r.tx_count + EXCLUDED.tx_count;

        DELETE FROM transaction_monthly_rollup r
        USING (SELECT DISTINCT o.user_id,
                      (date_trunc('month', o.created_at AT TIME ZONE app_timezone()))::date AS month,
                      o.category_id, o.type_transation, COALESCE(o.currency, '') AS currency
               FROM rollup_old o) k
        WHERE r.tx_count = 0
          AND r.user_id = k.user_id AND r.month = k.month AND r.category_id = k.category_id
          AND r.type_transation = k.type_transation AND r.currency = k.currency;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO transaction_monthly_rollup AS r
            (user_id, month, category_id, type_transation, currency, amount_sum, tx_count)
        SELECT o.user_id,
               (date_trunc('month', o.created_at AT TIME ZONE app_timezone()))::date,
               o.category_id, o.type_transation, COALESCE(o.currency, ''),
               -SUM(o.amount), -COUNT(*)
        FROM rollup_old o
        GROUP BY 1, 2, 3, 4, 5
        ORDER BY 1, 2, 3, 4, 5
        ON CONFLICT (user_id, month, category_id, type_transation, currency) DO UPDATE
            SET amount_sum = r.amount_sum + EXCLUDED.amount_sum,
                tx_count   = r.tx_count + EXCLUDED.tx_count;

        DELETE FROM transaction_monthly_rollup r
        USING (SELECT DISTINCT o.user_id,
                      (date_trunc('month', o.created_at AT TIME ZONE app_timezone()))::date AS month,
                      o.category_id, o.type_transation, COALESCE(o.currency, '') AS currency
               FROM rollup_old o) k
        WHERE r.tx_count = 0
          AND r.user_id = k.user_id AND r.month = k.month AND r.category_id = k.category_id
          AND r.type_transation = k.type_transation AND r.currency = k.currency;
    END IF;

    RETURN NULL;
END;
$$;

-- Rebuild the rollup from the ledger. LOCK first: writes to transactions wait
-- until this migration commits (reads do not), so no write can commit between
-- the snapshot below and the new trigger function. The migration role may be
-- subject to FORCE RLS (owner without BYPASSRLS): app.is_admin makes every row
-- visible for this transaction only (same as the 000054 backfill).
LOCK TABLE transactions IN SHARE ROW EXCLUSIVE MODE;
SELECT set_config('app.is_admin', 'true', true);

DELETE FROM transaction_monthly_rollup;

INSERT INTO transaction_monthly_rollup
    (user_id, month, category_id, type_transation, currency, amount_sum, tx_count)
SELECT user_id,
       (date_trunc('month', created_at AT TIME ZONE app_timezone()))::date,
       category_id, type_transation, COALESCE(currency, ''),
       SUM(amount), COUNT(*)
FROM transactions
GROUP BY 1, 2, 3, 4, 5;

ANALYZE transaction_monthly_rollup;
