-- ============================================================
-- Migration 000057: persistent OAuth 2.1 state for the MCP connector
--
-- The MCP OAuth server (Claude custom connector) used to keep clients,
-- authorization codes and tokens in process memory, so every redeploy
-- disconnected Claude. These tables back the mcpkit oauth2.Storage
-- implementation in internal/platform/storage/postgress/mcpoauth.
--
-- Secrets are never stored in plain text: authorization codes, access
-- tokens, refresh tokens and client secrets are stored as the hex SHA-256 of
-- the value (they are 256-bit random values, so an unsalted hash is enough:
-- there is nothing to brute-force).
--
-- No RLS: the OAuth endpoints run before any user is authenticated and rows
-- are only reachable by an unguessable hash (same model as refresh_tokens
-- and webauthn_sessions). Expired rows are purged by the storage on write.
-- ============================================================

CREATE TABLE mcp_oauth_clients (
    client_id                  VARCHAR(128) PRIMARY KEY,
    -- NULL for public clients (token_endpoint_auth_method = 'none').
    client_secret_hash         CHAR(64),
    client_name                VARCHAR(255) NOT NULL DEFAULT '',
    redirect_uris              JSONB        NOT NULL,
    grant_types                JSONB        NOT NULL DEFAULT '[]'::jsonb,
    response_types             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    token_endpoint_auth_method VARCHAR(32)  NOT NULL DEFAULT 'none',
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE mcp_oauth_authorization_codes (
    code_hash             CHAR(64)     PRIMARY KEY,
    client_id             VARCHAR(128) NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
    redirect_uri          TEXT         NOT NULL,
    scope                 TEXT         NOT NULL DEFAULT '',
    code_challenge        VARCHAR(128) NOT NULL,
    code_challenge_method VARCHAR(16)  NOT NULL DEFAULT '',
    -- OAuth subject: the user's email (MCPAuthMiddleware resolves it to the id).
    subject               VARCHAR(255) NOT NULL,
    -- Set once by the token exchange (UPDATE ... WHERE used_at IS NULL), so a
    -- code can be redeemed only once even by concurrent requests.
    used_at               TIMESTAMPTZ,
    expires_at            TIMESTAMPTZ  NOT NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_oauth_codes_expires_at ON mcp_oauth_authorization_codes(expires_at);
CREATE INDEX idx_mcp_oauth_codes_client_id ON mcp_oauth_authorization_codes(client_id);

CREATE TABLE mcp_oauth_tokens (
    access_token_hash  CHAR(64)     PRIMARY KEY,
    refresh_token_hash CHAR(64)     UNIQUE,
    client_id          VARCHAR(128) NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
    -- Resolved from subject when the token is stored: deleting the user
    -- revokes the token, and a later account reusing the email cannot
    -- inherit it.
    user_id            VARCHAR      REFERENCES users(id) ON DELETE CASCADE,
    subject            VARCHAR(255) NOT NULL,
    scope              TEXT         NOT NULL DEFAULT '',
    token_type         VARCHAR(16)  NOT NULL DEFAULT 'Bearer',
    expires_at         TIMESTAMPTZ  NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    -- When neither the access nor the refresh token is usable any more.
    purge_after        TIMESTAMPTZ  NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_oauth_tokens_client_id ON mcp_oauth_tokens(client_id);
CREATE INDEX idx_mcp_oauth_tokens_user_id ON mcp_oauth_tokens(user_id);
CREATE INDEX idx_mcp_oauth_tokens_purge_after ON mcp_oauth_tokens(purge_after);
