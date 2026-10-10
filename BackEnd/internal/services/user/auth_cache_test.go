package user

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

func TestFindActiveUserForAuth_CachesUntilTTL(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	svc := NewUserService(mockRepo)
	svc.EnableAuthCache(15 * time.Second)
	now := time.Unix(1_700_000_000, 0)
	svc.authCache.now = func() time.Time { return now }

	u := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", mock.Anything, u.Id).Return(u, nil).Once()

	first, err := svc.FindActiveUserForAuth(context.Background(), u.Id)
	require.NoError(t, err)
	second, err := svc.FindActiveUserForAuth(context.Background(), u.Id)
	require.NoError(t, err)
	assert.Equal(t, first, second)
	mockRepo.AssertNumberOfCalls(t, "FindUserById", 1)

	// After the TTL the lookup hits the repository again.
	now = now.Add(16 * time.Second)
	mockRepo.On("FindUserById", mock.Anything, u.Id).Return(u, nil).Once()
	_, err = svc.FindActiveUserForAuth(context.Background(), u.Id)
	require.NoError(t, err)
	mockRepo.AssertNumberOfCalls(t, "FindUserById", 2)
}

func TestFindActiveUserForAuth_InvalidatedByMutations(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	svc := NewUserService(mockRepo)
	svc.EnableAuthCache(time.Minute)

	u := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", mock.Anything, u.Id).Return(u, nil)
	mockRepo.On("SoftDelete", mock.Anything, u.Id).Return(nil)

	_, err := svc.FindActiveUserForAuth(context.Background(), u.Id)
	require.NoError(t, err)
	_, ok := cachedAuthUser(svc, u.Id)
	require.True(t, ok)

	// Deactivating the user must drop the cached entry immediately.
	require.NoError(t, svc.SoftDeleteUser(context.Background(), u.Id))
	_, ok = cachedAuthUser(svc, u.Id)
	assert.False(t, ok, "soft delete must invalidate the auth cache")
}

func TestFindActiveUserForAuth_DisabledByDefault(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	svc := NewUserService(mockRepo)

	u := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", mock.Anything, u.Id).Return(u, nil)

	for i := 0; i < 2; i++ {
		_, err := svc.FindActiveUserForAuth(context.Background(), u.Id)
		require.NoError(t, err)
	}
	mockRepo.AssertNumberOfCalls(t, "FindUserById", 2)
}

func cachedAuthUser(svc *UserService, id string) (any, bool) {
	u, _, ok := svc.authCache.get(id)
	return u, ok
}
