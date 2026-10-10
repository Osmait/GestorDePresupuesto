package utils

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testSecret = "test-secret-for-jwt-testing-at-least-32-chars"

func testJWTConfig() config.JWTConfig {
	return config.JWTConfig{
		Secret:     testSecret,
		Expiration: 15 * time.Minute,
		Issuer:     "test-issuer",
		Audience:   "test-audience",
	}
}

func TestCreateAccessToken_RoundTrip(t *testing.T) {
	cfg := testJWTConfig()
	tokenString, err := CreateAccessToken("user123", cfg)
	require.NoError(t, err)
	require.NotEmpty(t, *tokenString)

	claims, err := ParseAccessToken(*tokenString, cfg)
	require.NoError(t, err)
	assert.Equal(t, "user123", claims.UserId)
	assert.Equal(t, "user123", claims.Subject)
	assert.Equal(t, "test-issuer", claims.Issuer)
	assert.Equal(t, jwt.ClaimStrings{"test-audience"}, claims.Audience)
}

func TestCreateAccessToken_UsesConfiguredExpiration(t *testing.T) {
	tests := []struct {
		name       string
		expiration time.Duration
		want       time.Duration
	}{
		{"configured 15m", 15 * time.Minute, 15 * time.Minute},
		{"configured 1h", time.Hour, time.Hour},
		{"zero falls back to default", 0, defaultAccessTokenTTL},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := testJWTConfig()
			cfg.Expiration = tc.expiration
			tokenString, err := CreateAccessToken("u", cfg)
			require.NoError(t, err)
			claims, err := ParseAccessToken(*tokenString, cfg)
			require.NoError(t, err)
			assert.InDelta(t, time.Now().Add(tc.want).Unix(), claims.ExpiresAt.Unix(), 5)
		})
	}
}

func TestCreateAccessToken_InvalidInput(t *testing.T) {
	tests := []struct {
		name    string
		id      string
		secret  string
		wantErr string
	}{
		{"empty id", "", testSecret, "id is void"},
		{"empty secret", "user", "", "secret is required"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := testJWTConfig()
			cfg.Secret = tc.secret
			tok, err := CreateAccessToken(tc.id, cfg)
			assert.Nil(t, tok)
			require.Error(t, err)
			assert.Equal(t, tc.wantErr, err.Error())
		})
	}
}

func TestParseAccessToken_Rejections(t *testing.T) {
	good := testJWTConfig()

	sign := func(claims jwt.Claims, method jwt.SigningMethod, key interface{}) string {
		s, err := jwt.NewWithClaims(method, claims).SignedString(key)
		require.NoError(t, err)
		return s
	}
	validClaims := func() AppClaims {
		return AppClaims{
			UserId: "u1",
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    good.Issuer,
				Audience:  jwt.ClaimStrings{good.Audience},
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}
	}

	tests := []struct {
		name  string
		token func() string
	}{
		{"wrong secret", func() string {
			return sign(validClaims(), jwt.SigningMethodHS256, []byte("another-secret-another-secret-123"))
		}},
		{"wrong issuer", func() string {
			c := validClaims()
			c.Issuer = "evil"
			return sign(c, jwt.SigningMethodHS256, []byte(testSecret))
		}},
		{"wrong audience", func() string {
			c := validClaims()
			c.Audience = jwt.ClaimStrings{"other-service"}
			return sign(c, jwt.SigningMethodHS256, []byte(testSecret))
		}},
		{"missing issuer and audience (legacy token)", func() string {
			c := validClaims()
			c.Issuer = ""
			c.Audience = nil
			return sign(c, jwt.SigningMethodHS256, []byte(testSecret))
		}},
		{"expired", func() string {
			c := validClaims()
			c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute))
			return sign(c, jwt.SigningMethodHS256, []byte(testSecret))
		}},
		{"no expiration", func() string {
			c := validClaims()
			c.ExpiresAt = nil
			return sign(c, jwt.SigningMethodHS256, []byte(testSecret))
		}},
		{"HS512 not allowed", func() string {
			return sign(validClaims(), jwt.SigningMethodHS512, []byte(testSecret))
		}},
		{"none algorithm", func() string {
			return sign(validClaims(), jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType)
		}},
		{"empty user id", func() string {
			c := validClaims()
			c.UserId = ""
			return sign(c, jwt.SigningMethodHS256, []byte(testSecret))
		}},
		{"garbage", func() string { return "not.a.jwt" }},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			claims, err := ParseAccessToken(tc.token(), good)
			assert.Error(t, err)
			assert.Nil(t, claims)
		})
	}
}

func TestCreateTokenPair(t *testing.T) {
	cfg := testJWTConfig()
	pair, err := CreateTokenPair("user-1", cfg)
	require.NoError(t, err)
	assert.NotEmpty(t, pair.AccessToken)
	assert.Len(t, pair.RefreshToken, 43) // 32 bytes base64url without padding
	assert.Equal(t, int64(cfg.Expiration.Seconds()), pair.ExpiresIn)

	other, err := CreateTokenPair("user-1", cfg)
	require.NoError(t, err)
	assert.NotEqual(t, pair.RefreshToken, other.RefreshToken)
}
