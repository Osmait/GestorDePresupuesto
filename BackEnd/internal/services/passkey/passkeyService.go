package passkey

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	passkeyDomain "github.com/osmait/gestorDePresupuesto/internal/domain/passkey"
	userDTO "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	passkeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/passkey"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

// AuthServiceInterface is the subset of the auth service the passkey flow
// needs to hand out tokens to a user already authenticated via WebAuthn.
type AuthServiceInterface interface {
	IssueTokensForUser(ctx context.Context, userId, userAgent, ipAddress string) (*authDomain.AuthResponse, error)
}

// UserServiceInterface is the subset of the user service the passkey flow needs.
type UserServiceInterface interface {
	FindUserById(ctx context.Context, id string) (*userDTO.UserResponse, error)
}

// ErrClonedAuthenticator is returned when the authenticator's signature
// counter did not advance, which signals a possibly cloned credential.
var ErrClonedAuthenticator = errors.New("passkey rejected: signature counter did not increase (possible cloned authenticator)")

// PasskeyService implements the WebAuthn register/login ceremonies for the API.
type PasskeyService struct {
	webAuthn   *webauthn.WebAuthn
	repo       passkeyRepo.PasskeyRepositoryInterface
	userSvc    UserServiceInterface
	authSvc    AuthServiceInterface
	sessionTTL time.Duration
}

// NewPasskeyService wires the collaborators together. Ceremony sessions are
// persisted through repo (Postgres) so they work across instances.
func NewPasskeyService(
	wa *webauthn.WebAuthn,
	repo passkeyRepo.PasskeyRepositoryInterface,
	userSvc UserServiceInterface,
	authSvc AuthServiceInterface,
	sessionTTL time.Duration,
) *PasskeyService {
	if sessionTTL <= 0 {
		sessionTTL = 5 * time.Minute
	}
	return &PasskeyService{
		webAuthn:   wa,
		repo:       repo,
		userSvc:    userSvc,
		authSvc:    authSvc,
		sessionTTL: sessionTTL,
	}
}

// -----------------------------------------------------------------------------
// webauthn.User adapter
// -----------------------------------------------------------------------------

type userAdapter struct {
	id          string
	email       string
	displayName string
	credentials []webauthn.Credential
}

func (u *userAdapter) WebAuthnID() []byte                         { return []byte(u.id) }
func (u *userAdapter) WebAuthnName() string                       { return u.email }
func (u *userAdapter) WebAuthnDisplayName() string                { return u.displayName }
func (u *userAdapter) WebAuthnCredentials() []webauthn.Credential { return u.credentials }

func (s *PasskeyService) loadUserAdapter(ctx context.Context, userId string) (*userAdapter, error) {
	user, err := s.userSvc.FindUserById(ctx, userId)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	passkeys, err := s.repo.FindByUserId(ctx, userId)
	if err != nil {
		return nil, fmt.Errorf("failed to load user passkeys: %w", err)
	}

	creds := make([]webauthn.Credential, 0, len(passkeys))
	for _, pk := range passkeys {
		creds = append(creds, toWebAuthnCredential(pk))
	}

	display := user.Name
	if user.LastName != "" {
		display = user.Name + " " + user.LastName
	}
	return &userAdapter{
		id:          user.Id,
		email:       user.Email,
		displayName: display,
		credentials: creds,
	}, nil
}

func toWebAuthnCredential(pk *passkeyDomain.Passkey) webauthn.Credential {
	// Prefer the round-trip JSON if we have it — it preserves flags,
	// attestation type and every other field that the library checks on
	// login. The individual columns are only used as a fallback (eg. for
	// rows written before credential_json existed).
	if len(pk.CredentialJSON) > 0 {
		var cred webauthn.Credential
		if err := json.Unmarshal(pk.CredentialJSON, &cred); err == nil {
			return cred
		}
	}
	transports := make([]protocol.AuthenticatorTransport, 0, len(pk.Transports))
	for _, t := range pk.Transports {
		transports = append(transports, protocol.AuthenticatorTransport(t))
	}
	return webauthn.Credential{
		ID:        pk.CredentialId,
		PublicKey: pk.PublicKey,
		Transport: transports,
		Authenticator: webauthn.Authenticator{
			AAGUID:    pk.AAGUID,
			SignCount: pk.SignCount,
		},
	}
}

// -----------------------------------------------------------------------------
// Session storage (challenges persisted in Postgres, single-use, with TTL)
// -----------------------------------------------------------------------------

const (
	sessionKindRegister = "register"
	sessionKindLogin    = "login"
)

// errSessionNotFound is returned for unknown, consumed or expired sessions.
var errSessionNotFound = errors.New("session not found or expired")

