package mcp

import (
	"context"
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

// UserResolver looks up a user ID by email. Used to map OAuth subject (email)
// to the internal user ID needed by RLS and services.
type UserResolver func(ctx context.Context, email string) (string, error)

// MCPAuthMiddleware validates MCP requests using OAuth tokens first, then
// falling back to API key authentication. This allows both Claude Web
// (OAuth) and Claude Desktop (API key) clients to connect.
//
// resourceURL is the base URL of the MCP resource (used in WWW-Authenticate header).
// tokenVerifier may be nil; when nil, only API key auth is attempted.
// userResolver maps the OAuth subject (email) to the internal user ID.
func MCPAuthMiddleware(apiKeySvc *apikey.APIKeyService, tokenVerifier func(string) (*oauth2.TokenInfo, error), resourceURL string, userResolver UserResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractBearerToken(c)
		if token == "" {
			c.Header("WWW-Authenticate", `Bearer resource_metadata="`+resourceURL+`/.well-known/oauth-protected-resource"`)
			c.AbortWithStatusJSON(401, gin.H{"error": "missing authentication"})
			return
		}

		// Try OAuth token first so Claude Web users are authenticated via
		// the OAuth 2.1 flow without needing an API key.
		if tokenVerifier != nil {
			if tokenInfo, err := tokenVerifier(token); err == nil {
				// tokenInfo.Subject is the email; resolve to internal user ID
				userID := tokenInfo.Subject
				if userResolver != nil {
					if resolved, resolveErr := userResolver(c.Request.Context(), tokenInfo.Subject); resolveErr == nil {
						userID = resolved
					}
				}
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
			c.Header("WWW-Authenticate", `Bearer resource_metadata="`+resourceURL+`/.well-known/oauth-protected-resource"`)
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid authentication"})
			return
		}
		c.Set("X-User-Id", key.UserID)
		ctx := mcpcontext.WithUserID(c.Request.Context(), key.UserID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
