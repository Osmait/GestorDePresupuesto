package mcpoauth

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/plexusone/omniskill/mcp/oauth2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The MCP endpoints identify the caller by the user stored with the token. The
// token subject is an email: if it were resolved on every request, swapping
// two users' emails would hand one user's token the other user's data.
func TestStorage_UserIDForAccessToken(t *testing.T) {
	t.Parallel()
	s := New(testDB)
	c := newClient(t, s, "")

	t.Run("stays the issuing user when emails change", func(t *testing.T) {
		t.Parallel()
		ownerID, ownerEmail := newUser(t)
		victimID, _ := newUser(t)
		tok := newToken(t, s, c.ClientID, ownerEmail, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))

		// The owner gives up the email and the victim takes it.
		_, err := testDB.Exec(`UPDATE users SET email = $1 WHERE id = $2`, "moved-"+uuid.NewString()+"@example.com", ownerID)
		require.NoError(t, err)
		_, err = testDB.Exec(`UPDATE users SET email = $1 WHERE id = $2`, ownerEmail, victimID)
		require.NoError(t, err)

		got, err := s.UserIDForAccessToken(tok.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, ownerID, got)
	})

	t.Run("expired token, deleted user and unknown token resolve to nobody", func(t *testing.T) {
		t.Parallel()
		_, email := newUser(t)
		expired := newToken(t, s, c.ClientID, email, time.Now().Add(-time.Minute), time.Now().Add(time.Hour))
		_, err := s.UserIDForAccessToken(expired.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)

		deletedID, deletedEmail := newUser(t)
		tok := newToken(t, s, c.ClientID, deletedEmail, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))
		_, err = testDB.Exec(`UPDATE users SET deleted_at = NOW() WHERE id = $1`, deletedID)
		require.NoError(t, err)
		_, err = s.UserIDForAccessToken(tok.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)

		_, err = s.UserIDForAccessToken("not-a-token")
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)
	})
}
