package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	authRequest "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/rs/zerolog/log"
)

// Login godoc
//
//	@Summary		User login
//	@Description	Authenticate user with email and password to get JWT token
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			credentials	body		authRequest.AuthRequest	true	"Login credentials"
//	@Success		200			{object}	map[string]string		"JWT token response"
//	@Failure		400			{object}	map[string]string		"Bad request - Invalid input"
//	@Failure		500			{object}	map[string]string		"Internal server error - Problem with credentials"
//	@Router			/login [post]
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

// DemoLogin godoc
//
//	@Summary		Create and login demo user
//	@Description	Create a temporary demo user with seeded data and return JWT
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Success		200			{object}	map[string]string		"JWT token response"
//	@Failure		500			{object}	map[string]string		"Internal server error"
//	@Router			/auth/demo [post]
func DemoLogin(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		token, err := authService.CreateDemoUser(ctx)
		if err != nil {
			log.Error().Err(err).Msg("demo user creation failed")
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, token)
	}
}
