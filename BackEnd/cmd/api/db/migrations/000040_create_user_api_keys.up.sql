CREATE TABLE user_api_keys (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_api_key_user_name UNIQUE(user_id, name)
);

CREATE INDEX idx_user_api_keys_user ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_hash ON user_api_keys(key_hash);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY user_api_keys_isolation ON user_api_keys
    USING (user_id = current_setting('app.current_user_id', true)
        OR current_setting('app.current_user_id', true) = '__admin__');
