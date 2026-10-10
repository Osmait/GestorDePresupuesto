DROP TRIGGER IF EXISTS transactions_rollup_insert ON transactions;
DROP TRIGGER IF EXISTS transactions_rollup_update ON transactions;
DROP TRIGGER IF EXISTS transactions_rollup_delete ON transactions;
DROP FUNCTION IF EXISTS fn_transaction_monthly_rollup();
DROP TABLE IF EXISTS transaction_monthly_rollup;
