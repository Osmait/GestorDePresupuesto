// Package mcpoauth persists the state of the MCP OAuth 2.1 server (clients,
// authorization codes and tokens) in PostgreSQL, so a redeploy does not
// disconnect Claude.
//
// Storage implements github.com/plexusone/omniskill/mcp/oauth2.Storage. Every secret
// (authorization codes, access and refresh tokens, client secrets) is stored
// as the hex SHA-256 of its value and looked up by that hash; the plain value
// never reaches the database.
package mcpoauth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/plexusone/omniskill/mcp/oauth2"
	"github.com/rs/zerolog/log"
)

const (
	// queryTimeout bounds every statement: the oauth2.Storage interface has no
	// context, so the request's cancellation cannot be propagated.
	queryTimeout = 5 * time.Second

	maxClientNameRunes = 255
	maxRedirectURIs    = 10
	maxRedirectURILen  = 2048
	maxClientIDLen     = 128
)

// ErrInvalidClient is returned by CreateClient for registrations outside the
// accepted limits (too many or too long redirect URIs, oversized client id).
var ErrInvalidClient = errors.New("invalid client registration")

// Storage is a PostgreSQL implementation of oauth2.Storage.
//
// It is safe for concurrent use by any number of requests and API instances:
// authorization codes are consumed with a single conditional UPDATE and
// refresh tokens with DELETE ... RETURNING, so each can be redeemed once.
type Storage struct {
	db  *sql.DB
	now func() time.Time
	// maxSessionAge is the absolute lifetime of a grant (the user's login on
	// the consent page) across refreshes; 0 disables it.
	maxSessionAge time.Duration
}

var _ oauth2.Storage = (*Storage)(nil)

// Option configures a Storage.
type Option func(*Storage)

// WithMaxSessionAge caps a grant at d after the user logged in on the consent
// page (REFRESH_SESSION_MAX_AGE): refreshes keep the original session start,
// refresh tokens never expire later than start + d, and refreshing past it
// fails, so Claude has to be connected again. d <= 0 disables the cap.
func WithMaxSessionAge(d time.Duration) Option {
	return func(s *Storage) {
		if d > 0 {
			s.maxSessionAge = d
		}
	}
}

// New returns a Storage backed by db (migrations 000057 and 000063 must be
// applied).
func New(db *sql.DB, opts ...Option) *Storage {
	s := &Storage{db: db, now: time.Now}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// sessionSubjectSep separates the user id from the session start in the
// subject GetTokenByRefresh returns. The subject is the only field omniskill
// copies from the consumed token into the new one (CreateToken), so it is how
// the session start of the grant survives a refresh. User ids (ksuid, UUID)
// and emails never contain it.
const sessionSubjectSep = "|session_started_at="

// refreshSubject is the subject handed from GetTokenByRefresh to CreateToken.
func refreshSubject(userID string, sessionStartedAt time.Time) string {
	return userID + sessionSubjectSep + sessionStartedAt.UTC().Format(time.RFC3339Nano)
}

// splitSubject returns the subject to store (user id or email) and the session
// start carried by a refresh subject (zero for a new grant).
func splitSubject(subject string) (string, time.Time) {
	user, started, ok := strings.Cut(subject, sessionSubjectSep)
	if !ok {
		return subject, time.Time{}
	}
	at, err := time.Parse(time.RFC3339Nano, started)
	if err != nil {
		return user, time.Time{}
	}
	return user, at
}

// HashSecret returns the hex SHA-256 of a secret value, the form in which
// codes, tokens and client secrets are stored.
func HashSecret(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

// HashClientSecret implements the optional client-secret hashing hook used by
// the MCP token endpoint: GetClient returns the stored hash as ClientSecret,
// so the incoming secret has to be hashed the same way before omniskill compares
// them. Without the hook the comparison fails, i.e. it fails closed.
func (s *Storage) HashClientSecret(secret string) string {
	return HashSecret(secret)
}

func (s *Storage) ctx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), queryTimeout)
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

