package apikey

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/apikey"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockAPIKeyRepository satisfies APIKeyRepositoryInterface for testing.
type MockAPIKeyRepository struct {
	mock.Mock
}

func (m *MockAPIKeyRepository) Save(ctx context.Context, key *apikey.APIKey) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *MockAPIKeyRepository) FindByKeyHash(ctx context.Context, keyHash string) (*apikey.APIKey, error) {
	args := m.Called(ctx, keyHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*apikey.APIKey), args.Error(1)
}

func (m *MockAPIKeyRepository) FindByUserID(ctx context.Context, userID string) ([]*apikey.APIKey, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*apikey.APIKey), args.Error(1)
}

func (m *MockAPIKeyRepository) FindByID(ctx context.Context, id string) (*apikey.APIKey, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*apikey.APIKey), args.Error(1)
}

func (m *MockAPIKeyRepository) UpdateLastUsed(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAPIKeyRepository) Delete(ctx context.Context, id, userID string) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

// hashToken is a test helper that replicates the SHA-256 hashing done in the service.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// --- GenerateKey ---

func TestGenerateKey_Success(t *testing.T) {
	mockRepo := &MockAPIKeyRepository{}
	svc := NewAPIKeyService(mockRepo)
	ctx := context.Background()

	mockRepo.On("Save", ctx, mock.AnythingOfType("*apikey.APIKey")).Return(nil)

	result, err := svc.GenerateKey(ctx, "user-1", "my key")

	require.NoError(t, err)
	require.NotNil(t, result)

	// Token must carry the expected prefix.
	assert.True(t, strings.HasPrefix(result.Token, "sk_live_"), "token should start with sk_live_")

	// The stored hash must match the SHA-256 of the returned plaintext token.
	expectedHash := hashToken(result.Token)
	assert.Equal(t, expectedHash, result.KeyHash)

	// The key prefix stored in the record must be the first 12 chars of the token.
	assert.Equal(t, result.Token[:12], result.KeyPrefix)

	// The key must be active after creation.
	assert.True(t, result.IsActive)

	mockRepo.AssertExpectations(t)
}

func TestGenerateKey_RepositoryError(t *testing.T) {
	mockRepo := &MockAPIKeyRepository{}
	svc := NewAPIKeyService(mockRepo)
	ctx := context.Background()

	repoErr := errors.New("db unavailable")
	mockRepo.On("Save", ctx, mock.AnythingOfType("*apikey.APIKey")).Return(repoErr)

	result, err := svc.GenerateKey(ctx, "user-1", "my key")

	assert.Nil(t, result)
	assert.ErrorIs(t, err, repoErr)
	mockRepo.AssertExpectations(t)
}

// --- ValidateKey ---

