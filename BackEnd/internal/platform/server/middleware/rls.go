package middleware

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
)

// RLSMiddleware pins every authenticated request to a single *sql.Tx,
// sets app.current_user_id via set_config(), and stores the *sql.Tx in
// Gin context under "db_tx" for repositories to use via txhelper.FromContext.
//
// Must be registered AFTER AuthMiddleware.
func RLSMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")
		if userID == "" {
			c.Next()
			return
		}

		// Admin users bypass row-level filters via sentinel value.
		rlsUserID := userID
		if userVal, exists := c.Get("User"); exists {
			if userModel, ok := userVal.(*dto.UserResponse); ok && userModel.Role == "ADMIN" {
				rlsUserID = "__admin__"
			}
		}

		tx, err := db.BeginTx(c.Request.Context(), nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not begin transaction"})
			c.Abort()
			return
		}

		// set_config(name, value, is_local=true) is the parameterized equivalent of
		// SET LOCAL — PostgreSQL does not support $1 placeholders in SET commands.
		if _, err := tx.ExecContext(c.Request.Context(),
			"SELECT set_config('app.current_user_id', $1, true)", rlsUserID); err != nil {
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
