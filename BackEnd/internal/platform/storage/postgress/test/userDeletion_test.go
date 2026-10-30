package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainapikey "github.com/osmait/gestorDePresupuesto/internal/domain/apikey"
	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	apikeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/apikey"
	authRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/auth"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

// Deleting a user ends their access: their API keys (used by MCP clients)
// stop resolving and their refresh tokens are revoked.
func TestUserSoftDelete_EndsAccess(t *testing.T) {
	ctx := context.Background()
	db := SetUpTest()
	users := userRepo.NewUserRepository(db)
	keys := apikeyRepo.NewAPIKeyRepository(db)

	user := utils.GetNewRandomUser()
	require.NoError(t, users.Save(ctx, user))
	other := utils.GetNewRandomUser()
	require.NoError(t, users.Save(ctx, other))

	newKey := func(userID string) string {
		hash := "hash-" + ksuid.New().String()
		require.NoError(t, keys.Save(ctx, &domainapikey.APIKey{
			ID: ksuid.New().String(), UserID: userID, Name: "claude", KeyHash: hash, KeyPrefix: "sk_live_x", IsActive: true,
		}))
		return hash
	}
	userKey, otherKey := newKey(user.Id), newKey(other.Id)

	raw, err := utils.GenerateRefreshToken()
	require.NoError(t, err)
	require.NoError(t, authRepo.NewRefreshTokenRepository(db).Save(ctx, authDomain.NewRefreshToken(
		ksuid.New().String(), user.Id, authDomain.HashToken(raw), "ua", "127.0.0.1", time.Now().Add(time.Hour))))

	_, err = keys.FindByKeyHash(ctx, userKey)
	require.NoError(t, err)

	require.NoError(t, users.SoftDelete(ctx, user.Id))

	_, err = keys.FindByKeyHash(ctx, userKey)
	assert.Error(t, err, "a deleted user's API key must not resolve")
	var active bool
	require.NoError(t, db.QueryRow(`SELECT is_active FROM user_api_keys WHERE key_hash = $1`, userKey).Scan(&active))
	assert.False(t, active)
	var revoked int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`, user.Id).Scan(&revoked))
	assert.Zero(t, revoked)

	_, err = keys.FindByKeyHash(ctx, otherKey)
	assert.NoError(t, err, "other users keep their keys")
}