func TestValidateKey(t *testing.T) {
	activeKey := &apikey.APIKey{
		ID:       "key-1",
		UserID:   "user-1",
		IsActive: true,
	}

	pastTime := time.Now().Add(-time.Hour)
	expiredKey := &apikey.APIKey{
		ID:        "key-2",
		UserID:    "user-1",
		IsActive:  true,
		ExpiresAt: &pastTime,
	}

	inactiveKey := &apikey.APIKey{
		ID:       "key-3",
		UserID:   "user-1",
		IsActive: false,
	}

	futureTime := time.Now().Add(time.Hour * 24)
	activeKeyWithExpiry := &apikey.APIKey{
		ID:        "key-4",
		UserID:    "user-1",
		IsActive:  true,
		ExpiresAt: &futureTime,
	}

	tests := []struct {
		name          string
		rawToken      string
		repoKey       *apikey.APIKey
		repoErr       error
		wantErr       error
		wantKey       bool
		setupLastUsed bool
	}{
		{
			name:          "valid active key",
			rawToken:      "sk_live_validtoken",
			repoKey:       activeKey,
			repoErr:       nil,
			wantErr:       nil,
			wantKey:       true,
			setupLastUsed: true,
		},
		{
			name:          "valid active key with future expiry",
			rawToken:      "sk_live_validtokenwithexpiry",
			repoKey:       activeKeyWithExpiry,
			repoErr:       nil,
			wantErr:       nil,
			wantKey:       true,
			setupLastUsed: true,
		},
		{
			name:          "token not found returns ErrUnauthorized",
			rawToken:      "sk_live_unknown",
			repoKey:       nil,
			repoErr:       sql.ErrNoRows,
			wantErr:       errorhttp.ErrUnauthorized,
			wantKey:       false,
			setupLastUsed: false,
		},
		{
			name:          "repository generic error is propagated",
			rawToken:      "sk_live_badtoken",
			repoKey:       nil,
			repoErr:       errors.New("connection reset"),
			wantErr:       errors.New("connection reset"),
			wantKey:       false,
			setupLastUsed: false,
		},
		{
			name:          "inactive key returns ErrUnauthorized",
			rawToken:      "sk_live_inactivetoken",
			repoKey:       inactiveKey,
			repoErr:       nil,
			wantErr:       errorhttp.ErrUnauthorized,
			wantKey:       false,
			setupLastUsed: false,
		},
		{
			name:          "expired key returns ErrUnauthorized",
			rawToken:      "sk_live_expiredtoken",
			repoKey:       expiredKey,
			repoErr:       nil,
			wantErr:       errorhttp.ErrUnauthorized,
			wantKey:       false,
			setupLastUsed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockAPIKeyRepository{}
			svc := NewAPIKeyService(mockRepo)
			ctx := context.Background()

			expectedHash := hashToken(tt.rawToken)
			mockRepo.On("FindByKeyHash", ctx, expectedHash).Return(tt.repoKey, tt.repoErr)

			if tt.setupLastUsed {
				// UpdateLastUsed is best-effort; allow any outcome.
				mockRepo.On("UpdateLastUsed", ctx, tt.repoKey.ID).Return(nil)
			}

			key, err := svc.ValidateKey(ctx, tt.rawToken)

			if tt.wantErr != nil {
				require.Error(t, err)
				// For sentinel errors use errors.Is; for generic errors check message.
				if errors.Is(tt.wantErr, errorhttp.ErrUnauthorized) {
					assert.ErrorIs(t, err, errorhttp.ErrUnauthorized)
				} else {
					assert.EqualError(t, err, tt.wantErr.Error())
				}
				assert.Nil(t, key)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, key)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// --- ListKeys ---

func TestListKeys_ReturnsKeysFromRepository(t *testing.T) {
	mockRepo := &MockAPIKeyRepository{}
	svc := NewAPIKeyService(mockRepo)
	ctx := context.Background()
	userID := "user-1"

	expected := []*apikey.APIKey{
		{ID: "key-1", UserID: userID, Name: "ci", IsActive: true},
		{ID: "key-2", UserID: userID, Name: "prod", IsActive: true},
	}
	mockRepo.On("FindByUserID", ctx, userID).Return(expected, nil)

	keys, err := svc.ListKeys(ctx, userID)

	require.NoError(t, err)
	assert.Equal(t, expected, keys)
	mockRepo.AssertExpectations(t)
}

func TestListKeys_RepositoryError(t *testing.T) {
	mockRepo := &MockAPIKeyRepository{}
	svc := NewAPIKeyService(mockRepo)
	ctx := context.Background()
	userID := "user-1"

	repoErr := errors.New("db error")
	mockRepo.On("FindByUserID", ctx, userID).Return(nil, repoErr)

	keys, err := svc.ListKeys(ctx, userID)

	assert.Nil(t, keys)
	assert.ErrorIs(t, err, repoErr)
	mockRepo.AssertExpectations(t)
}

// --- RevokeKey ---

func TestRevokeKey(t *testing.T) {
	tests := []struct {
		name    string
		repoErr error
		wantErr error
	}{
		{
			name:    "successful revocation",
			repoErr: nil,
			wantErr: nil,
		},
		{
			name:    "key not found maps to ErrNotFound",
			repoErr: sql.ErrNoRows,
			wantErr: errorhttp.ErrNotFound,
		},
		{
			name:    "generic repository error is propagated",
			repoErr: errors.New("db failure"),
			wantErr: errors.New("db failure"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockAPIKeyRepository{}
			svc := NewAPIKeyService(mockRepo)
			ctx := context.Background()

			keyID := "key-1"
			userID := "user-1"
			mockRepo.On("Delete", ctx, keyID, userID).Return(tt.repoErr)

			err := svc.RevokeKey(ctx, keyID, userID)

			if tt.wantErr != nil {
				require.Error(t, err)
				if errors.Is(tt.wantErr, errorhttp.ErrNotFound) {
					assert.ErrorIs(t, err, errorhttp.ErrNotFound)
				} else {
					assert.EqualError(t, err, tt.wantErr.Error())
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
