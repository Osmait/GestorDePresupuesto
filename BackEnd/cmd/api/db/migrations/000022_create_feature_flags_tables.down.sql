DROP INDEX IF EXISTS idx_feature_flag_audit_user_time;
DROP INDEX IF EXISTS idx_feature_flag_overrides_user;
DROP INDEX IF EXISTS idx_feature_flags_scope;

DROP TABLE IF EXISTS feature_flag_audit_logs;
DROP TABLE IF EXISTS feature_flag_user_overrides;
DROP TABLE IF EXISTS feature_flags;
