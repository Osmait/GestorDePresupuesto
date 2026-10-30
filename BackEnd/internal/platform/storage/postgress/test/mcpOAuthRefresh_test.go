package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/plexusone/omniskill/mcp/oauth2"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/mcpoauth"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

// A refreshed MCP token stays with the user it was issued to. omniskill
// copies the consumed token's subject into the new one; when that subject was
// the email, a user whose email changed (and was registered again by someone
// else) silently became the other account on the next refresh.
func TestMCPOAuthRefresh_KeepsTheUserWhenTheEmailMoves(t *testing.T) {
	ctx := context.Background()
	users := userRepo.NewUserRepository(testDB)
	alice := utils.GetNewRandomUser()
	require.NoError(t, users.Save(ctx, alice))
	store := mcpoauth.New(testDB)
	clientID := "client-" + newID()
	require.NoError(t, store.CreateClient(&oauth2.Client{ClientID: clientID, ClientName: "Claude",
		RedirectURIs: []string{"https://claude.ai/api/mcp/auth_callback"}, TokenEndpointAuthMethod: "none"}))

	now := time.Now()
	require.NoError(t, store.CreateToken(&oauth2.TokenInfo{
		AccessToken: "access-1-" + newID(), RefreshToken: "refresh-1-" + alice.Id,
		ClientID: clientID, Subject: alice.Email, Scope: "mcp:read",
		ExpiresAt: now.Add(time.Hour), RefreshExpiresAt: now.Add(24 * time.Hour),
	}))

	// Alice's email is changed and someone else registers it.
	oldEmail := alice.Email
	_, err := testDB.Exec(`UPDATE users SET email = $1 WHERE id = $2`, "moved-"+alice.Email, alice.Id)
	require.NoError(t, err)
	mallory := utils.GetNewRandomUser()
	mallory.Email = oldEmail
	require.NoError(t, users.Save(ctx, mallory))

	// The refresh omniskill performs: consume, then store a new token with the
	// consumed token's subject.
	old, err := store.GetTokenByRefresh("refresh-1-" + alice.Id)
	require.NoError(t, err)
	access2 := "access-2-" + newID()
	require.NoError(t, store.CreateToken(&oauth2.TokenInfo{
		AccessToken: access2, RefreshToken: "refresh-2-" + alice.Id,
		ClientID: old.ClientID, Subject: old.Subject, Scope: old.Scope,
		ExpiresAt: now.Add(time.Hour), RefreshExpiresAt: now.Add(24 * time.Hour),
	}))

	userID, err := store.UserIDForAccessToken(access2)
	require.NoError(t, err)
	require.Equal(t, alice.Id, userID, "the refreshed token must stay with Alice, not follow the email to %s", mallory.Id)
}
