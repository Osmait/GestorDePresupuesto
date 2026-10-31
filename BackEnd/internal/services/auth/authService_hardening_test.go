package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
	authRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/auth"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

// fakeUsers is a minimal UserRepositoryInterface keyed by email.
type fakeUsers struct {
	byEmail   map[string]*user.User
	lookupErr error
}

func (f *fakeUsers) FindUserById(context.Context, string) (*user.User, error) {
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUsers) FindUserByEmail(_ context.Context, email string) (*user.User, error) {
	if f.lookupErr != nil {
		return nil, f.lookupErr
	}
	if u, ok := f.byEmail[email]; ok {
		return u, nil
	}
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUsers) FindUserByIp(context.Context, string) (*user.User, error) {
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUsers) DeleteDemoUsersOlderThan(context.Context, time.Time) error { return nil }
func (f *fakeUsers) Save(context.Context, *user.User) error                    { return nil }
func (f *fakeUsers) Delete(context.Context, string) error                      { return nil }
func (f *fakeUsers) FindAll(context.Context) ([]*user.User, error)             { return nil, nil }
func (f *fakeUsers) FindAllFiltered(context.Context, string, int, int) ([]*user.User, error) {
	return nil, nil
}
func (f *fakeUsers) Update(context.Context, *user.User) error { return nil }
func (f *fakeUsers) SoftDelete(context.Context, string) error { return nil }

// fakeRefreshRepo is an in-memory RefreshTokenRepositoryInterface whose
// Rotate has the same compare-and-swap semantics as the SQL implementation.
type fakeRefreshRepo struct {
	mu             sync.Mutex
	tokens         map[string]*authDomain.RefreshToken // by hash
	revokeAllCalls []string
	rotateErr      error
}

func newFakeRefreshRepo() *fakeRefreshRepo {
	return &fakeRefreshRepo{tokens: map[string]*authDomain.RefreshToken{}}
}

func (f *fakeRefreshRepo) Save(_ context.Context, t *authDomain.RefreshToken) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	cp := *t
	f.tokens[t.TokenHash] = &cp
	return nil
}

func (f *fakeRefreshRepo) Rotate(_ context.Context, oldHash string, n *authDomain.RefreshToken, now time.Time, maxSessionAge time.Duration) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.rotateErr != nil {
		return "", f.rotateErr
	}
	old, ok := f.tokens[oldHash]
	if !ok || old.RevokedAt != nil || !old.ExpiresAt.After(now) {
		return "", authRepo.ErrTokenNotActive
	}
	if maxSessionAge > 0 && !old.SessionStartedAt.After(now.Add(-maxSessionAge)) {
		return "", authRepo.ErrTokenNotActive
	}
	revokedAt := now
	id := n.Id
	old.RevokedAt = &revokedAt
	old.ReplacedBy = &id
	n.UserId = old.UserId
	n.SessionStartedAt = old.SessionStartedAt
	if end := old.SessionStartedAt.Add(maxSessionAge); maxSessionAge > 0 && n.ExpiresAt.After(end) {
		n.ExpiresAt = end
	}
	cp := *n
	f.tokens[n.TokenHash] = &cp
	return old.UserId, nil
}

func (f *fakeRefreshRepo) FindByHash(_ context.Context, h string) (*authDomain.RefreshToken, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if t, ok := f.tokens[h]; ok {
		cp := *t
		return &cp, nil
	}
	return nil, nil
}

func (f *fakeRefreshRepo) FindByUserId(_ context.Context, userId string) ([]*authDomain.RefreshToken, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []*authDomain.RefreshToken
	for _, t := range f.tokens {
		if t.UserId == userId && t.RevokedAt == nil {
			out = append(out, t)
		}
	}
	return out, nil
}

func (f *fakeRefreshRepo) Revoke(context.Context, string, *string) error { return nil }

func (f *fakeRefreshRepo) RevokeByHash(_ context.Context, h string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if t, ok := f.tokens[h]; ok && t.RevokedAt == nil {
		now := time.Now()
		t.RevokedAt = &now
	}
	return nil
}