type storedSession struct {
	UserID  string
	Session webauthn.SessionData
}

func (s *PasskeyService) putSession(ctx context.Context, kind, id string, data storedSession) error {
	payload, err := json.Marshal(data.Session)
	if err != nil {
		return err
	}
	return s.repo.SaveSession(ctx, &passkeyRepo.WebAuthnSession{
		Id:          id,
		Kind:        kind,
		UserId:      data.UserID,
		SessionData: payload,
		ExpiresAt:   time.Now().Add(s.sessionTTL),
	})
}

func (s *PasskeyService) takeSession(ctx context.Context, kind, id string) (*storedSession, error) {
	if id == "" {
		return nil, errSessionNotFound
	}
	row, err := s.repo.TakeSession(ctx, id, kind)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errSessionNotFound
		}
		return nil, fmt.Errorf("load webauthn session: %w", err)
	}
	var data storedSession
	if err := json.Unmarshal(row.SessionData, &data.Session); err != nil {
		return nil, fmt.Errorf("invalid session payload: %w", err)
	}
	data.UserID = row.UserId
	return &data, nil
}

// -----------------------------------------------------------------------------
// Registration ceremony
// -----------------------------------------------------------------------------

// BeginRegistrationResult is what the handler returns to the browser.
type BeginRegistrationResult struct {
	SessionID string                       `json:"session_id"`
	Options   *protocol.CredentialCreation `json:"options"`
}

func (s *PasskeyService) BeginRegistration(ctx context.Context, userId string) (*BeginRegistrationResult, error) {
	adapter, err := s.loadUserAdapter(ctx, userId)
	if err != nil {
		return nil, err
	}

	// A passkey must be unlocked (PIN, biometrics) to count as a login on its
	// own: a bare security key without user verification would make the
	// possession of the device enough. Login requires the UV flag too.
	creation, sessionData, err := s.webAuthn.BeginRegistration(adapter,
		webauthn.WithAuthenticatorSelection(protocol.AuthenticatorSelection{
			ResidentKey:      protocol.ResidentKeyRequirementPreferred,
			UserVerification: protocol.VerificationRequired,
		}))
	if err != nil {
		return nil, fmt.Errorf("begin registration: %w", err)
	}

	sessionID := ksuid.New().String()
	if err := s.putSession(ctx, sessionKindRegister, sessionID, storedSession{
		UserID:  userId,
		Session: *sessionData,
	}); err != nil {
		return nil, err
	}

	return &BeginRegistrationResult{SessionID: sessionID, Options: creation}, nil
}

// FinishRegistration parses the attestation and persists the new credential.
func (s *PasskeyService) FinishRegistration(ctx context.Context, userId, sessionID, name string, request *http.Request) (*passkeyDomain.Passkey, error) {
	stored, err := s.takeSession(ctx, sessionKindRegister, sessionID)
	if err != nil {
		return nil, err
	}
	if stored.UserID != userId {
		return nil, errors.New("session does not belong to the authenticated user")
	}

	adapter, err := s.loadUserAdapter(ctx, userId)
	if err != nil {
		return nil, err
	}

	credential, err := s.webAuthn.FinishRegistration(adapter, stored.Session, request)
	if err != nil {
		return nil, fmt.Errorf("finish registration: %w", err)
	}

	if name == "" {
		name = "Passkey"
	}

	credentialJSON, err := json.Marshal(credential)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize credential: %w", err)
	}

	pk := &passkeyDomain.Passkey{
		Id:             ksuid.New().String(),
		UserId:         userId,
		CredentialId:   credential.ID,
		PublicKey:      credential.PublicKey,
		SignCount:      credential.Authenticator.SignCount,
		AAGUID:         credential.Authenticator.AAGUID,
		Transports:     transportsToStrings(credential.Transport),
		Name:           name,
		CredentialJSON: credentialJSON,
		CreatedAt:      time.Now(),
	}
	if err := s.repo.Save(ctx, pk); err != nil {
		return nil, fmt.Errorf("failed to persist passkey: %w", err)
	}

	log.Info().Str("user_id", userId).Str("passkey_id", pk.Id).Msg("Passkey registered")
	return pk, nil
}

// -----------------------------------------------------------------------------
// Login ceremony (discoverable / usernameless)
// -----------------------------------------------------------------------------

// BeginLoginResult is what the handler returns to the browser.
type BeginLoginResult struct {
	SessionID string                        `json:"session_id"`
	Options   *protocol.CredentialAssertion `json:"options"`
}

