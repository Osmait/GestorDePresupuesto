-- Add missing user_id indexes for tables that filter by user frequently
CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);
CREATE INDEX IF NOT EXISTS idx_categorys_user_id ON categorys(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_user ON budgets(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
