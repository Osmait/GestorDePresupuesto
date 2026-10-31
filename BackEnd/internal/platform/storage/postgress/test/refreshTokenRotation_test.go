package postgress

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	authRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/auth"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	authSvc "github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func rotationConfig(grace time.Duration) *config.Config {
	return &config.Config{JWT: config.JWTConfig{
		Secret:            "rotation-integration-secret-at-least-32-chars",
		Expiration:        15 * time.Minute,
		RefreshExpiration: 24 * time.Hour,
		Issuer:            "gestor-test",
		Audience:          "gestor-test-api",
		RefreshReuseGrace: grace,
	}}
}

// seedUserWithRefreshToken creates a user and an active refresh token for it.
func seedUserWithRefreshToken(t *testing.T, repo *authRepo.RefreshTokenRepository) (userID, raw string) {
	t.Helper()
	ctx := context.Background()
	u := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(SetUpTest()).Save(ctx, u))

	raw, err := utils.GenerateRefreshToken()
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, authDomain.NewRefreshToken(
		ksuid.New().String(), u.Id, authDomain.HashToken(raw), "ua", "127.0.0.1", time.Now().Add(time.Hour))))
	return u.Id, raw
}

func activeTokens(t *testing.T, repo *authRepo.RefreshTokenRepository, userID string) int {
	t.Helper()
	list, err := repo.FindByUserId(context.Background(), userID)
	require.NoError(t, err)
	return len(list)
}

// TestRefreshRotation_ConcurrentExactlyOneSucceeds hammers the same refresh
// token from several goroutines against real Postgres: the conditional UPDATE
// must let exactly one rotation through, and the losers (inside the grace
// window) must NOT revoke the winner's new session.
func TestRefreshRotation_ConcurrentExactlyOneSucceeds(t *testing.T) {
	db := SetUpTest()
	repo := authRepo.NewRefreshTokenRepository(db)
	svc := authSvc.NewAuthServiceWithRefreshTokens(userRepo.NewUserRepository(db), nil, nil, nil, nil, repo,
		rotationConfig(30*time.Second))
	userID, raw := seedUserWithRefreshToken(t, repo)

	const n = 10
	var wg sync.WaitGroup
	start := make(chan struct{})
	errs := make([]error, n)
	newTokens := make([]string, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			resp, err := svc.RefreshTokens(context.Background(), raw, "ua", "127.0.0.1")
			errs[i] = err
			if resp != nil {
				newTokens[i] = resp.RefreshToken
			}
		}(i)
	}
	close(start)
	wg.Wait()

	winners := 0
	var winnerToken string
	for i, err := range errs {
		if err == nil {
			winners++
			winnerToken = newTokens[i]
			continue
		}
		assert.ErrorIs(t, err, authSvc.ErrRefreshTokenRotated)
		assert.ErrorIs(t, err, authSvc.ErrInvalidRefreshToken)
	}
	require.Equal(t, 1, winners, "errors: %v", errs)
	assert.Equal(t, 1, activeTokens(t, repo, userID), "winner's new token must still be active")

	// The winner's token keeps working.
	_, err := svc.RefreshTokens(context.Background(), winnerToken, "ua", "127.0.0.1")
	assert.NoError(t, err)
}

// TestRefreshRotation_ReuseAfterGraceRevokesAll checks that presenting a
// rotated token after the grace window is treated as theft.
func TestRefreshRotation_ReuseAfterGraceRevokesAll(t *testing.T) {
	db := SetUpTest()
	repo := authRepo.NewRefreshTokenRepository(db)
	svc := authSvc.NewAuthServiceWithRefreshTokens(userRepo.NewUserRepository(db), nil, nil, nil, nil, repo,
		rotationConfig(50*time.Millisecond))
	userID, raw := seedUserWithRefreshToken(t, repo)

	_, err := svc.RefreshTokens(context.Background(), raw, "ua", "127.0.0.1")
	require.NoError(t, err)
	require.Equal(t, 1, activeTokens(t, repo, userID))

	time.Sleep(100 * time.Millisecond)
	_, err = svc.RefreshTokens(context.Background(), raw, "ua", "127.0.0.1")
	assert.ErrorIs(t, err, authSvc.ErrTokenReuse)
	assert.Equal(t, 0, activeTokens(t, repo, userID), "all sessions revoked after stale reuse")
}