func (f *fakeRefreshRepo) RevokeAllForUser(_ context.Context, userId string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.revokeAllCalls = append(f.revokeAllCalls, userId)
	now := time.Now()
	for _, t := range f.tokens {
		if t.UserId == userId && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

func (f *fakeRefreshRepo) DeleteExpired(context.Context) (int64, error) { return 3, nil }

func (f *fakeRefreshRepo) activeFor(userId string) int {
	list, _ := f.FindByUserId(context.Background(), userId)
	return len(list)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const testPassword = "Correct-Horse-1"

func hardeningConfig() *config.Config {
	return &config.Config{
		JWT: config.JWTConfig{
			Secret:            "auth-service-test-secret-at-least-32-chars",
			Expiration:        15 * time.Minute,
			RefreshExpiration: 7 * 24 * time.Hour,
			Issuer:            "gestor-test",
			Audience:          "gestor-test-api",
			RefreshReuseGrace: 30 * time.Second,
			// The default of REFRESH_SESSION_MAX_AGE.
			RefreshSessionMaxAge: 30 * 24 * time.Hour,
		},
		Security: config.SecurityConfig{
			MaxLoginAttempts: 3,
			AccountLockTime:  15 * time.Minute,
		},
	}
}

func newUsersWithAlice(t *testing.T) *fakeUsers {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.DefaultCost)
	require.NoError(t, err)
	return &fakeUsers{byEmail: map[string]*user.User{
		"alice@example.com": {Id: "alice-id", Email: "alice@example.com", Password: string(hash)},
	}}
}

func loginReq(email, password string) *authDomain.AuthRequest {
	return authDomain.NewAuthRequest(email, password)
}

// ---------------------------------------------------------------------------
// login: enumeration + tokens
// ---------------------------------------------------------------------------

func TestLogin_IssuesConfiguredAccessToken(t *testing.T) {
	cfg := hardeningConfig()
	svc := NewAuthService(newUsersWithAlice(t), nil, nil, nil, nil, cfg)

	token, err := svc.LoginFromIP(context.Background(), loginReq("alice@example.com", testPassword), "1.1.1.1")
	require.NoError(t, err)

	claims, err := utils.ParseAccessToken(*token, cfg.JWT)
	require.NoError(t, err)
	assert.Equal(t, "alice-id", claims.UserId)
	assert.Equal(t, "gestor-test", claims.Issuer)
	// Legacy /login used to hard-code 72h; it must follow JWT_EXPIRATION now.
	assert.InDelta(t, time.Now().Add(15*time.Minute).Unix(), claims.ExpiresAt.Unix(), 5)
}

func TestLogin_NoUserEnumeration(t *testing.T) {
	svc := NewAuthService(newUsersWithAlice(t), nil, nil, nil, nil, hardeningConfig())
	ctx := context.Background()

	timeIt := func(email, password string) (time.Duration, error) {
		start := time.Now()
		_, err := svc.LoginFromIP(ctx, loginReq(email, password), "")
		return time.Since(start), err
	}

	// Warm the dummy hash so its one-off generation is not measured.
	_, _ = timeIt("warmup@example.com", "x")

	tests := []struct {
		name     string
		email    string
		password string
	}{
		{"unknown email", "nobody@example.com", testPassword},
		{"wrong password", "alice@example.com", "wrong-password"},
		{"empty credentials", "", ""},
	}

	var wrongPwDuration time.Duration
	durations := map[string]time.Duration{}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			d, err := timeIt(tc.email, tc.password)
			require.Error(t, err)
			assert.ErrorIs(t, err, ErrInvalidCredentials)
			assert.ErrorIs(t, err, errorhttp.ErrBadRequest, "handlers map ErrBadRequest to 400/401")
			assert.Equal(t, ErrInvalidCredentials.Error(), err.Error(), "identical message for every failure")
			durations[tc.name] = d
		})
	}
	wrongPwDuration = durations["wrong password"]

	// The unknown-email path must also pay for a bcrypt comparison.
	assert.Greater(t, durations["unknown email"], wrongPwDuration/3,
		"unknown email returned much faster than a wrong password (bcrypt skipped?)")
}

