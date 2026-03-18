-- Enable Row Level Security on all user-owned tables.
-- App sets: SET LOCAL app.current_user_id = '<user-id>' per request.
-- Admin operations use sentinel '__admin__'.
-- Background workers use BYPASSRLS privilege on the DB role.

-- Grant BYPASSRLS to the application role so background workers are unaffected.
-- Conditional: the role may not exist in test/CI environments.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'osmait') THEN
        ALTER ROLE osmait BYPASSRLS;
    END IF;
END
$$;

-- ── Direct user_id tables ────────────────────────────────────────────────────

ALTER TABLE account ENABLE ROW LEVEL SECURITY;
ALTER TABLE account FORCE ROW LEVEL SECURITY;
CREATE POLICY account_isolation ON account
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY transactions_isolation ON transactions
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE categorys ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorys FORCE ROW LEVEL SECURITY;
CREATE POLICY categorys_isolation ON categorys
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY budgets_isolation ON budgets
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments FORCE ROW LEVEL SECURITY;
CREATE POLICY investments_isolation ON investments
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY recurring_transactions_isolation ON recurring_transactions
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_isolation ON notifications
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals FORCE ROW LEVEL SECURITY;
CREATE POLICY savings_goals_isolation ON savings_goals
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY reconciliation_sessions_isolation ON reconciliation_sessions
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates FORCE ROW LEVEL SECURITY;
CREATE POLICY certificates_isolation ON certificates
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE certificate_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY certificate_payments_isolation ON certificate_payments
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE investment_funding_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_funding_balances FORCE ROW LEVEL SECURITY;
CREATE POLICY investment_funding_balances_isolation ON investment_funding_balances
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE investment_funding_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_funding_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY investment_funding_movements_isolation ON investment_funding_movements
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans FORCE ROW LEVEL SECURITY;
CREATE POLICY loans_isolation ON loans
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE feature_flag_user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_user_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY feature_flag_user_overrides_isolation ON feature_flag_user_overrides
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

ALTER TABLE feature_flag_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY feature_flag_audit_logs_isolation ON feature_flag_audit_logs
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');

-- ── JOIN-based policies (no direct user_id) ─────────────────────────────────

ALTER TABLE loan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_installments FORCE ROW LEVEL SECURITY;
CREATE POLICY loan_installments_isolation ON loan_installments
    USING (current_setting('app.current_user_id', true) = '__admin__'
        OR EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = loan_installments.loan_id
              AND loans.user_id = current_setting('app.current_user_id', true)
        ));

ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY loan_payments_isolation ON loan_payments
    USING (current_setting('app.current_user_id', true) = '__admin__'
        OR EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = loan_payments.loan_id
              AND loans.user_id = current_setting('app.current_user_id', true)
        ));

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards FORCE ROW LEVEL SECURITY;
CREATE POLICY credit_cards_isolation ON credit_cards
    USING (current_setting('app.current_user_id', true) = '__admin__'
        OR EXISTS (
            SELECT 1 FROM account
            WHERE account.id = credit_cards.account_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

ALTER TABLE card_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_balances FORCE ROW LEVEL SECURITY;
CREATE POLICY card_balances_isolation ON card_balances
    USING (current_setting('app.current_user_id', true) = '__admin__'
        OR EXISTS (
            SELECT 1 FROM account
            JOIN credit_cards ON credit_cards.account_id = account.id
            WHERE credit_cards.account_id = card_balances.card_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

ALTER TABLE card_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY card_payments_isolation ON card_payments
    USING (current_setting('app.current_user_id', true) = '__admin__'
        OR EXISTS (
            SELECT 1 FROM account
            JOIN credit_cards ON credit_cards.account_id = account.id
            WHERE credit_cards.account_id = card_payments.card_id
              AND account.user_id = current_setting('app.current_user_id', true)
        ));

ALTER TABLE reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_items FORCE ROW LEVEL SECURITY;
CREATE POLICY reconciliation_items_isolation ON reconciliation_items
    USING (current_setting('app.current_user_id', true) = '__admin__'
        OR EXISTS (
            SELECT 1 FROM reconciliation_sessions
            WHERE reconciliation_sessions.id = reconciliation_items.session_id
              AND reconciliation_sessions.user_id = current_setting('app.current_user_id', true)
        ));
