CREATE TABLE IF NOT EXISTS reconciliation_sessions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    account_id VARCHAR NOT NULL,
    document_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'previewed',
    extracted_count INT NOT NULL DEFAULT 0,
    exact_count INT NOT NULL DEFAULT 0,
    similar_count INT NOT NULL DEFAULT 0,
    unmatched_count INT NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (account_id) REFERENCES account (id)
);

CREATE TABLE IF NOT EXISTS reconciliation_items (
    id VARCHAR(32) PRIMARY KEY,
    session_id VARCHAR(32) NOT NULL,
    extracted_transaction_id VARCHAR(32) NOT NULL,
    extracted_data JSONB NOT NULL,
    candidate_data JSONB NOT NULL,
    match_status VARCHAR(20) NOT NULL,
    score DOUBLE PRECISION NOT NULL DEFAULT 0,
    action VARCHAR(20) NOT NULL DEFAULT 'pending',
    linked_transaction_id VARCHAR(32),
    created_transaction_id VARCHAR(32),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (session_id) REFERENCES reconciliation_sessions (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_items_session_extracted
    ON reconciliation_items (session_id, extracted_transaction_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_sessions_user_created
    ON reconciliation_sessions (user_id, created_at DESC);