func TestLogin_InfrastructureErrorIsNotCredentialsError(t *testing.T) {
	users := &fakeUsers{lookupErr: errors.New("connection refused")}
	svc := NewAuthService(users, nil, nil, nil, nil, hardeningConfig())

	_, err := svc.Login(context.Background(), loginReq("alice@example.com", testPassword))
	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrInvalidCredentials)
}

// ---------------------------------------------------------------------------
// login: brute-force lockout
// ---------------------------------------------------------------------------

func TestLogin_LockoutPerEmailAndIP(t *testing.T) {
	cfg := hardeningConfig() // 3 attempts / 15m
	svc := NewAuthService(newUsersWithAlice(t), nil, nil, nil, nil, cfg)
	now := time.Now()
	svc.loginLimiter.now = func() time.Time { return now }
	ctx := context.Background()

	const attacker, victimIP = "6.6.6.6", "7.7.7.7"

	for i := 0; i < 3; i++ {
		_, err := svc.LoginFromIP(ctx, loginReq("alice@example.com", "guess"), attacker)
		assert.ErrorIs(t, err, ErrInvalidCredentials, "attempt %d", i+1)
	}

	// Locked: even the right password is refused, without touching bcrypt.
	_, err := svc.LoginFromIP(ctx, loginReq("alice@example.com", testPassword), attacker)
	var locked *LoginLockedError
	require.ErrorAs(t, err, &locked)
	assert.ErrorIs(t, err, ErrTooManyLoginAttempts)
	assert.InDelta(t, (15 * time.Minute).Seconds(), locked.RetryAfter.Seconds(), 1)

	// Same email from another IP is not locked (no victim lockout).
	_, err = svc.LoginFromIP(ctx, loginReq("alice@example.com", testPassword), victimIP)
	assert.NoError(t, err)

	// Unknown emails are locked out the same way (no enumeration via lockout).
	for i := 0; i < 3; i++ {
		_, _ = svc.LoginFromIP(ctx, loginReq("ghost@example.com", "x"), attacker)
	}
	_, err = svc.LoginFromIP(ctx, loginReq("ghost@example.com", "x"), attacker)
	assert.ErrorIs(t, err, ErrTooManyLoginAttempts)

	// After the lock time the pair can log in again.
	now = now.Add(15*time.Minute + time.Second)
	_, err = svc.LoginFromIP(ctx, loginReq("alice@example.com", testPassword), attacker)
	assert.NoError(t, err)
}

func TestLogin_SuccessResetsFailures(t *testing.T) {
	svc := NewAuthService(newUsersWithAlice(t), nil, nil, nil, nil, hardeningConfig())
	ctx := context.Background()

	for round := 0; round < 3; round++ {
		for i := 0; i < 2; i++ { // below the limit of 3
			_, err := svc.LoginFromIP(ctx, loginReq("alice@example.com", "nope"), "1.2.3.4")
			require.ErrorIs(t, err, ErrInvalidCredentials)
		}
		_, err := svc.LoginFromIP(ctx, loginReq("alice@example.com", testPassword), "1.2.3.4")
		require.NoError(t, err, "round %d", round)
	}
}

func TestLoginLimiter_SweepAndWindow(t *testing.T) {
	l := newLoginAttemptLimiter(2, time.Minute)
	now := time.Now()
	l.now = func() time.Time { return now }

	assert.Zero(t, l.recordFailure("a"))
	// Failures older than the window do not accumulate.
	now = now.Add(2 * time.Minute)
	assert.Zero(t, l.recordFailure("a"))
	assert.Equal(t, time.Minute, l.recordFailure("a"), "second failure inside the window locks")
	assert.Greater(t, l.retryAfter("a"), time.Duration(0))

	assert.Zero(t, l.recordFailure("b"))
	now = now.Add(5 * time.Minute)
	assert.Zero(t, l.retryAfter("a"))
	l.recordFailure("c") // triggers a sweep of stale keys
	assert.Equal(t, 1, l.size())

	d := newLoginAttemptLimiter(0, 0)
	assert.Equal(t, defaultMaxLoginAttempts, d.maxAttempts)
	assert.Equal(t, defaultAccountLockTime, d.lockTime)
}

