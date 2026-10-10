DROP TRIGGER IF EXISTS transactions_truncate_balances ON transactions;
DROP TRIGGER IF EXISTS transactions_maintain_balance_upd ON transactions;
DROP TRIGGER IF EXISTS transactions_maintain_balance_ins_del ON transactions;
DROP FUNCTION IF EXISTS fn_transactions_truncate_balances();
DROP FUNCTION IF EXISTS fn_transactions_maintain_balance();
DROP FUNCTION IF EXISTS fn_account_balance_add(VARCHAR, VARCHAR, VARCHAR, NUMERIC);
DROP FUNCTION IF EXISTS fn_transaction_balance_effect(TypeTransaction, NUMERIC);
DROP TABLE IF EXISTS account_balances;
