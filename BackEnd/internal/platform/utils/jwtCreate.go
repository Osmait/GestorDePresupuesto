package utils

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/osmait/gestorDePresupuesto/internal/config"
)

// defaultAccessTokenTTL is used only when the JWT config carries no expiration
// (e.g. hand-built configs in tests). LoadConfig always sets one.
const defaultAccessTokenTTL = 24 * time.Hour

// AppClaims represents the JWT claims structure with user-specific data.
// It is the single claims type used both to issue and to validate tokens.
type AppClaims struct {
	UserId string `json:"id"`
	jwt.RegisteredClaims
}

// CreateAccessToken creates a signed HS256 access token for the given user
// using the configured secret, expiration, issuer and audience.
func CreateAccessToken(id string, jwtConfig config.JWTConfig) (*string, error) {
	if id == "" {
		return nil, errors.New("id is void")
	}

	if jwtConfig.Secret == "" {
		return nil, errors.New("secret is required")
	}

	expiration := jwtConfig.Expiration
	if expiration <= 0 {
		expiration = defaultAccessTokenTTL
	}

	now := time.Now()
	registered := jwt.RegisteredClaims{
		Subject:   id,
		Issuer:    jwtConfig.Issuer,
		ExpiresAt: jwt.NewNumericDate(now.Add(expiration)),
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
	}
	if jwtConfig.Audience != "" {
		registered.Audience = jwt.ClaimStrings{jwtConfig.Audience}
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, AppClaims{UserId: id, RegisteredClaims: registered})

	tokenString, err := token.SignedString([]byte(jwtConfig.Secret))
	if err != nil {
		return nil, err
	}

	return &tokenString, nil
}

// ParseAccessToken validates signature, algorithm, expiration, issuer and
// audience of an access token and returns its claims.
func ParseAccessToken(tokenString string, jwtConfig config.JWTConfig) (*AppClaims, error) {
	if jwtConfig.Secret == "" {
		return nil, errors.New("secret is required")
	}

	opts := []jwt.ParserOption{
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
	}
	if jwtConfig.Issuer != "" {
		opts = append(opts, jwt.WithIssuer(jwtConfig.Issuer))
	}
	if jwtConfig.Audience != "" {
		opts = append(opts, jwt.WithAudience(jwtConfig.Audience))
	}

	token, err := jwt.ParseWithClaims(tokenString, &AppClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(jwtConfig.Secret), nil
	}, opts...)
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*AppClaims)
	if !ok || !token.Valid || claims.UserId == "" {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
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

// AccessTokenTTL returns the effective access-token lifetime for a config.
func AccessTokenTTL(jwtConfig config.JWTConfig) time.Duration {
	if jwtConfig.Expiration <= 0 {
		return defaultAccessTokenTTL
	}
	return jwtConfig.Expiration
}

// CreateTokenPair creates both access and refresh tokens
func CreateTokenPair(userId string, jwtConfig config.JWTConfig) (*TokenPair, error) {
	// Create access token
	accessToken, err := CreateAccessToken(userId, jwtConfig)
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
		ExpiresIn:    int64(AccessTokenTTL(jwtConfig).Seconds()),
	}, nil
}
