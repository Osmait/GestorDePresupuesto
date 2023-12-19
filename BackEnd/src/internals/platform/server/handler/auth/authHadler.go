package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	authRequest "github.com/osmait/gestorDePresupuesto/src/internals/domain/auth"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/auth"
)

func Login(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var authRequest authRequest.AuthRequest
		err := ctx.Bind(&authRequest)
		if err != nil {
			ctx.AbortWithStatusJSON(http.StatusBadRequest, err)
			return
		}
		token, err := authService.Login(ctx, &authRequest)
		if err != nil {
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "problem with password or email "})
			return
		}
		ctx.JSON(http.StatusOK, token)
	}
}
