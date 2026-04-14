package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/passkey"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/services/passkey"
)

// PasskeyRoutes registers the WebAuthn/passkey endpoints. All routes are
// behind the `passkeys_enabled` feature flag; the login ceremony endpoints
// are also listed in the auth middleware's public route set.
func PasskeyRoutes(s *gin.Engine, passkeyService *passkey.PasskeyService, db *sql.DB) {
	if passkeyService == nil {
		return
	}
	group := s.Group("/auth/passkey", middleware.RequireFeature(db, "passkeys_enabled"))
	{
		// Authenticated ceremony — the user must already be logged in to enroll a passkey.
		group.POST("/register/begin", handler.BeginRegistration(passkeyService))
		group.POST("/register/finish", handler.FinishRegistration(passkeyService))

		// Management endpoints (authenticated).
		group.GET("", handler.ListPasskeys(passkeyService))
		group.DELETE("/:id", handler.DeletePasskey(passkeyService))

		// Login ceremony — listed as public in auth middleware's allowlist.
		group.POST("/login/begin", handler.BeginLogin(passkeyService))
		group.POST("/login/finish", handler.FinishLogin(passkeyService))
	}
}
