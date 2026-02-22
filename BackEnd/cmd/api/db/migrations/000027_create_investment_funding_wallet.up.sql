DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'typetransaction' AND e.enumlabel = 'investment_funding'
    ) THEN
        ALTER TYPE TypeTransaction ADD VALUE 'investment_funding';
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS investment_funding_balances (
    user_id VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    available_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, currency),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS investment_funding_movements (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    movement_type VARCHAR(30) NOT NULL,
    description TEXT,
    reference_type VARCHAR(40),
    reference_id VARCHAR(255),
    counter_currency VARCHAR(10),
    counter_amount DOUBLE PRECISION,
    exchange_rate DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_investment_funding_movements_user_created_at
    ON investment_funding_movements(user_id, created_at DESC);
