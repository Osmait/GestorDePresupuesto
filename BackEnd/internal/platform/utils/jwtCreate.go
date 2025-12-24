package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt"
)

type AppClaims struct {
	UserId string `json:"id"`
	jwt.StandardClaims
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
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(time.Hour * 72).Unix(),
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
