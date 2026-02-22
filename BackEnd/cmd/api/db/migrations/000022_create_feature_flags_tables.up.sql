CREATE TABLE IF NOT EXISTS feature_flags (
    key VARCHAR(100) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    default_enabled BOOLEAN NOT NULL DEFAULT false,
    scope VARCHAR(20) NOT NULL DEFAULT 'both',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flag_user_overrides (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    feature_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL,
    updated_by_admin_id VARCHAR,
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (feature_key) REFERENCES feature_flags (key) ON DELETE CASCADE,
    FOREIGN KEY (updated_by_admin_id) REFERENCES users (id) ON DELETE SET NULL,
    UNIQUE (user_id, feature_key)
);

CREATE TABLE IF NOT EXISTS feature_flag_audit_logs (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    feature_key VARCHAR(100) NOT NULL,
    old_value BOOLEAN,
    new_value BOOLEAN,
    changed_by_admin_id VARCHAR,
    reason TEXT,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (feature_key) REFERENCES feature_flags (key) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_admin_id) REFERENCES users (id) ON DELETE SET NULL
);

INSERT INTO feature_flags (key, name, description, default_enabled, scope)
VALUES
    ('ai_extraction', 'AI Extraction', 'Extract transactions from document files.', true, 'both'),
    ('ai_category_suggestions', 'AI Category Suggestions', 'Suggest categories based on transaction context.', true, 'both'),
    ('ai_duplicate_detection', 'AI Duplicate Detection', 'Detect possible duplicate transactions in extraction.', true, 'both'),
    ('ai_reconciliation', 'AI Reconciliation', 'Enable reconciliation preview and apply workflows.', true, 'both'),
    ('ai_savings_plan', 'AI Savings Plan', 'Enable savings plan calculation feature.', true, 'both'),
    ('ai_savings_goals_crud', 'AI Savings Goals', 'Enable savings goals create/update/delete and progress.', true, 'both')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_feature_flags_scope ON feature_flags (scope);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_user ON feature_flag_user_overrides (user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_user_time ON feature_flag_audit_logs (user_id, created_at DESC);
