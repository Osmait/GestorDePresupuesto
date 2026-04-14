package passkey

import "time"

// Passkey represents a WebAuthn credential enrolled by a user. The
// CredentialJSON column holds the full go-webauthn Credential struct so the
// login ceremony can reconstruct it exactly (flags, attestation type, ...).
// The other fields are an index-friendly denormalisation.
type Passkey struct {
	Id             string
	UserId         string
	CredentialId   []byte
	PublicKey      []byte
	SignCount      uint32
	AAGUID         []byte
	Transports     []string
	Name           string
	CredentialJSON []byte
	LastUsedAt     *time.Time
	CreatedAt      time.Time
}
