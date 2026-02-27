package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
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
//	@Param			credentials	body		authDomain.AuthRequest	true	"Login credentials"
//	@Success		200			{object}	map[string]string		"JWT token response"
//	@Failure		400			{object}	map[string]string		"Bad request - Invalid input"
//	@Failure		500			{object}	map[string]string		"Internal server error - Problem with credentials"
//	@Router			/login [post]
func Login(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var authRequest authDomain.AuthRequest
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

// LoginWithTokens godoc
//
//	@Summary		User login with refresh token
//	@Description	Authenticate user and get both access and refresh tokens
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			credentials	body		authDomain.AuthRequest	true	"Login credentials"
//	@Success		200			{object}	authDomain.AuthResponse	"Token pair response"
//	@Failure		400			{object}	map[string]string		"Bad request - Invalid input"
//	@Failure		401			{object}	map[string]string		"Unauthorized - Invalid credentials"
//	@Failure		500			{object}	map[string]string		"Internal server error"
//	@Router			/auth/login [post]
func LoginWithTokens(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var authRequest authDomain.AuthRequest
		if err := ctx.ShouldBindJSON(&authRequest); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		userAgent := ctx.GetHeader("User-Agent")
		ipAddress := ctx.ClientIP()

		response, err := authService.LoginWithTokens(ctx, &authRequest, userAgent, ipAddress)
		if err != nil {
			switch {
			case errors.Is(err, errorhttp.ErrBadRequest):
				ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
				return
			}
			log.Error().Err(err).Msg("login failed")
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "authentication failed"})
			return
		}

		ctx.JSON(http.StatusOK, response)
	}
}

// RefreshTokens godoc
//
//	@Summary		Refresh access token
//	@Description	Exchange a valid refresh token for new access and refresh tokens
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			request	body		authDomain.RefreshRequest	true	"Refresh token request"
//	@Success		200		{object}	authDomain.AuthResponse		"New token pair"
//	@Failure		400		{object}	map[string]string			"Bad request - Invalid input"
//	@Failure		401		{object}	map[string]string			"Unauthorized - Invalid or expired token"
//	@Failure		500		{object}	map[string]string			"Internal server error"
//	@Router			/auth/refresh [post]
func RefreshTokens(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request authDomain.RefreshRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "refresh_token is required"})
			return
		}

		userAgent := ctx.GetHeader("User-Agent")
		ipAddress := ctx.ClientIP()

		response, err := authService.RefreshTokens(ctx, request.RefreshToken, userAgent, ipAddress)
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrInvalidRefreshToken):
				ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
				return
			case errors.Is(err, auth.ErrRefreshTokenExpired):
				ctx.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token expired"})
				return
			case errors.Is(err, auth.ErrTokenReuse):
				ctx.JSON(http.StatusUnauthorized, gin.H{"error": "token reuse detected - please login again"})
				return
			}
			log.Error().Err(err).Msg("token refresh failed")
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "token refresh failed"})
			return
		}

		ctx.JSON(http.StatusOK, response)
	}
}

// Logout godoc
//
//	@Summary		Logout user
//	@Description	Revoke the provided refresh token
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Param			request	body		authDomain.RefreshRequest	true	"Refresh token to revoke"
//	@Success		200		{object}	map[string]string			"Logout successful"
//	@Failure		400		{object}	map[string]string			"Bad request - Invalid input"
//	@Failure		500		{object}	map[string]string			"Internal server error"
//	@Router			/auth/logout [post]
func Logout(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request authDomain.RefreshRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "refresh_token is required"})
			return
		}

		if err := authService.Logout(ctx, request.RefreshToken); err != nil {
			log.Error().Err(err).Msg("logout failed")
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "logout failed"})
			return
		}

		ctx.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
	}
}

// LogoutAll godoc
//
//	@Summary		Logout from all devices
//	@Description	Revoke all refresh tokens for the current user
//	@Tags			Authentication
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	map[string]string	"Logout successful"
//	@Failure		401	{object}	map[string]string	"Unauthorized"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/auth/logout-all [post]
func LogoutAll(authService *auth.AuthService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId, exists := ctx.Get("X-User-Id")
		if !exists {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		if err := authService.LogoutAll(ctx, userId.(string)); err != nil {
			log.Error().Err(err).Msg("logout all failed")
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "logout failed"})
			return
		}

		ctx.JSON(http.StatusOK, gin.H{"message": "logged out from all devices"})
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
		ip := ctx.ClientIP()
		token, err := authService.CreateDemoUser(ctx, ip)
		if err != nil {
			log.Error().Err(err).Msg("demo user creation failed")
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, token)
	}
}
