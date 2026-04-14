package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/passkey"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/services/passkey"
)

// PasskeyRoutes registers the WebAuthn/passkey endpoints. All routes are
// behind the `passkeys_enabled` feature flag. The login ceremony endpoints
// live in a public sub-group (listed in auth middleware's allowlist and
// gated by RequirePublicFeature which does not require a user id).
func PasskeyRoutes(s *gin.Engine, passkeyService *passkey.PasskeyService, db *sql.DB) {
	if passkeyService == nil {
		return
	}

	authed := s.Group("/auth/passkey", middleware.RequireFeature(db, "passkeys_enabled"))
	{
		// Authenticated ceremony — the user must already be logged in to enroll a passkey.
		authed.POST("/register/begin", handler.BeginRegistration(passkeyService))
		authed.POST("/register/finish", handler.FinishRegistration(passkeyService))

		// Management endpoints (authenticated).
		authed.GET("", handler.ListPasskeys(passkeyService))
		authed.DELETE("/:id", handler.DeletePasskey(passkeyService))
	}

	public := s.Group("/auth/passkey", middleware.RequirePublicFeature(db, "passkeys_enabled"))
	{
		public.POST("/login/begin", handler.BeginLogin(passkeyService))
		public.POST("/login/finish", handler.FinishLogin(passkeyService))
	}
}
