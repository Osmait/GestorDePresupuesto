package user

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
)

// GetUser returns a user profile. Requires authentication (enforced by
// AuthMiddleware) and is restricted to the user themself or an ADMIN.
func GetUser(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		requesterID := c.GetString("X-User-Id")
		if requesterID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		if id != requesterID {
			requester, ok := c.Get("User")
			model, isUser := requester.(*dto.UserResponse)
			if !ok || !isUser || model.Role != "ADMIN" {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
				return
			}
		}
		user, err := userService.FindUserById(c.Request.Context(), id)
		if err != nil {
			_ = c.Error(err)
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

func GetProfile(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userid := c.GetString("X-User-Id")
		user, err := userService.FindUserById(c.Request.Context(), userid)
		if err != nil {
			_ = c.Error(err)
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

func CreateUser(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user dto.UserRequest
		err := c.BindJSON(&user)
		if err != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_JSON", err.Error()))
			return
		}

		err = userService.CreateUser(c.Request.Context(), &user)
		if err != nil {
			_ = c.Error(err)
			return
		}

		c.Status(http.StatusOK)
	}
}

func CleanupDemoUsers(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Pass 0 to delete all demo users immediately (regardless of age)
		err := userService.DeleteDemoUsers(c.Request.Context(), 0)
		if err != nil {
			_ = c.Error(err)
			return
		}
		c.Status(http.StatusOK)
	}
}

func GetUsers(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		limit := 20
		offset := 0
		if value := c.Query("limit"); value != "" {
			if parsed, parseErr := strconv.Atoi(value); parseErr == nil {
				limit = parsed
			}
		}
		if value := c.Query("offset"); value != "" {
			if parsed, parseErr := strconv.Atoi(value); parseErr == nil {
				offset = parsed
			}
		}

		users, err := userService.GetUsersFiltered(c.Request.Context(), query, limit, offset)
		if err != nil {
			_ = c.Error(err)
			return
		}
		c.JSON(http.StatusOK, users)
	}
}

func UpdateUsers(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []dto.UserResponse
		if err := c.BindJSON(&users); err != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_JSON", err.Error()))
			return
		}

		if err := userService.BatchUpdateUsers(c.Request.Context(), users); err != nil {
			_ = c.Error(err)
			return
		}

		c.Status(http.StatusOK)
	}
}

// SoftDeleteUser marks a user as deleted. Admins cannot delete their own account.
func SoftDeleteUser(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		requesterID := c.GetString("X-User-Id")
		if id == requesterID {
			_ = c.Error(apperrors.NewValidationError("SELF_DELETE", "cannot delete your own account"))
			return
		}

		if err := userService.SoftDeleteUser(c.Request.Context(), id); err != nil {
			_ = c.Error(err)
			return
		}

		c.Status(http.StatusOK)
	}
}

// CreateUserByAdmin allows administrators to create new users with custom roles.
// This endpoint is protected and requires ADMIN role.
func CreateUserByAdmin(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userReq dto.UserRequest
		if err := c.BindJSON(&userReq); err != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_JSON", err.Error()))
			return
		}

		// Validate role if provided
		if userReq.Role != "" && userReq.Role != "USER" && userReq.Role != "ADMIN" {
			_ = c.Error(apperrors.NewValidationError("INVALID_ROLE", "role must be USER or ADMIN"))
			return
		}

		if err := userService.CreateUserWithRole(c.Request.Context(), &userReq, userReq.Role); err != nil {
			_ = c.Error(err)
			return
		}

		c.Status(http.StatusCreated)
	}
}
