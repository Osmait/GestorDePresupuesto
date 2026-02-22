CREATE TABLE IF NOT EXISTS savings_goals (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    name VARCHAR(120) NOT NULL,
    target_amount DOUBLE PRECISION NOT NULL,
    current_saved DOUBLE PRECISION NOT NULL DEFAULT 0,
    target_date timestamptz,
    account_id VARCHAR,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (account_id) REFERENCES account (id)
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_created
    ON savings_goals (user_id, created_at DESC);