// CreateClient stores a client registered through dynamic client
// registration. The client secret, if any, is stored hashed.
func (s *Storage) CreateClient(client *oauth2.Client) error {
	if client == nil || client.ClientID == "" || len(client.ClientID) > maxClientIDLen {
		return ErrInvalidClient
	}
	if len(client.RedirectURIs) == 0 || len(client.RedirectURIs) > maxRedirectURIs {
		return ErrInvalidClient
	}
	for _, uri := range client.RedirectURIs {
		if uri == "" || len(uri) > maxRedirectURILen {
			return ErrInvalidClient
		}
	}

	redirects, err := json.Marshal(client.RedirectURIs)
	if err != nil {
		return fmt.Errorf("encode redirect uris: %w", err)
	}
	grants, err := json.Marshal(nonNil(client.GrantTypes))
	if err != nil {
		return fmt.Errorf("encode grant types: %w", err)
	}
	responses, err := json.Marshal(nonNil(client.ResponseTypes))
	if err != nil {
		return fmt.Errorf("encode response types: %w", err)
	}

	var secretHash any
	if client.ClientSecret != "" {
		secretHash = HashSecret(client.ClientSecret)
	}
	createdAt := client.CreatedAt
	if createdAt.IsZero() {
		createdAt = s.now()
	}
	authMethod := client.TokenEndpointAuthMethod
	if authMethod == "" {
		authMethod = "none"
	}

	ctx, cancel := s.ctx()
	defer cancel()
	_, err = s.db.ExecContext(ctx, `INSERT INTO mcp_oauth_clients
		(client_id, client_secret_hash, client_name, redirect_uris, grant_types,
		 response_types, token_endpoint_auth_method, created_at)
		VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)`,
		client.ClientID, secretHash, truncateRunes(client.ClientName, maxClientNameRunes),
		string(redirects), string(grants), string(responses), authMethod, createdAt)
	if err != nil {
		return fmt.Errorf("insert oauth client: %w", err)
	}
	return nil
}

// GetClient loads a client. ClientSecret holds the stored SHA-256 hash of the
// secret (empty for public clients), never the secret itself.
func (s *Storage) GetClient(clientID string) (*oauth2.Client, error) {
	ctx, cancel := s.ctx()
	defer cancel()

	c := &oauth2.Client{}
	var secretHash sql.NullString
	var redirects, grants, responses string
	err := s.db.QueryRowContext(ctx, `SELECT client_id, client_secret_hash, client_name,
			redirect_uris::text, grant_types::text, response_types::text,
			token_endpoint_auth_method, created_at
		FROM mcp_oauth_clients WHERE client_id = $1`, clientID).
		Scan(&c.ClientID, &secretHash, &c.ClientName, &redirects, &grants, &responses,
			&c.TokenEndpointAuthMethod, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, oauth2.ErrClientNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select oauth client: %w", err)
	}
	c.ClientSecret = secretHash.String
	if err := json.Unmarshal([]byte(redirects), &c.RedirectURIs); err != nil {
		return nil, fmt.Errorf("decode redirect uris: %w", err)
	}
	if err := json.Unmarshal([]byte(grants), &c.GrantTypes); err != nil {
		return nil, fmt.Errorf("decode grant types: %w", err)
	}
	if err := json.Unmarshal([]byte(responses), &c.ResponseTypes); err != nil {
		return nil, fmt.Errorf("decode response types: %w", err)
	}
	return c, nil
}

// DeleteClient removes a client and (by cascade) its codes and tokens.
func (s *Storage) DeleteClient(clientID string) error {
	ctx, cancel := s.ctx()
	defer cancel()
	_, err := s.db.ExecContext(ctx, `DELETE FROM mcp_oauth_clients WHERE client_id = $1`, clientID)
	return err
}

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

