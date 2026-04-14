CREATE TABLE passkeys (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id BYTEA NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    sign_count BIGINT NOT NULL DEFAULT 0,
    aaguid BYTEA,
    transports TEXT[],
    name VARCHAR(100) NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_passkeys_user ON passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON passkeys(credential_id);

ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkeys FORCE ROW LEVEL SECURITY;
CREATE POLICY passkeys_isolation ON passkeys
    USING (current_setting('app.is_admin', true) = 'true'
        OR user_id = current_setting('app.current_user_id', true));

INSERT INTO feature_flags (key, name, description, default_enabled, scope)
VALUES ('passkeys_enabled', 'Passkeys Login', 'Enable WebAuthn/passkey authentication endpoints and UI.', false, 'both')
ON CONFLICT (key) DO NOTHING;
