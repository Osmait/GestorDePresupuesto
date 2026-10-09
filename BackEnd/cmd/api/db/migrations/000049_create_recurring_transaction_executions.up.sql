-- One row per executed occurrence of a recurring transaction. The primary key
-- (recurring_transaction_id, execution_date) is the DB-level idempotency guard:
-- even if two scheduler runs race, an occurrence can only produce one
-- transaction because the second INSERT conflicts inside the same DB
-- transaction that creates the money movement.
CREATE TABLE IF NOT EXISTS recurring_transaction_executions (
    recurring_transaction_id VARCHAR NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
    execution_date           DATE    NOT NULL,
    user_id                  VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id           VARCHAR REFERENCES transactions(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (recurring_transaction_id, execution_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_transaction_executions_user_id
    ON recurring_transaction_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transaction_executions_transaction_id
    ON recurring_transaction_executions(transaction_id);

ALTER TABLE recurring_transaction_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transaction_executions FORCE ROW LEVEL SECURITY;
CREATE POLICY recurring_transaction_executions_isolation ON recurring_transaction_executions
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.is_admin', true) = 'true');