func TestLoginWithTokens_StoresHashedRefreshToken(t *testing.T) {
	repo := newFakeRefreshRepo()
	cfg := hardeningConfig()
	svc := NewAuthServiceWithRefreshTokens(newUsersWithAlice(t), nil, nil, nil, nil, repo, cfg)

	resp, err := svc.LoginWithTokens(context.Background(), loginReq("alice@example.com", testPassword), "ua", "1.1.1.1")
	require.NoError(t, err)
	assert.Equal(t, int64(cfg.JWT.Expiration.Seconds()), resp.ExpiresIn)

	stored, _ := repo.FindByHash(context.Background(), authDomain.HashToken(resp.RefreshToken))
	require.NotNil(t, stored)
	assert.Equal(t, "alice-id", stored.UserId)
	assert.NotEqual(t, resp.RefreshToken, stored.TokenHash, "only the hash is stored")

	_, err = svc.LoginWithTokens(context.Background(), loginReq("nobody@example.com", "x"), "ua", "1.1.1.1")
	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

// ---------------------------------------------------------------------------
// refresh rotation
// ---------------------------------------------------------------------------

func seedRefreshToken(t *testing.T, repo *fakeRefreshRepo, userId string, expiresAt time.Time) string {
	t.Helper()
	raw, err := utils.GenerateRefreshToken()
	require.NoError(t, err)
	require.NoError(t, repo.Save(context.Background(),
		authDomain.NewRefreshToken("tok-"+raw[:8], userId, authDomain.HashToken(raw), "ua", "ip", expiresAt)))
	return raw
}

func TestRefreshTokens_RotatesAndIssuesValidTokens(t *testing.T) {
	repo := newFakeRefreshRepo()
	cfg := hardeningConfig()
	svc := NewAuthServiceWithRefreshTokens(&fakeUsers{}, nil, nil, nil, nil, repo, cfg)
	raw := seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))

	resp, err := svc.RefreshTokens(context.Background(), raw, "ua", "ip")
	require.NoError(t, err)
	assert.NotEqual(t, raw, resp.RefreshToken)

	claims, err := utils.ParseAccessToken(resp.AccessToken, cfg.JWT)
	require.NoError(t, err)
	assert.Equal(t, "u1", claims.UserId)

	old, _ := repo.FindByHash(context.Background(), authDomain.HashToken(raw))
	require.NotNil(t, old.RevokedAt)
	require.NotNil(t, old.ReplacedBy)
	assert.Equal(t, 1, repo.activeFor("u1"))
}