func TestRefreshTokenRepository_RotateConditions(t *testing.T) {
	db := SetUpTest()
	repo := authRepo.NewRefreshTokenRepository(db)
	ctx := context.Background()
	userID, raw := seedUserWithRefreshToken(t, repo)

	newTok := authDomain.NewRefreshToken(ksuid.New().String(), "", "hash-"+ksuid.New().String(), "ua", "ip", time.Now().Add(time.Hour))
	got, err := repo.Rotate(ctx, authDomain.HashToken(raw), newTok, time.Now(), 0)
	require.NoError(t, err)
	assert.Equal(t, userID, got)
	assert.Equal(t, userID, newTok.UserId)

	stored, err := repo.FindByHash(ctx, authDomain.HashToken(raw))
	require.NoError(t, err)
	require.NotNil(t, stored.ReplacedBy)
	assert.Equal(t, newTok.Id, *stored.ReplacedBy)

	// Second rotation of the same token: not active anymore, nothing inserted.
	again := authDomain.NewRefreshToken(ksuid.New().String(), "", "hash-"+ksuid.New().String(), "ua", "ip", time.Now().Add(time.Hour))
	_, err = repo.Rotate(ctx, authDomain.HashToken(raw), again, time.Now(), 0)
	assert.ErrorIs(t, err, authRepo.ErrTokenNotActive)
	missing, err := repo.FindByHash(ctx, again.TokenHash)
	require.NoError(t, err)
	assert.Nil(t, missing)

	// Unknown and expired tokens are not active either.
	_, err = repo.Rotate(ctx, "unknown-hash", again, time.Now(), 0)
	assert.ErrorIs(t, err, authRepo.ErrTokenNotActive)
	_, err = repo.Rotate(ctx, newTok.TokenHash, again, time.Now().Add(2*time.Hour), 0)
	assert.ErrorIs(t, err, authRepo.ErrTokenNotActive)
}

// TestRefreshRotation_AbsoluteSessionLifetime: rotated tokens inherit the
// session start of the login, their expiry is capped at the end of the
// session, rotation past REFRESH_SESSION_MAX_AGE is refused without revoking
// anything, and reuse detection still applies to rotated tokens.
func TestRefreshRotation_AbsoluteSessionLifetime(t *testing.T) {
	db := SetUpTest()
	repo := authRepo.NewRefreshTokenRepository(db)
	cfg := rotationConfig(30 * time.Second)
	cfg.JWT.RefreshSessionMaxAge = 30 * 24 * time.Hour
	svc := authSvc.NewAuthServiceWithRefreshTokens(userRepo.NewUserRepository(db), nil, nil, nil, nil, repo, cfg)
	ctx := context.Background()
	userID, raw := seedUserWithRefreshToken(t, repo)

	// The login happened 29.5 days ago.
	started := time.Now().Add(-(29*24 + 12) * time.Hour).Truncate(time.Microsecond)
	_, err := db.Exec(`UPDATE refresh_tokens SET session_started_at = $1 WHERE token_hash = $2`, started, authDomain.HashToken(raw))
	require.NoError(t, err)

	resp, err := svc.RefreshTokens(ctx, raw, "ua", "127.0.0.1")
	require.NoError(t, err)
	rotated, err := repo.FindByHash(ctx, authDomain.HashToken(resp.RefreshToken))
	require.NoError(t, err)
	require.NotNil(t, rotated)
	assert.True(t, rotated.SessionStartedAt.Equal(started), "inherited %s, want %s", rotated.SessionStartedAt, started)
	assert.WithinDuration(t, started.Add(30*24*time.Hour), rotated.ExpiresAt, time.Second,
		"expiry capped at the end of the session, not now + 24h")

	// Twice rotated: still the same session start.
	resp2, err := svc.RefreshTokens(ctx, resp.RefreshToken, "ua", "127.0.0.1")
	require.NoError(t, err)
	rotated2, err := repo.FindByHash(ctx, authDomain.HashToken(resp2.RefreshToken))
	require.NoError(t, err)
	assert.True(t, rotated2.SessionStartedAt.Equal(started))

	// The session is over: the live token cannot be rotated, nothing revoked.
	_, err = db.Exec(`UPDATE refresh_tokens SET session_started_at = now() - interval '31 days' WHERE user_id = $1`, userID)
	require.NoError(t, err)
	_, err = svc.RefreshTokens(ctx, resp2.RefreshToken, "ua", "127.0.0.1")
	assert.ErrorIs(t, err, authSvc.ErrRefreshTokenExpired)
	assert.Equal(t, 1, activeTokens(t, repo, userID), "an over-age session is not treated as theft")

	// Reuse detection still works: presenting the first rotated token again
	// (outside the grace window) revokes every session.
	_, err = db.Exec(`UPDATE refresh_tokens SET revoked_at = now() - interval '1 hour' WHERE token_hash = $1`, authDomain.HashToken(resp.RefreshToken))
	require.NoError(t, err)
	_, err = svc.RefreshTokens(ctx, resp.RefreshToken, "ua", "127.0.0.1")
	assert.ErrorIs(t, err, authSvc.ErrTokenReuse)
	assert.Equal(t, 0, activeTokens(t, repo, userID))

	// A new login starts a new session.
	fresh := authDomain.NewRefreshToken(ksuid.New().String(), userID, "hash-"+ksuid.New().String(), "ua", "ip", time.Now().Add(time.Hour))
	require.NoError(t, repo.Save(ctx, fresh))
	stored, err := repo.FindByHash(ctx, fresh.TokenHash)
	require.NoError(t, err)
	assert.WithinDuration(t, time.Now(), stored.SessionStartedAt, time.Minute)
}
