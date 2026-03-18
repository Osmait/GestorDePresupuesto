package middleware

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
)

// RLSMiddleware pins every authenticated request to a single *sql.Tx,
// sets two transaction-scoped PostgreSQL settings via set_config(), and
// stores the *sql.Tx in Gin context under "db_tx" for repositories to
// use via txhelper.FromContext.
//
// Settings applied per request:
//   - app.current_user_id  — the authenticated user's ID
//   - app.is_admin         — "true" for ADMIN role, "false" otherwise
//
// RLS policies check current_setting('app.is_admin', true) = 'true' for
// admin bypass instead of the fragile '__admin__' sentinel pattern.
//
// Must be registered AFTER AuthMiddleware.
// Must NOT wrap long-lived SSE endpoints (register those before this middleware).
func RLSMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")
		if userID == "" {
			c.Next()
			return
		}

		isAdmin := "false"
		if userVal, exists := c.Get("User"); exists {
			if userModel, ok := userVal.(*dto.UserResponse); ok && userModel.Role == "ADMIN" {
				isAdmin = "true"
			}
		}

		tx, err := db.BeginTx(c.Request.Context(), nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not begin transaction"})
			c.Abort()
			return
		}

		// set_config(name, value, is_local=true) is the parameterized equivalent of
		// SET LOCAL. PostgreSQL does not support $1 placeholders in SET commands.
		// is_local=true makes both settings transaction-scoped so they are
		// automatically cleared when the connection returns to the pool.
		_, err = tx.ExecContext(c.Request.Context(),
			"SELECT set_config('app.current_user_id', $1, true),"+
				"       set_config('app.is_admin', $2, true)",
			userID, isAdmin)
		if err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not set rls context"})
			c.Abort()
			return
		}

		c.Set("db_tx", tx)
		c.Next()

		if len(c.Errors) > 0 {
			_ = tx.Rollback()
		} else {
			_ = tx.Commit()
		}
	}
}
