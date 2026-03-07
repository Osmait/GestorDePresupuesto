package creditcard

import (
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	"github.com/rs/zerolog/log"
)

func CreateCreditCard(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		var req dto.CreateCreditCardRequest
		if err := ctx.BindJSON(&req); err != nil {
			log.Error().Err(err).Str("user_id", userId).Msg("Invalid JSON in create credit card request")
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}
		if err := req.Validate(); err != nil {
			log.Error().Err(err).Str("user_id", userId).Interface("request", req).Msg("Validation failed for create credit card")
			_ = ctx.Error(apperrors.NewValidationError("VALIDATION_FAILED", err.Error()))
			return
		}
		response, err := service.CreateCreditCard(ctx, &req, userId)
		if err != nil {
			log.Error().Err(err).Str("user_id", userId).Interface("request", req).Msg("Failed to create credit card")
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusCreated, response)
	}
}

func FindAllCreditCards(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		cards, err := service.FindAllCards(ctx, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, cards)
	}
}

func FindCreditCardById(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		cardId := ctx.Param("id")
		card, err := service.FindCardById(ctx, cardId, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, card)
	}
}

func UpdateCreditCard(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		cardId := ctx.Param("id")
		var req dto.UpdateCreditCardRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}
		response, err := service.UpdateCreditCard(ctx, cardId, &req, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, response)
	}
}

func DeleteCreditCard(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		cardId := ctx.Param("id")
		if err := service.DeleteCreditCard(ctx, cardId, userId); err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": "Credit card deleted successfully"})
	}
}

func UpdateCardBalance(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		balanceId := ctx.Param("balanceId")
		var req dto.UpdateBalanceRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}
		response, err := service.UpdateBalance(ctx, balanceId, &req)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, response)
	}
}

func CreateCardPayment(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		cardId := ctx.Param("id")
		var req dto.CreatePaymentRequest
		if err := ctx.BindJSON(&req); err != nil {
			log.Error().Err(err).Str("user_id", userId).Msg("Invalid JSON in create payment request")
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}
		if err := req.Validate(); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("VALIDATION_FAILED", err.Error()))
			return
		}
		response, err := service.CreatePayment(ctx, cardId, userId, &req)
		if err != nil {
			log.Error().Err(err).Str("user_id", userId).Str("card_id", cardId).Msg("Failed to create card payment")
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusCreated, response)
	}
}

func FindCardPayments(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		cardId := ctx.Param("id")
		payments, err := service.FindPaymentsByCard(ctx, cardId, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, payments)
	}
}

func GetCreditCardSummary(service *creditcard.CreditCardService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		summary, err := service.GetSummary(ctx, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, summary)
	}
}
