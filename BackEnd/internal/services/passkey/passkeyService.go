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
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
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

// PasskeyService implements the WebAuthn register/login ceremonies for the API.
type PasskeyService struct {
	webAuthn   *webauthn.WebAuthn
	repo       passkeyRepo.PasskeyRepositoryInterface
	userSvc    UserServiceInterface
	authSvc    AuthServiceInterface
	cache      cache.CacheRepository
	sessionTTL time.Duration
}

// NewPasskeyService wires the collaborators together.
func NewPasskeyService(
	wa *webauthn.WebAuthn,
	repo passkeyRepo.PasskeyRepositoryInterface,
	userSvc UserServiceInterface,
	authSvc AuthServiceInterface,
	cacheRepo cache.CacheRepository,
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
		cache:      cacheRepo,
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
// Session storage (challenges stored in the shared go-cache)
// -----------------------------------------------------------------------------

const (
	sessionPrefixRegister = "passkey:session:register:"
	sessionPrefixLogin    = "passkey:session:login:"
)

type storedSession struct {
	UserID  string               `json:"user_id,omitempty"`
	Session webauthn.SessionData `json:"session"`
}

func (s *PasskeyService) putSession(prefix, id string, data storedSession) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	s.cache.Set(prefix+id, payload, s.sessionTTL)
	return nil
}

func (s *PasskeyService) takeSession(prefix, id string) (*storedSession, error) {
	raw, found := s.cache.Get(prefix + id)
	if !found {
		return nil, errors.New("session not found or expired")
	}
	// Consume exactly once.
	s.cache.Delete(prefix + id)

	payload, ok := raw.([]byte)
	if !ok {
		return nil, errors.New("invalid session payload")
	}
	var data storedSession
	if err := json.Unmarshal(payload, &data); err != nil {
		return nil, err
	}
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

	creation, sessionData, err := s.webAuthn.BeginRegistration(adapter)
	if err != nil {
		return nil, fmt.Errorf("begin registration: %w", err)
	}

	sessionID := ksuid.New().String()
	if err := s.putSession(sessionPrefixRegister, sessionID, storedSession{
		UserID:  userId,
		Session: *sessionData,
	}); err != nil {
		return nil, err
	}

	return &BeginRegistrationResult{SessionID: sessionID, Options: creation}, nil
}

// FinishRegistration parses the attestation and persists the new credential.
func (s *PasskeyService) FinishRegistration(ctx context.Context, userId, sessionID, name string, request *http.Request) (*passkeyDomain.Passkey, error) {
	stored, err := s.takeSession(sessionPrefixRegister, sessionID)
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

	pk := &passkeyDomain.Passkey{
		Id:           ksuid.New().String(),
		UserId:       userId,
		CredentialId: credential.ID,
		PublicKey:    credential.PublicKey,
		SignCount:    credential.Authenticator.SignCount,
		AAGUID:       credential.Authenticator.AAGUID,
		Transports:   transportsToStrings(credential.Transport),
		Name:         name,
		CreatedAt:    time.Now(),
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
	assertion, sessionData, err := s.webAuthn.BeginDiscoverableLogin()
	if err != nil {
		return nil, fmt.Errorf("begin login: %w", err)
	}

	sessionID := ksuid.New().String()
	if err := s.putSession(sessionPrefixLogin, sessionID, storedSession{Session: *sessionData}); err != nil {
		return nil, err
	}

	return &BeginLoginResult{SessionID: sessionID, Options: assertion}, nil
}

// FinishLogin verifies the assertion, updates the sign counter and returns
// a fresh access + refresh token pair for the authenticated user.
func (s *PasskeyService) FinishLogin(ctx context.Context, sessionID string, request *http.Request, userAgent, ipAddress string) (*authDomain.AuthResponse, *passkeyDomain.Passkey, error) {
	stored, err := s.takeSession(sessionPrefixLogin, sessionID)
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

	// Advance sign counter (replay detection). If the authenticator reports a
	// value lower than what we stored, FinishDiscoverableLogin will already
	// have raised an error via CloneWarning semantics; we still persist the
	// newest counter to stay in sync.
	if err := s.repo.UpdateSignCount(ctx, matchedPasskey.Id, credential.Authenticator.SignCount); err != nil {
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
