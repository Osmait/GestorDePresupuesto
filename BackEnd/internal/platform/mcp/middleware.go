package mcp

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/services/apikey"
)

// APIKeyAuthMiddleware validates Bearer API keys for MCP endpoints.
// On success it writes the resolved user ID into the Gin context under "X-User-Id".
func APIKeyAuthMiddleware(apiKeySvc *apikey.APIKeyService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == "" || token == authHeader {
			c.AbortWithStatusJSON(401, gin.H{"error": "missing API key"})
			return
		}

		key, err := apiKeySvc.ValidateKey(c.Request.Context(), token)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "invalid API key"})
			return
		}

		c.Set("X-User-Id", key.UserID)
		c.Next()
	}
}
