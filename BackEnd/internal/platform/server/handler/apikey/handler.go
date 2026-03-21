package apikey

import (
	"net/http"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	apikeyService "github.com/osmait/gestorDePresupuesto/internal/services/apikey"
)

type createAPIKeyRequest struct {
	Name string `json:"name" binding:"required"`
}

// CreateAPIKey godoc
//
//	@Summary		Create a new API key
//	@Description	Generate a new API key for the authenticated user. The plaintext token is returned only once.
//	@Tags			API Keys
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			request	body		createAPIKeyRequest	true	"API key creation data"
//	@Success		201		{object}	apikey.APIKeyWithToken
//	@Failure		400		{object}	map[string]string	"Bad request - Invalid input"
//	@Failure		401		{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		500		{object}	map[string]string	"Internal server error"
//	@Router			/api-keys [post]
func CreateAPIKey(service *apikeyService.APIKeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userID := ctx.GetString("X-User-Id")

		var req createAPIKeyRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Error fields required"))
			return
		}

		keyWithToken, err := service.GenerateKey(ctx, userID, req.Name)
		if err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusCreated, keyWithToken)
	}
}

// ListAPIKeys godoc
//
//	@Summary		List API keys
//	@Description	Retrieve all API keys for the authenticated user
//	@Tags			API Keys
//	@Produce		json
//	@Security		JWT
//	@Success		200	{array}		apikey.APIKey
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/api-keys [get]
func ListAPIKeys(service *apikeyService.APIKeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userID := ctx.GetString("X-User-Id")

		keys, err := service.ListKeys(ctx, userID)
		if err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusOK, keys)
	}
}

// RevokeAPIKey godoc
//
//	@Summary		Revoke an API key
//	@Description	Permanently delete an API key by ID
//	@Tags			API Keys
//	@Produce		json
//	@Security		JWT
//	@Param			id	path	string	true	"API Key ID"
//	@Success		204	"API key revoked"
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		404	{object}	map[string]string	"API key not found"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/api-keys/{id} [delete]
func RevokeAPIKey(service *apikeyService.APIKeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")
		userID := ctx.GetString("X-User-Id")

		if err := service.RevokeKey(ctx, id, userID); err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.Status(http.StatusNoContent)
	}
}
