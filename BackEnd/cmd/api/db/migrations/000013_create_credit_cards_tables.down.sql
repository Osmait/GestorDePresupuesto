DROP TABLE IF EXISTS card_payments;
DROP TABLE IF EXISTS card_balances;
DROP TABLE IF EXISTS credit_cards;
DROP TYPE IF EXISTS card_payment_status;

ALTER TABLE transactions DROP COLUMN IF EXISTS transaction_type;
ALTER TABLE account DROP COLUMN IF EXISTS account_type;
ALTER TABLE account DROP COLUMN IF EXISTS currency;
