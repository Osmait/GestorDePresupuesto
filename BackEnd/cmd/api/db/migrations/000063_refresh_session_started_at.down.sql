ALTER TABLE mcp_oauth_tokens DROP COLUMN IF EXISTS session_started_at;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS session_started_at;
