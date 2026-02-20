ALTER TABLE card_payments DROP COLUMN IF EXISTS exchange_rate;
ALTER TABLE card_payments DROP COLUMN IF EXISTS source_amount;
ALTER TABLE card_payments DROP COLUMN IF EXISTS source_currency;
