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
	got, err := repo.Rotate(ctx, authDomain.HashToken(raw), newTok, time.Now())
	require.NoError(t, err)
	assert.Equal(t, userID, got)
	assert.Equal(t, userID, newTok.UserId)

	stored, err := repo.FindByHash(ctx, authDomain.HashToken(raw))
	require.NoError(t, err)
	require.NotNil(t, stored.ReplacedBy)
	assert.Equal(t, newTok.Id, *stored.ReplacedBy)

	// Second rotation of the same token: not active anymore, nothing inserted.
	again := authDomain.NewRefreshToken(ksuid.New().String(), "", "hash-"+ksuid.New().String(), "ua", "ip", time.Now().Add(time.Hour))
	_, err = repo.Rotate(ctx, authDomain.HashToken(raw), again, time.Now())
	assert.ErrorIs(t, err, authRepo.ErrTokenNotActive)
	missing, err := repo.FindByHash(ctx, again.TokenHash)
	require.NoError(t, err)
	assert.Nil(t, missing)

	// Unknown and expired tokens are not active either.
	_, err = repo.Rotate(ctx, "unknown-hash", again, time.Now())
	assert.ErrorIs(t, err, authRepo.ErrTokenNotActive)
	_, err = repo.Rotate(ctx, newTok.TokenHash, again, time.Now().Add(2*time.Hour))
	assert.ErrorIs(t, err, authRepo.ErrTokenNotActive)
}
