-- ============================================================
-- Migration 000063: absolute lifetime of refresh sessions
--
-- Every refresh-token rotation used to issue a fresh expiry, so a stolen
-- refresh token that keeps rotating never died. session_started_at is when
-- the session (the login) began; rotated tokens inherit it and the backend
-- refuses to rotate past REFRESH_SESSION_MAX_AGE (default 30 days).
--
-- refresh_tokens: a session is a rotation chain (replaced_by points at the
-- next token). Existing rows get the created_at of the first token of their
-- chain. mcp_oauth_tokens keeps only the live token of a grant (a refresh
-- deletes the old row), so existing rows start their session at created_at.
--
-- Neither table has row level security (see 000010 and 000057).
-- ============================================================

ALTER TABLE refresh_tokens ADD COLUMN session_started_at TIMESTAMPTZ;

WITH RECURSIVE chain AS (
    SELECT t.id, t.created_at AS session_started_at
    FROM refresh_tokens t
    WHERE NOT EXISTS (SELECT 1 FROM refresh_tokens p WHERE p.replaced_by = t.id)
    UNION ALL
    SELECT n.id, c.session_started_at
    FROM chain c
    JOIN refresh_tokens p ON p.id = c.id
    JOIN refresh_tokens n ON n.id = p.replaced_by
)
UPDATE refresh_tokens t
SET session_started_at = chain.session_started_at
FROM chain
WHERE chain.id = t.id;

-- Rows of a cycle (impossible in practice) or otherwise missed.
UPDATE refresh_tokens SET session_started_at = created_at WHERE session_started_at IS NULL;

ALTER TABLE refresh_tokens
    ALTER COLUMN session_started_at SET DEFAULT now(),
    ALTER COLUMN session_started_at SET NOT NULL;

ALTER TABLE mcp_oauth_tokens ADD COLUMN session_started_at TIMESTAMPTZ;
UPDATE mcp_oauth_tokens SET session_started_at = created_at;
ALTER TABLE mcp_oauth_tokens
    ALTER COLUMN session_started_at SET DEFAULT now(),
    ALTER COLUMN session_started_at SET NOT NULL;
