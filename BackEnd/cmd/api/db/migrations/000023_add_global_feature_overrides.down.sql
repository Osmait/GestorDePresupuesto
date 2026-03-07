DROP INDEX IF EXISTS idx_feature_flag_audit_scope_time;
DROP INDEX IF EXISTS idx_feature_flag_global_overrides_key;

ALTER TABLE feature_flag_audit_logs
    DROP COLUMN IF EXISTS target_user_id,
    DROP COLUMN IF EXISTS scope;

ALTER TABLE feature_flag_audit_logs
    ALTER COLUMN user_id SET NOT NULL;

DROP TABLE IF EXISTS feature_flag_global_overrides;
