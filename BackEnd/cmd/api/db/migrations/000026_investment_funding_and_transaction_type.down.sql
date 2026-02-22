ALTER TABLE investments DROP CONSTRAINT IF EXISTS fk_investments_source_account;

ALTER TABLE investments
    DROP COLUMN IF EXISTS exchange_rate,
    DROP COLUMN IF EXISTS settlement_currency,
    DROP COLUMN IF EXISTS source_amount,
    DROP COLUMN IF EXISTS source_account_id;

-- PostgreSQL enum values cannot be safely removed in a reversible way.
