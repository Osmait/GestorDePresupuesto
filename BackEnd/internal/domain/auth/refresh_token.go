package authRequest

import (
	"crypto/sha256"
	"encoding/hex"
	"time"
)

// RefreshToken represents a refresh token stored in the database
type RefreshToken struct {
	Id         string     `json:"id"`
	UserId     string     `json:"user_id"`
	TokenHash  string     `json:"token_hash"`
	ExpiresAt  time.Time  `json:"expires_at"`
	CreatedAt  time.Time  `json:"created_at"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
	ReplacedBy *string    `json:"replaced_by,omitempty"`
	UserAgent  string     `json:"user_agent,omitempty"`
	IpAddress  string     `json:"ip_address,omitempty"`
	// SessionStartedAt is when the session (the login) began. Rotated tokens
	// inherit it, so a session cannot be extended past an absolute lifetime
	// by rotating forever.
	SessionStartedAt time.Time `json:"session_started_at"`
}

// NewRefreshToken creates a new RefreshToken instance
// (the first of a new session: SessionStartedAt is its creation time).
func NewRefreshToken(id, userId, tokenHash, userAgent, ipAddress string, expiresAt time.Time) *RefreshToken {
	now := time.Now()
	return &RefreshToken{
		Id:               id,
		UserId:           userId,
		TokenHash:        tokenHash,
		ExpiresAt:        expiresAt,
		CreatedAt:        now,
		UserAgent:        userAgent,
		IpAddress:        ipAddress,
		SessionStartedAt: now,
	}
}

// IsExpired checks if the token has expired
func (r *RefreshToken) IsExpired() bool {
	return time.Now().After(r.ExpiresAt)
}

// IsRevoked checks if the token has been revoked
func (r *RefreshToken) IsRevoked() bool {
	return r.RevokedAt != nil
}

// IsValid checks if the token is valid (not expired and not revoked)
func (r *RefreshToken) IsValid() bool {
	return !r.IsExpired() && !r.IsRevoked()
}

// HashToken creates a SHA-256 hash of the token
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// AuthResponse represents the response returned after successful authentication
type AuthResponse struct {
	AccessToken  string `json:"access_token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
	RefreshToken string `json:"refresh_token" example:"dGhpcyBpcyBhIHNlY3VyZSByYW5kb20gdG9rZW4..."`
	TokenType    string `json:"token_type" example:"Bearer"`
	ExpiresIn    int64  `json:"expires_in" example:"900"`
}

// NewAuthResponse creates a new AuthResponse
func NewAuthResponse(accessToken, refreshToken string, expiresIn int64) *AuthResponse {
	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    expiresIn,
	}
}

// RefreshRequest represents a request to refresh tokens
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required" example:"dGhpcyBpcyBhIHNlY3VyZSByYW5kb20gdG9rZW4..."`
}
