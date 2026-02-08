package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AppClaims represents the JWT claims structure with user-specific data
type AppClaims struct {
	UserId string `json:"id"`
	jwt.RegisteredClaims
}

// JwtCreate creates a JWT token with the provided secret
func JwtCreate(id string, secret string) (*string, error) {
	if id == "" {
		return nil, errors.New("id is void")
	}

	if secret == "" {
		return nil, errors.New("secret is required")
	}

	claims := AppClaims{
		UserId: id,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * 72)),
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
