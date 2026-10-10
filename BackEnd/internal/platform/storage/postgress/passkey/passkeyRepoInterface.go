package postgress

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/passkey"
)

// WebAuthnSession is the persisted state of an in-flight WebAuthn ceremony
// (challenge + session data). It is shared by every API instance and is
// single-use: TakeSession deletes it.
type WebAuthnSession struct {
	Id          string
	Kind        string // "register" | "login"
	UserId      string // empty for the (anonymous) login ceremony
	SessionData []byte // JSON-encoded webauthn.SessionData
	ExpiresAt   time.Time
}

// PasskeyRepositoryInterface defines the persistence contract for passkey records.
type PasskeyRepositoryInterface interface {
	Save(ctx context.Context, pk *passkey.Passkey) error
	FindByCredentialId(ctx context.Context, credentialId []byte) (*passkey.Passkey, error)
	FindByUserId(ctx context.Context, userId string) ([]*passkey.Passkey, error)
	// UpdateSignCount persists the post-login authenticator state: the sign
	// counter column AND credential_json (which the login ceremony prefers),
	// so both stay in sync. A nil credentialJSON keeps the stored JSON.
	UpdateSignCount(ctx context.Context, id string, signCount uint32, credentialJSON []byte) error
	Delete(ctx context.Context, id string, userId string) error

	// SaveSession stores a WebAuthn ceremony session.
	SaveSession(ctx context.Context, session *WebAuthnSession) error
	// TakeSession atomically fetches and deletes a session (single use).
	// Returns sql.ErrNoRows when it does not exist, was already consumed or
	// has expired.
	TakeSession(ctx context.Context, id, kind string) (*WebAuthnSession, error)
}
