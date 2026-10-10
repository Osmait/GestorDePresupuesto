package postgress

import (
	"context"
	"database/sql"
	"encoding/json"
	"sync"
	"testing"
	"time"

	passkeyDomain "github.com/osmait/gestorDePresupuesto/internal/domain/passkey"
	passkeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/passkey"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPasskeySessions_SingleUseAcrossInstances(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	// Two repositories on the same DB simulate two API instances.
	instanceA := passkeyRepo.NewPasskeyRepository(db)
	instanceB := passkeyRepo.NewPasskeyRepository(db)

	id := ksuid.New().String()
	require.NoError(t, instanceA.SaveSession(ctx, &passkeyRepo.WebAuthnSession{
		Id:          id,
		Kind:        "login",
		SessionData: []byte(`{"challenge":"abc"}`),
		ExpiresAt:   time.Now().Add(time.Minute),
	}))

	// Wrong kind does not consume it.
	_, err := instanceB.TakeSession(ctx, id, "register")
	assert.ErrorIs(t, err, sql.ErrNoRows)

	// Concurrent takes from both instances: exactly one gets it.
	var wg sync.WaitGroup
	results := make([]error, 6)
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			repo := instanceA
			if i%2 == 1 {
				repo = instanceB
			}
			s, takeErr := repo.TakeSession(ctx, id, "login")
			if takeErr == nil {
				assert.JSONEq(t, `{"challenge":"abc"}`, string(s.SessionData))
				assert.Empty(t, s.UserId)
			}
			results[i] = takeErr
		}(i)
	}
	wg.Wait()

	ok := 0
	for _, r := range results {
		if r == nil {
			ok++
		} else {
			assert.ErrorIs(t, r, sql.ErrNoRows)
		}
	}
	assert.Equal(t, 1, ok)
}

func TestPasskeySessions_ExpiredAndUserBound(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	repo := passkeyRepo.NewPasskeyRepository(db)

	u := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, u))

	expiredID := ksuid.New().String()
	require.NoError(t, repo.SaveSession(ctx, &passkeyRepo.WebAuthnSession{
		Id: expiredID, Kind: "register", UserId: u.Id,
		SessionData: []byte(`{}`), ExpiresAt: time.Now().Add(-time.Second),
	}))
	_, err := repo.TakeSession(ctx, expiredID, "register")
	assert.ErrorIs(t, err, sql.ErrNoRows, "expired sessions are rejected")

	liveID := ksuid.New().String()
	require.NoError(t, repo.SaveSession(ctx, &passkeyRepo.WebAuthnSession{
		Id: liveID, Kind: "register", UserId: u.Id,
		SessionData: []byte(`{"user_id":"x"}`), ExpiresAt: time.Now().Add(time.Minute),
	}))
	s, err := repo.TakeSession(ctx, liveID, "register")
	require.NoError(t, err)
	assert.Equal(t, u.Id, s.UserId)
}

func TestPasskeyRepository_UpdateSignCountKeepsCredentialJSONInSync(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	repo := passkeyRepo.NewPasskeyRepository(db)

	u := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, u))

	pk := &passkeyDomain.Passkey{
		Id:             ksuid.New().String(),
		UserId:         u.Id,
		CredentialId:   []byte("cred-" + ksuid.New().String()),
		PublicKey:      []byte("pk"),
		SignCount:      1,
		Name:           "Test key",
		CredentialJSON: []byte(`{"authenticator":{"signCount":1}}`),
		CreatedAt:      time.Now(),
	}
	require.NoError(t, repo.Save(ctx, pk))

	require.NoError(t, repo.UpdateSignCount(ctx, pk.Id, 7, []byte(`{"authenticator":{"signCount":7}}`)))
	got, err := repo.FindByCredentialId(ctx, pk.CredentialId)
	require.NoError(t, err)
	assert.Equal(t, uint32(7), got.SignCount)
	var decoded struct {
		Authenticator struct {
			SignCount uint32 `json:"signCount"`
		} `json:"authenticator"`
	}
	require.NoError(t, json.Unmarshal(got.CredentialJSON, &decoded))
	assert.Equal(t, uint32(7), decoded.Authenticator.SignCount, "credential_json must follow the counter")
	assert.NotNil(t, got.LastUsedAt)

	// nil JSON keeps the stored document.
	require.NoError(t, repo.UpdateSignCount(ctx, pk.Id, 8, nil))
	got, err = repo.FindByCredentialId(ctx, pk.CredentialId)
	require.NoError(t, err)
	assert.Equal(t, uint32(8), got.SignCount)
	assert.NotEmpty(t, got.CredentialJSON)

	assert.ErrorIs(t, repo.UpdateSignCount(ctx, "missing", 1, nil), sql.ErrNoRows)
}
