CREATE TABLE IF NOT EXISTS feature_flag_global_overrides (
    feature_key VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN NOT NULL,
    updated_by_admin_id VARCHAR,
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (feature_key) REFERENCES feature_flags (key) ON DELETE CASCADE,
    FOREIGN KEY (updated_by_admin_id) REFERENCES users (id) ON DELETE SET NULL
);

ALTER TABLE feature_flag_audit_logs
    ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS target_user_id VARCHAR;

ALTER TABLE feature_flag_audit_logs
    ALTER COLUMN user_id DROP NOT NULL;

UPDATE feature_flag_audit_logs
SET target_user_id = user_id
WHERE target_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_feature_flag_global_overrides_key ON feature_flag_global_overrides (feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_scope_time ON feature_flag_audit_logs (scope, created_at DESC);
