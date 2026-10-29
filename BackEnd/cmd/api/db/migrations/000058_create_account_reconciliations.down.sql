-- PostgreSQL cannot drop enum values, so adjustment_in/adjustment_out stay on
-- TypeTransaction. Restoring the old balance rule while adjustment_in rows
-- exist would make account_balances disagree with the ledger, so refuse.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM transactions WHERE type_transation::text IN ('adjustment_in', 'adjustment_out')) THEN
        RAISE EXCEPTION 'adjustment transactions exist; delete them before rolling back migration 000058';
    END IF;
END $$;

DROP TABLE IF EXISTS account_reconciliations;

CREATE OR REPLACE FUNCTION fn_transaction_balance_effect(t_type TypeTransaction, t_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN t_type::text IN ('income', 'loan_collection', 'loan_cancellation_refund') THEN t_amount
        ELSE -t_amount
    END
$$;
