package mcp

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp/mcpcontext"
	"github.com/osmait/gestorDePresupuesto/internal/services/apikey"
	"github.com/plexusone/mcpkit/oauth2"
)

// extractBearerToken returns the token value from the Authorization header,
// or an empty string if the header is absent or not a Bearer token.
func extractBearerToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == "" || token == authHeader {
		return ""
	}
	return token
}

// APIKeyAuthMiddleware validates Bearer API keys for MCP endpoints.
// On success it writes the resolved user ID into both the Gin context
// and the request context so mcp-go tool handlers can access it.
func APIKeyAuthMiddleware(apiKeySvc *apikey.APIKeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractBearerToken(c)
		if token == "" {
			c.AbortWithStatusJSON(401, gin.H{"error": "missing API key"})
			return
		}

		key, err := apiKeySvc.ValidateKey(c.Request.Context(), token)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid API key"})
			return
		}

		c.Set("X-User-Id", key.UserID)
		// Inject userID into the request context so mcp-go tool handlers
		// can retrieve it via mcpcontext.UserIDFromContext(ctx).
		ctx := mcpcontext.WithUserID(c.Request.Context(), key.UserID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

// MCPAuthMiddleware validates MCP requests using OAuth tokens first, then
// falling back to API key authentication. This allows both Claude Web
// (OAuth) and Claude Desktop (API key) clients to connect.
//
// tokenVerifier may be nil; when nil, only API key auth is attempted.
func MCPAuthMiddleware(apiKeySvc *apikey.APIKeyService, tokenVerifier func(string) (*oauth2.TokenInfo, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractBearerToken(c)
		if token == "" {
			c.AbortWithStatusJSON(401, gin.H{"error": "missing authentication"})
			return
		}

		// Try OAuth token first so Claude Web users are authenticated via
		// the OAuth 2.1 flow without needing an API key.
		if tokenVerifier != nil {
			if tokenInfo, err := tokenVerifier(token); err == nil {
				userID := tokenInfo.Subject
				c.Set("X-User-Id", userID)
				ctx := mcpcontext.WithUserID(c.Request.Context(), userID)
				c.Request = c.Request.WithContext(ctx)
				c.Next()
				return
			}
		}

		// Fall back to API key (used by Claude Desktop and direct integrations).
		key, err := apiKeySvc.ValidateKey(c.Request.Context(), token)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid authentication"})
			return
		}
		c.Set("X-User-Id", key.UserID)
		ctx := mcpcontext.WithUserID(c.Request.Context(), key.UserID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
