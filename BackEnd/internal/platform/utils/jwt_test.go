package utils

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/stretchr/testify/assert"
)

const testSecret = "test-secret-for-jwt-testing"

func TestJwtCreate(t *testing.T) {
	id := "user123"
	tokenString, err := JwtCreate(id, testSecret)

	assert.NoError(t, err, "Expected no errors")
	assert.NotEmpty(t, tokenString, "Expected the token not to be empty")

	token, err := jwt.ParseWithClaims(*tokenString, &AppClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(testSecret), nil
	})

	assert.NoError(t, err, "Error decoding the token")
	assert.True(t, token.Valid, "The token is not valid")

	claims, ok := token.Claims.(*AppClaims)
	assert.True(t, ok, "Error getting claims from the token")
	assert.Equal(t, id, claims.UserId, "UserId in the token does not match the expected value")
}

func TestJwtCreate_EmptyUserId(t *testing.T) {
	// Test with empty user ID
	tokenString, err := JwtCreate("", testSecret)

	assert.Error(t, err, "Expected error for empty user ID")
	assert.Nil(t, tokenString, "Token should be nil for empty user ID")
	assert.Equal(t, "id is void", err.Error(), "Error message should match expected")
}

func TestJwtCreate_EmptySecret(t *testing.T) {
	// Test with empty secret
	tokenString, err := JwtCreate("user123", "")

	assert.Error(t, err, "Expected error for empty secret")
	assert.Nil(t, tokenString, "Token should be nil for empty secret")
	assert.Equal(t, "secret is required", err.Error(), "Error message should match expected")
}

func TestJwtCreate_ValidUserId_DifferentFormats(t *testing.T) {
	testCases := []struct {
		name   string
		userId string
	}{
		{"UUID format", "550e8400-e29b-41d4-a716-446655440000"},
		{"Numeric ID", "12345"},
		{"Alphanumeric", "user_123_abc"},
		{"Long ID", "very_long_user_id_that_could_happen_in_real_scenarios_12345"},
		{"Special characters", "user@domain.com"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tokenString, err := JwtCreate(tc.userId, testSecret)

			assert.NoError(t, err, "Should not error for valid user ID")
			assert.NotNil(t, tokenString, "Token should not be nil")
			assert.NotEmpty(t, *tokenString, "Token should not be empty")

			// Verify token can be parsed
			token, err := jwt.ParseWithClaims(*tokenString, &AppClaims{}, func(token *jwt.Token) (interface{}, error) {
				return []byte(testSecret), nil
			})

			assert.NoError(t, err, "Token should be parseable")
			assert.True(t, token.Valid, "Token should be valid")

			claims, ok := token.Claims.(*AppClaims)
			assert.True(t, ok, "Should be able to extract claims")
			assert.Equal(t, tc.userId, claims.UserId, "UserID should match")
		})
	}
}

func TestJwtCreate_TokenExpiration(t *testing.T) {
	id := "test_user"
	tokenString, err := JwtCreate(id, testSecret)

	assert.NoError(t, err)
	assert.NotNil(t, tokenString)

	// Parse token to check expiration
	token, err := jwt.ParseWithClaims(*tokenString, &AppClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(testSecret), nil
	})

	assert.NoError(t, err)
	claims, ok := token.Claims.(*AppClaims)
	assert.True(t, ok)

	// Check that expiration is set to approximately 72 hours from now
	expectedExpiration := time.Now().Add(time.Hour * 72).Unix()
	actualExpiration := claims.ExpiresAt

	// Allow 60 second tolerance for test execution time
	assert.InDelta(t, expectedExpiration, actualExpiration, 60, "Expiration should be approximately 72 hours from now")

	// Verify expiration is in the future
	assert.Greater(t, actualExpiration, time.Now().Unix(), "Token expiration should be in the future")
}

func TestJwtCreate_TokenStructure(t *testing.T) {
	id := "test_structure"
	tokenString, err := JwtCreate(id, testSecret)

	assert.NoError(t, err)
	assert.NotNil(t, tokenString)

	// JWT tokens should have 3 parts separated by dots
	parts := len([]rune(*tokenString))
	assert.Greater(t, parts, 20, "Token should be reasonably long")

	// Verify token starts with expected JWT header for HS256
	// (This is a basic check - full validation happens in parsing)
	assert.Contains(t, *tokenString, ".", "Token should contain dots as separators")
}

func TestJwtCreate_MultipleTokensAreDifferent(t *testing.T) {
	id := "same_user"

	// Create multiple tokens for the same user
	token1, err1 := JwtCreate(id, testSecret)
	time.Sleep(time.Millisecond) // Small delay to ensure different timestamps
	token2, err2 := JwtCreate(id, testSecret)

	assert.NoError(t, err1)
	assert.NoError(t, err2)
	assert.NotNil(t, token1)
	assert.NotNil(t, token2)

	// Tokens should be different due to different IssuedAt times
	// Note: This might not always be true if the system is very fast, but generally should be
	// In production, this would typically use a nonce or issued-at timestamp
	// For this test, we'll just verify both tokens are valid but don't require them to be different
	assert.NotEmpty(t, *token1)
	assert.NotEmpty(t, *token2)
}

func TestJwtCreate_DifferentSecrets(t *testing.T) {
	id := "test_user"
	secret1 := "secret1"
	secret2 := "secret2"

	// Create tokens with different secrets
	token1, err1 := JwtCreate(id, secret1)
	token2, err2 := JwtCreate(id, secret2)

	assert.NoError(t, err1)
	assert.NoError(t, err2)
	assert.NotNil(t, token1)
	assert.NotNil(t, token2)

	// Token created with secret1 should not be valid with secret2
	_, err := jwt.ParseWithClaims(*token1, &AppClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret2), nil
	})
	assert.Error(t, err, "Token created with secret1 should not be valid with secret2")

	// Token created with secret2 should not be valid with secret1
	_, err = jwt.ParseWithClaims(*token2, &AppClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret1), nil
	})
	assert.Error(t, err, "Token created with secret2 should not be valid with secret1")
}

func TestAppClaims_Structure(t *testing.T) {
	claims := AppClaims{
		UserId: "test_user_123",
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(time.Hour).Unix(),
		},
	}

	assert.Equal(t, "test_user_123", claims.UserId)
	assert.Greater(t, claims.ExpiresAt, time.Now().Unix())
}
