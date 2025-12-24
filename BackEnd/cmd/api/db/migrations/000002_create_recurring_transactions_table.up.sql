CREATE TABLE IF NOT EXISTS recurring_transactions (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount NUMERIC(15, 2) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'bill')),
    account_id VARCHAR REFERENCES account(id) ON DELETE SET NULL,
    category_id VARCHAR REFERENCES categorys(id) ON DELETE SET NULL,
    budget_id VARCHAR REFERENCES budgets(id) ON DELETE SET NULL,
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    last_execution_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_transactions_user_id ON recurring_transactions(user_id);
