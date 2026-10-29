-- ============================================================
-- Migration 000058: balance adjustments and account reconciliations
--
-- "Reconciling" an account means the user types the balance their bank shows
-- right now; when it differs from the app's balance the backend writes one
-- adjustment transaction for the difference and records the check here.
--
-- Two new transaction types carry the adjustment, with the same rule as every
-- other type (amount always positive, the type gives the direction):
--   adjustment_in  adds to the account balance
--   adjustment_out subtracts from it
-- They are neutral in reports: the analytics queries only count 'income' and
-- 'bill', so an adjustment is neither income nor expense.
--
-- fn_transaction_balance_effect (migration 000052) compares the type as text,
-- so it can name the new value in the same migration that adds it. It is
-- IMMUTABLE and used only by the account_balances triggers; no existing row
-- has an adjustment type, so stored balances need no backfill.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction'
        AND e.enumlabel = 'adjustment_in'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'adjustment_in';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction'
        AND e.enumlabel = 'adjustment_out'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'adjustment_out';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_transaction_balance_effect(t_type TypeTransaction, t_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN t_type::text IN ('income', 'loan_collection', 'loan_cancellation_refund', 'adjustment_in') THEN t_amount
        ELSE -t_amount
    END
$$;

-- One row per reconciliation, newest last. app_balance is the balance the app
-- had before the adjustment, bank_balance the one the user typed; the
-- adjustment transaction (if any) moves the account by bank_balance -
-- app_balance. Deleting that transaction later keeps the history row
-- (transaction_id becomes NULL).
CREATE TABLE account_reconciliations (
    id             VARCHAR PRIMARY KEY,
    user_id        VARCHAR       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id     VARCHAR       NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    currency       VARCHAR(3)    NOT NULL,
    app_balance    NUMERIC(19,4) NOT NULL,
    bank_balance   NUMERIC(19,4) NOT NULL,
    transaction_id VARCHAR       REFERENCES transactions(id) ON DELETE SET NULL,
    notes          TEXT          NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_reconciliations_account ON account_reconciliations(account_id, created_at DESC);
CREATE INDEX idx_account_reconciliations_user ON account_reconciliations(user_id, created_at DESC);
CREATE INDEX idx_account_reconciliations_transaction ON account_reconciliations(transaction_id) WHERE transaction_id IS NOT NULL;

ALTER TABLE account_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_reconciliations FORCE ROW LEVEL SECURITY;
CREATE POLICY account_reconciliations_isolation ON account_reconciliations
    USING (user_id = (SELECT current_setting('app.current_user_id', true))
        OR (SELECT current_setting('app.is_admin', true)) = 'true');
