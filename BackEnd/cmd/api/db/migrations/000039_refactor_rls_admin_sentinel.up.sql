-- Refactor RLS admin sentinel: replace '__admin__' string in app.current_user_id
-- with a dedicated boolean setting app.is_admin.
-- The RLSMiddleware now calls:
--   set_config('app.current_user_id', userID, true)
--   set_config('app.is_admin', 'true'/'false', true)
-- This eliminates the fragile string sentinel pattern.

-- ── Direct user_id tables ────────────────────────────────────────────────────

DROP POLICY IF EXISTS account_isolation ON account;
CREATE POLICY account_isolation ON account
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS transactions_isolation ON transactions;
CREATE POLICY transactions_isolation ON transactions
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS categorys_isolation ON categorys;
CREATE POLICY categorys_isolation ON categorys
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS budgets_isolation ON budgets;
CREATE POLICY budgets_isolation ON budgets
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS investments_isolation ON investments;
CREATE POLICY investments_isolation ON investments
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS recurring_transactions_isolation ON recurring_transactions;
CREATE POLICY recurring_transactions_isolation ON recurring_transactions
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS notifications_isolation ON notifications;
CREATE POLICY notifications_isolation ON notifications
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS savings_goals_isolation ON savings_goals;
CREATE POLICY savings_goals_isolation ON savings_goals
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS reconciliation_sessions_isolation ON reconciliation_sessions;
CREATE POLICY reconciliation_sessions_isolation ON reconciliation_sessions
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS certificates_isolation ON certificates;
CREATE POLICY certificates_isolation ON certificates
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS certificate_payments_isolation ON certificate_payments;
CREATE POLICY certificate_payments_isolation ON certificate_payments
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS investment_funding_balances_isolation ON investment_funding_balances;
CREATE POLICY investment_funding_balances_isolation ON investment_funding_balances
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS investment_funding_movements_isolation ON investment_funding_movements;
CREATE POLICY investment_funding_movements_isolation ON investment_funding_movements
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS loans_isolation ON loans;
CREATE POLICY loans_isolation ON loans
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS feature_flag_user_overrides_isolation ON feature_flag_user_overrides;
CREATE POLICY feature_flag_user_overrides_isolation ON feature_flag_user_overrides
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

DROP POLICY IF EXISTS feature_flag_audit_logs_isolation ON feature_flag_audit_logs;
CREATE POLICY feature_flag_audit_logs_isolation ON feature_flag_audit_logs
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');

-- ── JOIN-based policies (no direct user_id) ─────────────────────────────────

DROP POLICY IF EXISTS loan_installments_isolation ON loan_installments;
CREATE POLICY loan_installments_isolation ON loan_installments
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = loan_installments.loan_id
              AND loans.user_id = current_setting('app.current_user_id', true)
        ));

DROP POLICY IF EXISTS loan_payments_isolation ON loan_payments;
CREATE POLICY loan_payments_isolation ON loan_payments
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = loan_payments.loan_id
              AND loans.user_id = current_setting('app.current_user_id', true)
        ));

DROP POLICY IF EXISTS credit_cards_isolation ON credit_cards;
CREATE POLICY credit_cards_isolation ON credit_cards
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM account
            WHERE account.id = credit_cards.account_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

DROP POLICY IF EXISTS card_balances_isolation ON card_balances;
CREATE POLICY card_balances_isolation ON card_balances
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM account
            JOIN credit_cards ON credit_cards.account_id = account.id
            WHERE credit_cards.account_id = card_balances.card_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

DROP POLICY IF EXISTS card_payments_isolation ON card_payments;
CREATE POLICY card_payments_isolation ON card_payments
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM account
            JOIN credit_cards ON credit_cards.account_id = account.id
            WHERE credit_cards.account_id = card_payments.card_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

DROP POLICY IF EXISTS reconciliation_items_isolation ON reconciliation_items;
CREATE POLICY reconciliation_items_isolation ON reconciliation_items
    USING (current_setting('app.is_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM reconciliation_sessions
            WHERE reconciliation_sessions.id = reconciliation_items.session_id
              AND reconciliation_sessions.user_id = current_setting('app.current_user_id', true)
        ));
