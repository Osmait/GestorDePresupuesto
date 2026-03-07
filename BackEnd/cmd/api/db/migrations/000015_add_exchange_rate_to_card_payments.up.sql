ALTER TABLE card_payments ADD COLUMN IF NOT EXISTS source_currency VARCHAR(3);
ALTER TABLE card_payments ADD COLUMN IF NOT EXISTS source_amount DECIMAL(15,2);
ALTER TABLE card_payments ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15,6);
