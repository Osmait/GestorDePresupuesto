-- WebAuthn ceremony state (challenge + session data) shared by every API
-- instance. Rows are single-use (consumed with DELETE ... RETURNING) and
-- expire after WEBAUTHN_CHALLENGE_TTL.
--
-- No RLS: the login ceremony is anonymous (no app.current_user_id yet) and
-- rows are only reachable by their unguessable random id.
CREATE TABLE webauthn_sessions (
    id VARCHAR(64) PRIMARY KEY,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('register', 'login')),
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webauthn_sessions_expires_at ON webauthn_sessions(expires_at);
