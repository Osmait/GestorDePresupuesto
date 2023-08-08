package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func HealthRoutes(s *gin.Engine) {
	s.GET("/", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, "HelloWord")
	})
}
