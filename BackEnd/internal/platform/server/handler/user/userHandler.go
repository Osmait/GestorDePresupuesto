package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
)

func GetUser(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		user, err := userService.FindUserById(c, id)
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
		user, err := userService.FindUserById(c, userid)
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

		err = userService.CreateUser(c, &user)
		if err != nil {
			_ = c.Error(err)
			return
		}

		c.Status(http.StatusOK)
	}
}
