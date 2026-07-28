-- Monthly plan items: the user's fixed monthly commitments (expenses) and
-- expected incomes. Intentionally decoupled from the transactions table: these
-- rows are a planning sheet for visual control and never create real
-- transactions, unlike recurring_transactions.
CREATE TABLE IF NOT EXISTS monthly_plan_items (
    id           VARCHAR PRIMARY KEY,
    user_id      VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    amount       NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency     VARCHAR(3) NOT NULL DEFAULT 'DOP' CHECK (currency IN ('DOP', 'USD')),
    type         VARCHAR(50) NOT NULL CHECK (type IN ('income', 'bill')),
    category_id  VARCHAR REFERENCES categorys(id) ON DELETE SET NULL,
    account_id   VARCHAR REFERENCES account(id) ON DELETE SET NULL,
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monthly_plan_items_user_id ON monthly_plan_items(user_id);
CREATE INDEX idx_monthly_plan_items_user_active ON monthly_plan_items(user_id, type) WHERE is_active;
