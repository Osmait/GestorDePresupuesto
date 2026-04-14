-- Store the full go-webauthn Credential struct as JSON so the login ceremony
-- can reconstruct it exactly (flags, attestation type, authenticator data...).
-- The individual columns (public_key, sign_count, aaguid, transports) remain
-- as an index-friendly denormalisation.
ALTER TABLE passkeys ADD COLUMN credential_json JSONB;
