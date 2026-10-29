-- PostgreSQL cannot drop enum values, so card_payment_received stays on
-- TypeTransaction. Restoring the old balance rule while such rows exist would
-- make account_balances disagree with the ledger, so refuse.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM transactions WHERE type_transation::text = 'card_payment_received') THEN
        RAISE EXCEPTION 'card_payment_received transactions exist; roll back migration 000060 first';
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
