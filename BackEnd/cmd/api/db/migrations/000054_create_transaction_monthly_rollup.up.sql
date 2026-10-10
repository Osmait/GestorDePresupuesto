-- ============================================================
-- Migration 000054: per-user monthly analytics rollup
--
-- transaction_monthly_rollup holds SUM(amount) and COUNT(*) of transactions
-- per (user, month, category, type, currency). The analytics endpoints read
-- it instead of scanning the whole ledger (all-time category expenses and
-- monthly summary; the full months of dashboard ranges).
--
-- Month = calendar month of created_at in UTC. That is exactly how the
-- analytics queries bucket today (EXTRACT(... FROM created_at) in the session
-- time zone, which is the server default, UTC; the DSN sets none). The Go
-- repository only reads the rollup when the session TimeZone is UTC and falls
-- back to the ledger queries otherwise.
-- currency: NULL is stored as '' (no query treats NULL as 'DOP' or 'USD').
--
-- Maintained by statement-level AFTER INSERT/UPDATE/DELETE triggers on
-- transactions, in the same transaction as the write. Each statement's delta
-- is aggregated per key from the transition tables and applied in key order
-- (deterministic row-lock order -> no deadlocks between two statements that
-- touch the same keys). Rows whose count drops to 0 are deleted.
--
-- RLS: same isolation policy as the other user-owned tables (FORCE RLS). The
-- trigger function is SECURITY DEFINER (works whatever grants the writing
-- role has) and still subject to the policy when its owner does not bypass
-- RLS: it only touches rows of the user_id of the transaction rows being
-- written, which already passed the transactions policy with the same
-- settings.
--
-- Locks: CREATE TRIGGER takes SHARE ROW EXCLUSIVE on transactions until this
-- migration commits, so writes to transactions wait for the backfill below
-- (reads are not blocked). That lock is also what makes the backfill exact: no
-- concurrent write can commit between the trigger creation and the backfill
-- snapshot.
-- ============================================================

-- Fail fast instead of queueing behind long transactions (and making every
-- later writer queue behind this migration). Transaction-local.
SELECT set_config('lock_timeout', '10s', true);

CREATE TABLE transaction_monthly_rollup (
    user_id         VARCHAR         NOT NULL,
    month           DATE            NOT NULL,
    category_id     VARCHAR         NOT NULL,
    type_transation TypeTransaction NOT NULL,
    currency        VARCHAR(3)      NOT NULL,
    amount_sum      NUMERIC         NOT NULL,
    tx_count        BIGINT          NOT NULL,
    PRIMARY KEY (user_id, month, category_id, type_transation, currency)
);

ALTER TABLE transaction_monthly_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_monthly_rollup FORCE ROW LEVEL SECURITY;
CREATE POLICY transaction_monthly_rollup_isolation ON transaction_monthly_rollup
    USING (user_id = (SELECT current_setting('app.current_user_id', true))
        OR (SELECT current_setting('app.is_admin', true)) = 'true');

CREATE FUNCTION fn_transaction_monthly_rollup()
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
               (date_trunc('month', n.created_at AT TIME ZONE 'UTC'))::date,
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
                   (date_trunc('month', n.created_at AT TIME ZONE 'UTC'))::date AS month,
                   n.category_id, n.type_transation, COALESCE(n.currency, '') AS currency,
                   n.amount, 1 AS cnt
            FROM rollup_new n
            UNION ALL
            SELECT o.user_id,
                   (date_trunc('month', o.created_at AT TIME ZONE 'UTC'))::date,
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
                      (date_trunc('month', o.created_at AT TIME ZONE 'UTC'))::date AS month,
                      o.category_id, o.type_transation, COALESCE(o.currency, '') AS currency
               FROM rollup_old o) k
        WHERE r.tx_count = 0
          AND r.user_id = k.user_id AND r.month = k.month AND r.category_id = k.category_id
          AND r.type_transation = k.type_transation AND r.currency = k.currency;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO transaction_monthly_rollup AS r
            (user_id, month, category_id, type_transation, currency, amount_sum, tx_count)
        SELECT o.user_id,
               (date_trunc('month', o.created_at AT TIME ZONE 'UTC'))::date,
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
                      (date_trunc('month', o.created_at AT TIME ZONE 'UTC'))::date AS month,
                      o.category_id, o.type_transation, COALESCE(o.currency, '') AS currency
               FROM rollup_old o) k
        WHERE r.tx_count = 0
          AND r.user_id = k.user_id AND r.month = k.month AND r.category_id = k.category_id
          AND r.type_transation = k.type_transation AND r.currency = k.currency;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER transactions_rollup_insert
    AFTER INSERT ON transactions
    REFERENCING NEW TABLE AS rollup_new
    FOR EACH STATEMENT EXECUTE FUNCTION fn_transaction_monthly_rollup();

CREATE TRIGGER transactions_rollup_update
    AFTER UPDATE ON transactions
    REFERENCING OLD TABLE AS rollup_old NEW TABLE AS rollup_new
    FOR EACH STATEMENT EXECUTE FUNCTION fn_transaction_monthly_rollup();

CREATE TRIGGER transactions_rollup_delete
    AFTER DELETE ON transactions
    REFERENCING OLD TABLE AS rollup_old
    FOR EACH STATEMENT EXECUTE FUNCTION fn_transaction_monthly_rollup();

-- Backfill. The migration role may be subject to FORCE RLS (owner without
-- BYPASSRLS): app.is_admin makes every row visible for this transaction only.
SELECT set_config('app.is_admin', 'true', true);

INSERT INTO transaction_monthly_rollup
    (user_id, month, category_id, type_transation, currency, amount_sum, tx_count)
SELECT user_id,
       (date_trunc('month', created_at AT TIME ZONE 'UTC'))::date,
       category_id, type_transation, COALESCE(currency, ''),
       SUM(amount), COUNT(*)
FROM transactions
GROUP BY 1, 2, 3, 4, 5;

ANALYZE transaction_monthly_rollup;
