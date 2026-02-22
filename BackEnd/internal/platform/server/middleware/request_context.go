package middleware

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
)

func RequestContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
		if requestID == "" {
			requestID = generateRequestID()
		}

		c.Header("X-Request-ID", requestID)
		c.Set("X-Request-ID", requestID)

		ctx := context.WithValue(c.Request.Context(), apperrors.ContextKeyRequestID, requestID)
		if userID := strings.TrimSpace(c.GetString("X-User-Id")); userID != "" {
			ctx = context.WithValue(ctx, apperrors.ContextKeyUserID, userID)
		}

		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func AttachUserContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := strings.TrimSpace(c.GetString("X-User-Id"))
		if userID != "" {
			ctx := context.WithValue(c.Request.Context(), apperrors.ContextKeyUserID, userID)
			c.Request = c.Request.WithContext(ctx)
		}
		c.Next()
	}
}