func TestRefreshTokens_RejectionPaths(t *testing.T) {
	tests := []struct {
		name          string
		setup         func(t *testing.T, repo *fakeRefreshRepo) string
		wantErr       error
		wantRevokeAll bool
	}{
		{
			name:    "unknown token",
			setup:   func(*testing.T, *fakeRefreshRepo) string { return "never-issued" },
			wantErr: ErrInvalidRefreshToken,
		},
		{
			name: "expired token",
			setup: func(t *testing.T, repo *fakeRefreshRepo) string {
				return seedRefreshToken(t, repo, "u1", time.Now().Add(-time.Minute))
			},
			wantErr: ErrRefreshTokenExpired,
		},
		{
			name: "rotated within grace window: 401 but sessions kept",
			setup: func(t *testing.T, repo *fakeRefreshRepo) string {
				raw := seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))
				_, err := repo.Rotate(context.Background(), authDomain.HashToken(raw),
					authDomain.NewRefreshToken("new1", "", "h-new1", "", "", time.Now().Add(time.Hour)),
					time.Now().Add(-5*time.Second), 0)
				require.NoError(t, err)
				return raw
			},
			wantErr: ErrRefreshTokenRotated,
		},
		{
			name: "rotated long ago: reuse detection revokes everything",
			setup: func(t *testing.T, repo *fakeRefreshRepo) string {
				raw := seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))
				_, err := repo.Rotate(context.Background(), authDomain.HashToken(raw),
					authDomain.NewRefreshToken("new2", "", "h-new2", "", "", time.Now().Add(time.Hour)),
					time.Now().Add(-10*time.Minute), 0)
				require.NoError(t, err)
				return raw
			},
			wantErr:       ErrTokenReuse,
			wantRevokeAll: true,
		},
		{
			name: "logged-out token reused: reuse detection",
			setup: func(t *testing.T, repo *fakeRefreshRepo) string {
				raw := seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))
				require.NoError(t, repo.RevokeByHash(context.Background(), authDomain.HashToken(raw)))
				return raw
			},
			wantErr:       ErrTokenReuse,
			wantRevokeAll: true,
		},
		{
			name: "session older than the maximum age: expired, sessions kept",
			setup: func(t *testing.T, repo *fakeRefreshRepo) string {
				raw := seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))
				repo.tokens[authDomain.HashToken(raw)].SessionStartedAt = time.Now().Add(-31 * 24 * time.Hour)
				return raw
			},
			wantErr: ErrRefreshTokenExpired,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := newFakeRefreshRepo()
			svc := NewAuthServiceWithRefreshTokens(&fakeUsers{}, nil, nil, nil, nil, repo, hardeningConfig())
			raw := tc.setup(t, repo)

			resp, err := svc.RefreshTokens(context.Background(), raw, "ua", "ip")
			assert.Nil(t, resp)
			assert.ErrorIs(t, err, tc.wantErr)
			if tc.wantRevokeAll {
				assert.Equal(t, []string{"u1"}, repo.revokeAllCalls)
			} else {
				assert.Empty(t, repo.revokeAllCalls)
			}
		})
	}
}

// A rotated token keeps the session start of the login, and is not issued
// past the absolute session lifetime: a stolen token that keeps rotating
// still dies REFRESH_SESSION_MAX_AGE after the login.
func TestRefreshTokens_AbsoluteSessionLifetime(t *testing.T) {
	repo := newFakeRefreshRepo()
	cfg := hardeningConfig()
	svc := NewAuthServiceWithRefreshTokens(&fakeUsers{}, nil, nil, nil, nil, repo, cfg)
	raw := seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))
	started := time.Now().Add(-29 * 24 * time.Hour)
	repo.tokens[authDomain.HashToken(raw)].SessionStartedAt = started

	resp, err := svc.RefreshTokens(context.Background(), raw, "ua", "ip")
	require.NoError(t, err)
	rotated, err := repo.FindByHash(context.Background(), authDomain.HashToken(resp.RefreshToken))
	require.NoError(t, err)
	assert.True(t, rotated.SessionStartedAt.Equal(started), "the session start is inherited")
	assert.WithinDuration(t, started.Add(30*24*time.Hour), rotated.ExpiresAt, time.Second,
		"capped at the end of the session instead of now + 7 days")

	// One day later the session is over: no further rotation, nothing revoked.
	repo.tokens[authDomain.HashToken(resp.RefreshToken)].SessionStartedAt = time.Now().Add(-30 * 24 * time.Hour)
	_, err = svc.RefreshTokens(context.Background(), resp.RefreshToken, "ua", "ip")
	assert.ErrorIs(t, err, ErrRefreshTokenExpired)
	assert.Empty(t, repo.revokeAllCalls)

	// REFRESH_SESSION_MAX_AGE=0 disables the cap.
	cfg.JWT.RefreshSessionMaxAge = 0
	_, err = svc.RefreshTokens(context.Background(), resp.RefreshToken, "ua", "ip")
	require.NoError(t, err)
}

