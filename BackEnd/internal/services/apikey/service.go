package apikey

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/domain/apikey"
	apikeyRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/apikey"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

// APIKeyService handles business logic for API key management.
type APIKeyService struct {
	repo apikeyRepo.APIKeyRepositoryInterface
}

// NewAPIKeyService creates a new instance of APIKeyService.
func NewAPIKeyService(repo apikeyRepo.APIKeyRepositoryInterface) *APIKeyService {
	return &APIKeyService{repo: repo}
}

// GenerateKey creates a new API key for the given user. The plaintext token is
// returned only once inside APIKeyWithToken and is never stored.
func (s *APIKeyService) GenerateKey(ctx context.Context, userID, name string) (*apikey.APIKeyWithToken, error) {
	// Generate 32 random bytes and encode them as hex.
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		return nil, err
	}
	token := "sk_live_" + hex.EncodeToString(rawBytes)

	// SHA-256 hash of the plaintext token — only this is stored.
	sum := sha256.Sum256([]byte(token))
	keyHash := hex.EncodeToString(sum[:])

	// First 12 chars of the token (after the prefix) as the visible prefix.
	keyPrefix := token[:12]

	id := uuid.New().String()
	key := apikey.NewAPIKey(id, userID, name, keyHash, keyPrefix)

	if err := s.repo.Save(ctx, key); err != nil {
		return nil, err
	}

	return &apikey.APIKeyWithToken{APIKey: key, Token: token}, nil
}

// ValidateKey looks up a raw token by its hash, checks it is active and not
// expired, records the last-used timestamp, and returns the key record.
func (s *APIKeyService) ValidateKey(ctx context.Context, rawToken string) (*apikey.APIKey, error) {
	sum := sha256.Sum256([]byte(rawToken))
	keyHash := hex.EncodeToString(sum[:])

	key, err := s.repo.FindByKeyHash(ctx, keyHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errorhttp.ErrUnauthorized
		}
		return nil, err
	}

	if !key.IsActive {
		return nil, errorhttp.ErrUnauthorized
	}

	if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
		return nil, errorhttp.ErrUnauthorized
	}

	// Best-effort update; do not fail validation if this write fails.
	_ = s.repo.UpdateLastUsed(ctx, key.ID)

	return key, nil
}

// ListKeys returns all API keys for the given user (hashes are omitted via JSON tag).
func (s *APIKeyService) ListKeys(ctx context.Context, userID string) ([]*apikey.APIKey, error) {
	return s.repo.FindByUserID(ctx, userID)
}

// RevokeKey deletes an API key by ID, scoped to the owning user.
func (s *APIKeyService) RevokeKey(ctx context.Context, id, userID string) error {
	err := s.repo.Delete(ctx, id, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return errorhttp.ErrNotFound
	}
	return err
}
