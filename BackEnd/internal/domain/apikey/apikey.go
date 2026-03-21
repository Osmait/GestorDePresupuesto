package apikey

import "time"

type APIKey struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	Name       string     `json:"name"`
	KeyHash    string     `json:"-"`
	KeyPrefix  string     `json:"key_prefix"`
	LastUsedAt *time.Time `json:"last_used_at"`
	ExpiresAt  *time.Time `json:"expires_at"`
	CreatedAt  time.Time  `json:"created_at"`
	IsActive   bool       `json:"is_active"`
}

// APIKeyWithToken wraps APIKey and carries the plaintext token returned only
// at creation time. Token is never stored.
type APIKeyWithToken struct {
	*APIKey
	Token string `json:"token"`
}

func NewAPIKey(id, userID, name, keyHash, keyPrefix string) *APIKey {
	return &APIKey{
		ID:        id,
		UserID:    userID,
		Name:      name,
		KeyHash:   keyHash,
		KeyPrefix: keyPrefix,
		IsActive:  true,
	}
}
