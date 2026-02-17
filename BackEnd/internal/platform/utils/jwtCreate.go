package utils

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/osmait/gestorDePresupuesto/internal/config"
)

// AppClaims represents the JWT claims structure with user-specific data
type AppClaims struct {
	UserId string `json:"id"`
	jwt.RegisteredClaims
}

// JwtCreate creates a JWT token with the provided secret (legacy - uses default 72h expiration)
func JwtCreate(id string, secret string) (*string, error) {
	return CreateAccessToken(id, secret, 72*time.Hour)
}

// CreateAccessToken creates a JWT access token with configurable expiration
func CreateAccessToken(id string, secret string, expiration time.Duration) (*string, error) {
	if id == "" {
		return nil, errors.New("id is void")
	}

	if secret == "" {
		return nil, errors.New("secret is required")
	}

	claims := AppClaims{
		UserId: id,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign and get the complete encoded token as a string using the provided secret
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return nil, err
	}

	return &tokenString, nil
}

// CreateAccessTokenFromConfig creates a JWT access token using config settings
func CreateAccessTokenFromConfig(id string, jwtConfig config.JWTConfig) (*string, error) {
	return CreateAccessToken(id, jwtConfig.Secret, jwtConfig.Expiration)
}

// GenerateRefreshToken generates a cryptographically secure random refresh token
func GenerateRefreshToken() (string, error) {
	// 32 bytes = 256 bits of entropy
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	// Base64 URL-safe encoding without padding
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// TokenPair represents a pair of access and refresh tokens
type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int64 // Access token expiration in seconds
}

// CreateTokenPair creates both access and refresh tokens
func CreateTokenPair(userId string, jwtConfig config.JWTConfig) (*TokenPair, error) {
	// Create access token
	accessToken, err := CreateAccessTokenFromConfig(userId, jwtConfig)
	if err != nil {
		return nil, err
	}

	// Generate refresh token
	refreshToken, err := GenerateRefreshToken()
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  *accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(jwtConfig.Expiration.Seconds()),
	}, nil
}