func (s *PasskeyService) BeginLogin(ctx context.Context) (*BeginLoginResult, error) {
	assertion, sessionData, err := s.webAuthn.BeginDiscoverableLogin(webauthn.WithUserVerification(protocol.VerificationRequired))
	if err != nil {
		return nil, fmt.Errorf("begin login: %w", err)
	}

	sessionID := ksuid.New().String()
	if err := s.putSession(ctx, sessionKindLogin, sessionID, storedSession{Session: *sessionData}); err != nil {
		return nil, err
	}

	return &BeginLoginResult{SessionID: sessionID, Options: assertion}, nil
}

// FinishLogin verifies the assertion, updates the sign counter and returns
// a fresh access + refresh token pair for the authenticated user.
func (s *PasskeyService) FinishLogin(ctx context.Context, sessionID string, request *http.Request, userAgent, ipAddress string) (*authDomain.AuthResponse, *passkeyDomain.Passkey, error) {
	stored, err := s.takeSession(ctx, sessionKindLogin, sessionID)
	if err != nil {
		return nil, nil, err
	}

	// The handler receives rawID and userHandle from the assertion and must
	// return the User that owns that credential. We look up the user by their
	// user handle (which we set as the user id in userAdapter.WebAuthnID).
	var matchedPasskey *passkeyDomain.Passkey
	handler := func(rawID, userHandle []byte) (webauthn.User, error) {
		userId := string(userHandle)
		adapter, loadErr := s.loadUserAdapter(ctx, userId)
		if loadErr != nil {
			return nil, loadErr
		}
		// Track which passkey was used so we can update the sign counter later.
		pk, pkErr := s.repo.FindByCredentialId(ctx, rawID)
		if pkErr != nil {
			if errors.Is(pkErr, sql.ErrNoRows) {
				return nil, errors.New("credential not found")
			}
			return nil, pkErr
		}
		if pk.UserId != userId {
			return nil, errors.New("credential does not belong to claimed user")
		}
		matchedPasskey = pk
		return adapter, nil
	}

	credential, err := s.webAuthn.FinishDiscoverableLogin(handler, stored.Session, request)
	if err != nil {
		return nil, nil, fmt.Errorf("finish login: %w", err)
	}
	if matchedPasskey == nil {
		return nil, nil, errors.New("passkey lookup failed")
	}

	// Clone detection. go-webauthn (v0.16.x) does NOT fail the ceremony when
	// the signature counter goes backwards / does not advance: it only sets
	// Authenticator.CloneWarning and leaves SignCount unchanged. Treat it as
	// a failed login and do not persist anything.
	if credential.Authenticator.CloneWarning {
		log.Warn().
			Str("user_id", matchedPasskey.UserId).
			Str("passkey_id", matchedPasskey.Id).
			Uint32("stored_sign_count", matchedPasskey.SignCount).
			Msg("passkey login rejected: clone warning")
		return nil, nil, ErrClonedAuthenticator
	}

	// Persist the new counter + flags in both the column and credential_json
	// (the latter is what the next login reads back).
	credentialJSON, err := json.Marshal(credential)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to serialize credential: %w", err)
	}
	if err := s.repo.UpdateSignCount(ctx, matchedPasskey.Id, credential.Authenticator.SignCount, credentialJSON); err != nil {
		log.Warn().Err(err).Str("passkey_id", matchedPasskey.Id).Msg("failed to update passkey sign counter")
	}

	tokens, err := s.authSvc.IssueTokensForUser(ctx, matchedPasskey.UserId, userAgent, ipAddress)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to issue tokens: %w", err)
	}

	log.Info().Str("user_id", matchedPasskey.UserId).Str("passkey_id", matchedPasskey.Id).Msg("Passkey login successful")
	return tokens, matchedPasskey, nil
}

// -----------------------------------------------------------------------------
// Management
// -----------------------------------------------------------------------------

// ListForUser returns the passkeys belonging to the authenticated user.
func (s *PasskeyService) ListForUser(ctx context.Context, userId string) ([]*passkeyDomain.Passkey, error) {
	return s.repo.FindByUserId(ctx, userId)
}

// DeleteForUser removes a passkey owned by the authenticated user.
func (s *PasskeyService) DeleteForUser(ctx context.Context, id, userId string) error {
	return s.repo.Delete(ctx, id, userId)
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

func transportsToStrings(ts []protocol.AuthenticatorTransport) []string {
	out := make([]string, 0, len(ts))
	for _, t := range ts {
		out = append(out, string(t))
	}
	return out
}

// EncodeCredentialId base64url-encodes raw credential ids for API responses.
func EncodeCredentialId(id []byte) string {
	return base64.RawURLEncoding.EncodeToString(id)
}
