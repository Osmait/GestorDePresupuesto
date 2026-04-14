package passkey

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/passkey"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	svc "github.com/osmait/gestorDePresupuesto/internal/services/passkey"
	"github.com/rs/zerolog/log"
)

// BeginRegistration starts the WebAuthn registration ceremony for the
// authenticated user and returns the publicKey creation options.
func BeginRegistration(service *svc.PasskeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		if userId == "" {
			_ = ctx.Error(apperrors.NewUnauthorizedError("missing user"))
			return
		}
		result, err := service.BeginRegistration(ctx, userId)
		if err != nil {
			log.Error().Err(err).Str("user_id", userId).Msg("passkey begin registration failed")
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}

// FinishRegistration verifies the attestation response sent by the browser
// and persists the new passkey.
func FinishRegistration(service *svc.PasskeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		if userId == "" {
			_ = ctx.Error(apperrors.NewUnauthorizedError("missing user"))
			return
		}
		var req dto.FinishRegistrationRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}

		attestationReq, err := buildInnerRequest(req.AttestationResponse)
		if err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_ATTESTATION", err.Error()))
			return
		}

		pk, err := service.FinishRegistration(ctx, userId, req.SessionId, req.Name, attestationReq)
		if err != nil {
			log.Error().Err(err).Str("user_id", userId).Msg("passkey finish registration failed")
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusCreated, dto.NewPasskeyResponse(pk))
	}
}

// BeginLogin starts a discoverable (usernameless) WebAuthn login ceremony.
func BeginLogin(service *svc.PasskeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		result, err := service.BeginLogin(ctx)
		if err != nil {
			log.Error().Err(err).Msg("passkey begin login failed")
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}

// FinishLogin verifies the assertion response and returns fresh access +
// refresh tokens for the matched user.
func FinishLogin(service *svc.PasskeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req dto.FinishLoginRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}

		assertionReq, err := buildInnerRequest(req.AssertionResponse)
		if err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_ASSERTION", err.Error()))
			return
		}

		userAgent := ctx.Request.UserAgent()
		ipAddress := ctx.ClientIP()

		tokens, _, err := service.FinishLogin(ctx, req.SessionId, assertionReq, userAgent, ipAddress)
		if err != nil {
			log.Error().Err(err).Msg("passkey finish login failed")
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, dto.LoginResponse{
			AccessToken:  tokens.AccessToken,
			RefreshToken: tokens.RefreshToken,
			TokenType:    tokens.TokenType,
			ExpiresIn:    tokens.ExpiresIn,
		})
	}
}

// ListPasskeys returns the passkeys registered by the authenticated user.
func ListPasskeys(service *svc.PasskeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		if userId == "" {
			_ = ctx.Error(apperrors.NewUnauthorizedError("missing user"))
			return
		}
		passkeys, err := service.ListForUser(ctx, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		resp := make([]*dto.PasskeyResponse, 0, len(passkeys))
		for _, pk := range passkeys {
			resp = append(resp, dto.NewPasskeyResponse(pk))
		}
		ctx.JSON(http.StatusOK, resp)
	}
}

// DeletePasskey removes a passkey owned by the authenticated user.
func DeletePasskey(service *svc.PasskeyService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		if userId == "" {
			_ = ctx.Error(apperrors.NewUnauthorizedError("missing user"))
			return
		}
		id := ctx.Param("id")
		if err := service.DeleteForUser(ctx, id, userId); err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"status": "deleted"})
	}
}

// buildInnerRequest wraps an arbitrary JSON payload in an *http.Request so we
// can hand it to go-webauthn's FinishRegistration / FinishDiscoverableLogin,
// which both expect a *http.Request with a JSON body.
func buildInnerRequest(payload any) (*http.Request, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, "/", io.NopCloser(bytes.NewReader(raw)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}
