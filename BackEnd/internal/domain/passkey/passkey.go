package passkey

import "time"

// Passkey represents a WebAuthn credential enrolled by a user.
type Passkey struct {
	Id           string
	UserId       string
	CredentialId []byte
	PublicKey    []byte
	SignCount    uint32
	AAGUID       []byte
	Transports   []string
	Name         string
	LastUsedAt   *time.Time
	CreatedAt    time.Time
}
