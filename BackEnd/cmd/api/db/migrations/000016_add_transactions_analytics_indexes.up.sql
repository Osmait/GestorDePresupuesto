CREATE INDEX IF NOT EXISTS idx_transactions_user_created_at ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_created_at ON transactions(user_id, type_transation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category_created_at ON transactions(user_id, category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_created_at ON transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_budget_created_at ON transactions(budget_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_currency_created_at ON transactions(user_id, currency, created_at DESC);
