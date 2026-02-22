DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction' AND e.enumlabel = 'investment_purchase'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'investment_purchase';
    END IF;
END$$;

ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS source_account_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settlement_currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS exchange_rate DOUBLE PRECISION;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_investments_source_account'
    ) THEN
        ALTER TABLE investments
            ADD CONSTRAINT fk_investments_source_account
            FOREIGN KEY (source_account_id) REFERENCES account(id) ON DELETE SET NULL;
    END IF;
END$$;
