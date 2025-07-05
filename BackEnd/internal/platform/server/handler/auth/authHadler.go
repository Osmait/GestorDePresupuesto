package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	authRequest "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

func Login(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var authRequest authRequest.AuthRequest
		err := ctx.Bind(&authRequest)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, err)
			return
		}
		token, err := authService.Login(ctx, &authRequest)
		if err != nil {
			switch {
			case errors.Is(err, errorhttp.ErrBadRequest):
				ctx.JSON(http.StatusBadRequest, err)
				return
			}
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "problem with password or email "})
			return
		}
		ctx.JSON(http.StatusOK, token)
	}
}
