package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
	useTye "github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
	errorHandler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/user"
)

func GetUser(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		user, err := userService.FindUserById(c, id)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"erro": "Find User"})
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
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"erro": "Find User"})
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

func CreateUser(userService *user.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user useTye.User
		err := c.BindJSON(&user)
		if err != nil {
			c.JSON(http.StatusBadRequest, err)
			return
		}

		err = userService.CreateUser(c, &user)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}

		c.Status(http.StatusOK)
	}
}
