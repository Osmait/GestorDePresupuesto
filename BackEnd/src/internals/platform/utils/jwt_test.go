package utils

import (
	"testing"

	"github.com/golang-jwt/jwt"
	"github.com/stretchr/testify/assert"
)

func TestJwtCreate(t *testing.T) {
	id := "user123"
	tokenString, err := JwtCreate(id)

	assert.NoError(t, err, "Expected no errors")

	assert.NotEmpty(t, tokenString, "Expected the token not to be empty")

	token, err := jwt.ParseWithClaims(*tokenString, &AppClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte("secreto"), nil
	})

	assert.NoError(t, err, "Error decoding the token")

	assert.True(t, token.Valid, "The token is not valid")

	claims, ok := token.Claims.(*AppClaims)
	assert.True(t, ok, "Error getting claims from the token")
	assert.Equal(t, id, claims.UserId, "UserId in the token does not match the expected value")
}