// CreateAuthorizationCode stores a code by its hash. Expired codes are purged
// opportunistically.
func (s *Storage) CreateAuthorizationCode(code *oauth2.AuthorizationCode) error {
	if code == nil || code.Code == "" {
		return errors.New("empty authorization code")
	}
	ctx, cancel := s.ctx()
	defer cancel()

	if _, err := s.db.ExecContext(ctx, `DELETE FROM mcp_oauth_authorization_codes WHERE expires_at < $1`, s.now()); err != nil {
		log.Warn().Err(err).Msg("failed to purge expired MCP OAuth codes")
	}

	createdAt := code.CreatedAt
	if createdAt.IsZero() {
		createdAt = s.now()
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO mcp_oauth_authorization_codes
		(code_hash, client_id, redirect_uri, scope, code_challenge, code_challenge_method,
		 subject, used_at, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		HashSecret(code.Code), code.ClientID, code.RedirectURI, code.Scope, code.CodeChallenge,
		code.CodeChallengeMethod, code.Subject, usedAt(code.Used, createdAt), code.ExpiresAt, createdAt)
	if err != nil {
		return fmt.Errorf("insert oauth code: %w", err)
	}
	return nil
}

// GetAuthorizationCode returns an unused, unexpired code. Code holds the
// value that was looked up (the database only has its hash).
func (s *Storage) GetAuthorizationCode(code string) (*oauth2.AuthorizationCode, error) {
	ctx, cancel := s.ctx()
	defer cancel()

	ac := &oauth2.AuthorizationCode{Code: code}
	var used sql.NullTime
	err := s.db.QueryRowContext(ctx, `SELECT client_id, redirect_uri, scope, code_challenge,
			code_challenge_method, subject, used_at, expires_at, created_at
		FROM mcp_oauth_authorization_codes WHERE code_hash = $1`, HashSecret(code)).
		Scan(&ac.ClientID, &ac.RedirectURI, &ac.Scope, &ac.CodeChallenge,
			&ac.CodeChallengeMethod, &ac.Subject, &used, &ac.ExpiresAt, &ac.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, oauth2.ErrCodeNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select oauth code: %w", err)
	}
	if used.Valid {
		return nil, oauth2.ErrCodeUsed
	}
	if !s.now().Before(ac.ExpiresAt) {
		return nil, oauth2.ErrCodeExpired
	}
	return ac, nil
}

// DeleteAuthorizationCode removes a code.
func (s *Storage) DeleteAuthorizationCode(code string) error {
	ctx, cancel := s.ctx()
	defer cancel()
	_, err := s.db.ExecContext(ctx, `DELETE FROM mcp_oauth_authorization_codes WHERE code_hash = $1`, HashSecret(code))
	return err
}

// MarkAuthorizationCodeUsed consumes a code atomically: only one of several
// concurrent token exchanges for the same code gets a nil error, every other
// one gets ErrCodeUsed (or ErrCodeExpired / ErrCodeNotFound) and omniskill then
// refuses to issue a token.
func (s *Storage) MarkAuthorizationCodeUsed(code string) error {
	ctx, cancel := s.ctx()
	defer cancel()

	now := s.now()
	hash := HashSecret(code)
	res, err := s.db.ExecContext(ctx, `UPDATE mcp_oauth_authorization_codes
		SET used_at = $2
		WHERE code_hash = $1 AND used_at IS NULL AND expires_at > $2`, hash, now)
	if err != nil {
		return fmt.Errorf("consume oauth code: %w", err)
	}
	if n, err := res.RowsAffected(); err != nil {
		return fmt.Errorf("consume oauth code: %w", err)
	} else if n == 1 {
		return nil
	}

	var used sql.NullTime
	var expiresAt time.Time
	err = s.db.QueryRowContext(ctx, `SELECT used_at, expires_at FROM mcp_oauth_authorization_codes
		WHERE code_hash = $1`, hash).Scan(&used, &expiresAt)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return oauth2.ErrCodeNotFound
	case err != nil:
		return fmt.Errorf("consume oauth code: %w", err)
	case used.Valid:
		return oauth2.ErrCodeUsed
	default:
		return oauth2.ErrCodeExpired
	}
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

// CreateToken stores an access token (and its refresh token) by hash. The
// subject is resolved to the user id so that deleting the user revokes the
// token: on the code exchange it is the email the user just logged in with,
// on a refresh it is the user id of the consumed token (see GetTokenByRefresh),
// so a refreshed token never follows the email to another account. A refresh
// also carries the session start of the grant (see refreshSubject), which the
// new token keeps; with a maximum session age its refresh token does not
// outlive the session. Fully expired tokens are purged opportunistically.
func (s *Storage) CreateToken(token *oauth2.TokenInfo) error {
	if token == nil || token.AccessToken == "" {
		return errors.New("empty access token")
	}
	ctx, cancel := s.ctx()
	defer cancel()

	now := s.now()
	if _, err := s.db.ExecContext(ctx, `DELETE FROM mcp_oauth_tokens WHERE purge_after < $1`, now); err != nil {
		log.Warn().Err(err).Msg("failed to purge expired MCP OAuth tokens")
	}

	subject, sessionStartedAt := splitSubject(token.Subject)
	if sessionStartedAt.IsZero() {
		sessionStartedAt = now // a new grant (authorization code exchange)
	}

	var refreshHash any
	var refreshExpires any
	purgeAfter := token.ExpiresAt
	if token.RefreshToken != "" {
		refreshHash = HashSecret(token.RefreshToken)
		refreshExpiresAt := token.RefreshExpiresAt
		if s.maxSessionAge > 0 {
			if end := sessionStartedAt.Add(s.maxSessionAge); refreshExpiresAt.IsZero() || refreshExpiresAt.After(end) {
				refreshExpiresAt = end
			}
		}
		if !refreshExpiresAt.IsZero() {
			refreshExpires = refreshExpiresAt
			if refreshExpiresAt.After(purgeAfter) {
				purgeAfter = refreshExpiresAt
			}
		}
	}
	tokenType := token.TokenType
	if tokenType == "" {
		tokenType = "Bearer"
	}
	createdAt := token.CreatedAt
	if createdAt.IsZero() {
		createdAt = now
	}

	_, err := s.db.ExecContext(ctx, `INSERT INTO mcp_oauth_tokens
		(access_token_hash, refresh_token_hash, client_id, user_id, subject, scope,
		 token_type, expires_at, refresh_expires_at, purge_after, created_at, session_started_at)
		VALUES ($1, $2, $3,
			(SELECT id FROM users WHERE deleted_at IS NULL
				AND CASE WHEN strpos($4, '@') > 0 THEN email = $4 ELSE id = $4 END LIMIT 1),
			$4, $5, $6, $7, $8, $9, $10, $11)`,
		HashSecret(token.AccessToken), refreshHash, token.ClientID, subject, token.Scope,
		tokenType, token.ExpiresAt, refreshExpires, purgeAfter, createdAt, sessionStartedAt)
	if err != nil {
		return fmt.Errorf("insert oauth token: %w", err)
	}
	return nil
}

// GetToken returns the token for an access token value if it is unexpired
// and its user still exists. AccessToken holds the looked-up value.
func (s *Storage) GetToken(accessToken string) (*oauth2.TokenInfo, error) {
	ctx, cancel := s.ctx()
	defer cancel()

	t := &oauth2.TokenInfo{AccessToken: accessToken}
	var refreshExpires sql.NullTime
	err := s.db.QueryRowContext(ctx, `SELECT t.client_id, t.subject, t.scope, t.token_type,
			t.expires_at, t.refresh_expires_at, t.created_at
		FROM mcp_oauth_tokens t
		JOIN users u ON u.id = t.user_id AND u.deleted_at IS NULL
		WHERE t.access_token_hash = $1`, HashSecret(accessToken)).
		Scan(&t.ClientID, &t.Subject, &t.Scope, &t.TokenType,
			&t.ExpiresAt, &refreshExpires, &t.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, oauth2.ErrTokenNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("select oauth token: %w", err)
	}
	t.RefreshExpiresAt = refreshExpires.Time
	if !s.now().Before(t.ExpiresAt) {
		return nil, oauth2.ErrTokenExpired
	}
	return t, nil
}

// UserIDForAccessToken returns the id of the user an access token was issued
// to, if the token is unexpired and the user still exists. The id is the one
// stored when the token was issued, never re-derived from the (mutable) email.
func (s *Storage) UserIDForAccessToken(accessToken string) (string, error) {
	ctx, cancel := s.ctx()
	defer cancel()

	var userID sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT t.user_id
		FROM mcp_oauth_tokens t
		JOIN users u ON u.id = t.user_id AND u.deleted_at IS NULL
		WHERE t.access_token_hash = $1 AND t.expires_at > $2`, HashSecret(accessToken), s.now()).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !userID.Valid) {
		return "", oauth2.ErrTokenNotFound
	}
	if err != nil {
		return "", fmt.Errorf("select oauth token user: %w", err)
	}
	return userID.String, nil
}

// GetTokenByRefresh consumes a refresh token: the row is deleted in the same
// statement that reads it, so concurrent refreshes with the same token yield
// one new token pair at most (refresh token rotation). omniskill deletes the old
// access token right after this call anyway; AccessToken is left empty
// because only its hash is known. Subject is the stored user id, not the email,
// because omniskill copies it into the new token (see CreateToken), followed by
// the session start of the grant (refreshSubject). Past the maximum session
// age the token is consumed and ErrTokenExpired returned.
func (s *Storage) GetTokenByRefresh(refreshToken string) (*oauth2.TokenInfo, error) {
	ctx, cancel := s.ctx()
	defer cancel()

	t := &oauth2.TokenInfo{RefreshToken: refreshToken}
	var refreshExpires sql.NullTime
	var userActive bool
	var userID string
	var sessionStartedAt time.Time
	err := s.db.QueryRowContext(ctx, `WITH consumed AS (
			DELETE FROM mcp_oauth_tokens WHERE refresh_token_hash = $1
			RETURNING client_id, user_id, subject, scope, token_type, expires_at,
				refresh_expires_at, created_at, session_started_at
		)
		SELECT c.client_id, COALESCE(c.user_id, c.subject), c.scope, c.token_type, c.expires_at,
			c.refresh_expires_at, c.created_at, c.session_started_at,
			EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id AND u.deleted_at IS NULL)
		FROM consumed c`, HashSecret(refreshToken)).
		Scan(&t.ClientID, &userID, &t.Scope, &t.TokenType, &t.ExpiresAt,
			&refreshExpires, &t.CreatedAt, &sessionStartedAt, &userActive)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, oauth2.ErrTokenNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("consume oauth refresh token: %w", err)
	}
	if !userActive {
		return nil, oauth2.ErrTokenNotFound
	}
	t.RefreshExpiresAt = refreshExpires.Time
	if refreshExpires.Valid && !s.now().Before(refreshExpires.Time) {
		return nil, oauth2.ErrTokenExpired
	}
	if s.maxSessionAge > 0 && !s.now().Before(sessionStartedAt.Add(s.maxSessionAge)) {
		log.Info().Str("user_id", userID).Str("client_id", t.ClientID).
			Msg("MCP OAuth grant reached its maximum session age")
		return nil, oauth2.ErrTokenExpired
	}
	t.Subject = refreshSubject(userID, sessionStartedAt)
	return t, nil
}

// DeleteToken revokes an access token (and its refresh token).
func (s *Storage) DeleteToken(accessToken string) error {
	if accessToken == "" {
		return nil
	}
	ctx, cancel := s.ctx()
	defer cancel()
	_, err := s.db.ExecContext(ctx, `DELETE FROM mcp_oauth_tokens WHERE access_token_hash = $1`, HashSecret(accessToken))
	return err
}

// DeleteTokensByClient revokes every token issued to a client.
func (s *Storage) DeleteTokensByClient(clientID string) error {
	ctx, cancel := s.ctx()
	defer cancel()
	_, err := s.db.ExecContext(ctx, `DELETE FROM mcp_oauth_tokens WHERE client_id = $1`, clientID)
	return err
}

// Cleanup deletes expired authorization codes and tokens whose access and
// refresh tokens have both expired. It returns the number of rows removed.
// Writes already purge opportunistically; Cleanup is for callers that want a
// periodic sweep.
func (s *Storage) Cleanup(ctx context.Context) (int64, error) {
	now := s.now()
	var total int64
	for _, q := range []string{
		`DELETE FROM mcp_oauth_authorization_codes WHERE expires_at < $1`,
		`DELETE FROM mcp_oauth_tokens WHERE purge_after < $1`,
	} {
		res, err := s.db.ExecContext(ctx, q, now)
		if err != nil {
			return total, fmt.Errorf("purge expired oauth rows: %w", err)
		}
		n, _ := res.RowsAffected()
		total += n
	}
	return total, nil
}

func usedAt(used bool, at time.Time) any {
	if used {
		return at
	}
	return nil
}

func nonNil(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}

func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n])
}