func TestRefreshTokens_ConcurrentRefreshExactlyOneWins(t *testing.T) {
	repo := newFakeRefreshRepo()
	svc := NewAuthServiceWithRefreshTokens(&fakeUsers{}, nil, nil, nil, nil, repo, hardeningConfig())
	raw := seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))

	const n = 8
	var wg sync.WaitGroup
	errs := make([]error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, errs[i] = svc.RefreshTokens(context.Background(), raw, "ua", "ip")
		}(i)
	}
	wg.Wait()

	successes := 0
	for _, err := range errs {
		if err == nil {
			successes++
			continue
		}
		assert.ErrorIs(t, err, ErrRefreshTokenRotated)
	}
	assert.Equal(t, 1, successes)
	assert.Empty(t, repo.revokeAllCalls, "parallel refresh must not log the user out everywhere")
	assert.Equal(t, 1, repo.activeFor("u1"))
}

func TestRefreshTokens_RepositoryErrors(t *testing.T) {
	svc := NewAuthService(&fakeUsers{}, nil, nil, nil, nil, hardeningConfig())
	_, err := svc.RefreshTokens(context.Background(), "x", "", "")
	assert.Error(t, err, "refresh without repository configured")

	repo := newFakeRefreshRepo()
	repo.rotateErr = errors.New("db down")
	svc = NewAuthServiceWithRefreshTokens(&fakeUsers{}, nil, nil, nil, nil, repo, hardeningConfig())
	_, err = svc.RefreshTokens(context.Background(), "x", "", "")
	assert.EqualError(t, err, "db down")
}

func TestRefreshReuseGraceDefault(t *testing.T) {
	cfg := hardeningConfig()
	cfg.JWT.RefreshReuseGrace = 0
	svc := NewAuthServiceWithRefreshTokens(&fakeUsers{}, nil, nil, nil, nil, newFakeRefreshRepo(), cfg)
	assert.Equal(t, defaultRefreshReuseGrace, svc.refreshReuseGrace())
}

// ---------------------------------------------------------------------------
// logout / misc
// ---------------------------------------------------------------------------

func TestLogoutAndCleanup(t *testing.T) {
	ctx := context.Background()

	noRepo := NewAuthService(&fakeUsers{}, nil, nil, nil, nil, hardeningConfig())
	assert.NoError(t, noRepo.Logout(ctx, "x"))
	assert.NoError(t, noRepo.LogoutAll(ctx, "u1"))
	n, err := noRepo.CleanupExpiredTokens(ctx)
	assert.NoError(t, err)
	assert.Zero(t, n)

	repo := newFakeRefreshRepo()
	svc := NewAuthServiceWithRefreshTokens(&fakeUsers{}, nil, nil, nil, nil, repo, hardeningConfig())
	raw := seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))
	_ = seedRefreshToken(t, repo, "u1", time.Now().Add(time.Hour))

	require.NoError(t, svc.Logout(ctx, raw))
	assert.Equal(t, 1, repo.activeFor("u1"))
	require.NoError(t, svc.LogoutAll(ctx, "u1"))
	assert.Equal(t, 0, repo.activeFor("u1"))

	n, err = svc.CleanupExpiredTokens(ctx)
	assert.NoError(t, err)
	assert.Equal(t, int64(3), n)
}

func TestIssueTokensForUser(t *testing.T) {
	repo := newFakeRefreshRepo()
	cfg := hardeningConfig()
	svc := NewAuthServiceWithRefreshTokens(&fakeUsers{}, nil, nil, nil, nil, repo, cfg)

	resp, err := svc.IssueTokensForUser(context.Background(), "passkey-user", "ua", "ip")
	require.NoError(t, err)
	claims, err := utils.ParseAccessToken(resp.AccessToken, cfg.JWT)
	require.NoError(t, err)
	assert.Equal(t, "passkey-user", claims.UserId)
	assert.Equal(t, 1, repo.activeFor("passkey-user"))
}

func TestLoginLockedErrorMessage(t *testing.T) {
	err := &LoginLockedError{RetryAfter: 90 * time.Second}
	assert.Contains(t, err.Error(), "1m30s")
	assert.True(t, errors.Is(err, ErrTooManyLoginAttempts))
}
