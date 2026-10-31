-- ============================================================
-- Migration 000059: card_payment_received
--
-- A credit card's debt becomes the ledger balance of its account (migration
-- 000060 moves card_balances.current_balance into the ledger). A card payment
-- then writes two transactions: card_payment on the paying account (money
-- out, as before) and card_payment_received on the card account (debt down).
-- Like card_payment it is neutral in reports: analytics only counts 'income'
-- and 'bill'.
--
-- The new enum value is added in its own migration: PostgreSQL does not allow
-- using a value in the transaction that adds it, and 000060 inserts rows with
-- it. fn_transaction_balance_effect compares the type as text, so it can name
-- the value here.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction'
        AND e.enumlabel = 'card_payment_received'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'card_payment_received';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_transaction_balance_effect(t_type TypeTransaction, t_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN t_type::text IN ('income', 'loan_collection', 'loan_cancellation_refund', 'adjustment_in', 'card_payment_received') THEN t_amount
        ELSE -t_amount
    END
$$;
