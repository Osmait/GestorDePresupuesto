-- ============================================================
-- Migration 000038: Financial Audit Log
-- Captures INSERT/UPDATE/DELETE on key financial tables via
-- PostgreSQL triggers. Uses current_setting('app.current_user_id')
-- set by RLSMiddleware, so the acting user is always recorded.
-- ============================================================

-- Audit log table
CREATE TABLE financial_audit_log (
    id            BIGSERIAL PRIMARY KEY,
    user_id       VARCHAR,
    table_name    VARCHAR(64)  NOT NULL,
    operation     VARCHAR(10)  NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    entity_id     VARCHAR,
    old_data      JSONB,
    new_data      JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_log_user_time    ON financial_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_table_entity ON financial_audit_log(table_name, entity_id);
CREATE INDEX idx_audit_log_created_at   ON financial_audit_log(created_at DESC);

-- ============================================================
-- Trigger function (shared by all tables)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_financial_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id  VARCHAR;
    v_entity_id VARCHAR;
    v_old_data  JSONB;
    v_new_data  JSONB;
BEGIN
    -- Get the acting user from the RLS session variable (set by RLSMiddleware).
    -- Returns NULL if called outside a request context (background workers).
    v_user_id := current_setting('app.current_user_id', true);
    IF v_user_id = '' THEN
        v_user_id := NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_entity_id := NEW.id::VARCHAR;
        v_old_data  := NULL;
        v_new_data  := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_entity_id := NEW.id::VARCHAR;
        v_old_data  := to_jsonb(OLD);
        v_new_data  := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_entity_id := OLD.id::VARCHAR;
        v_old_data  := to_jsonb(OLD);
        v_new_data  := NULL;
    END IF;

    INSERT INTO financial_audit_log(user_id, table_name, operation, entity_id, old_data, new_data)
    VALUES (v_user_id, TG_TABLE_NAME, TG_OP, v_entity_id, v_old_data, v_new_data);

    RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Attach trigger to key financial tables
-- ============================================================

CREATE TRIGGER audit_transactions
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();

CREATE TRIGGER audit_account
    AFTER INSERT OR UPDATE OR DELETE ON account
    FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();

CREATE TRIGGER audit_budgets
    AFTER INSERT OR UPDATE OR DELETE ON budgets
    FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();

CREATE TRIGGER audit_investments
    AFTER INSERT OR UPDATE OR DELETE ON investments
    FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();

CREATE TRIGGER audit_loans
    AFTER INSERT OR UPDATE OR DELETE ON loans
    FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();

CREATE TRIGGER audit_loan_payments
    AFTER INSERT OR UPDATE OR DELETE ON loan_payments
    FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();

CREATE TRIGGER audit_certificates
    AFTER INSERT OR UPDATE OR DELETE ON certificates
    FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();

CREATE TRIGGER audit_certificate_payments
    AFTER INSERT OR UPDATE OR DELETE ON certificate_payments
    FOR EACH ROW EXECUTE FUNCTION fn_financial_audit();
