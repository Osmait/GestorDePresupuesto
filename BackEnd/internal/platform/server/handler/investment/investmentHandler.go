package investment

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

type InvestmentHandler struct {
	service *investmentService.InvestmentService
}

func NewInvestmentHandler(service *investmentService.InvestmentService) *InvestmentHandler {
	return &InvestmentHandler{service: service}
}

func (h *InvestmentHandler) Create(ctx *gin.Context) {
	var req struct {
		ID                 string                    `json:"id"`
		Type               investment.InvestmentType `json:"type" binding:"required"`
		Name               string                    `json:"name" binding:"required"`
		Symbol             string                    `json:"symbol" binding:"required"`
		Quantity           float64                   `json:"quantity" binding:"required"`
		PurchasePrice      float64                   `json:"purchase_price" binding:"required,gt=0"`
		CurrentPrice       float64                   `json:"current_price" binding:"required,gt=0"`
		SettlementCurrency string                    `json:"settlement_currency"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		_ = ctx.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid investment payload: "+err.Error()).WithContext(ctx.Request.Context()).WithOperation("InvestmentHandler.Create"))
		return
	}

	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized").WithContext(ctx.Request.Context()).WithOperation("InvestmentHandler.Create"))
		return
	}

	if req.ID == "" {
		req.ID = ksuid.New().String()
	}

	if err := h.service.Create(ctx, req.ID, userId, req.Type, req.Name, req.Symbol, req.Quantity, req.PurchasePrice, req.CurrentPrice, req.SettlementCurrency); err != nil {
		_ = ctx.Error(mapInvestmentError(ctx, "InvestmentHandler.Create", err))
		return
	}

	ctx.Status(http.StatusCreated)
}

func (h *InvestmentHandler) FundBroker(ctx *gin.Context) {
	var req struct {
		SourceAccountID string  `json:"source_account_id" binding:"required"`
		SourceAmount    float64 `json:"source_amount" binding:"required,gt=0"`
		TargetCurrency  string  `json:"target_currency"`
		ExchangeRate    float64 `json:"exchange_rate"`
		FeeAmount       float64 `json:"fee_amount"`
		Notes           string  `json:"notes"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		_ = ctx.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid funding payload: "+err.Error()).WithContext(ctx.Request.Context()).WithOperation("InvestmentHandler.FundBroker"))
		return
	}

	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized").WithContext(ctx.Request.Context()).WithOperation("InvestmentHandler.FundBroker"))
		return
	}

	if err := h.service.FundBroker(ctx, userId, investmentService.FundingRequest{
		SourceAccountID: req.SourceAccountID,
		SourceAmount:    req.SourceAmount,
		TargetCurrency:  req.TargetCurrency,
		ExchangeRate:    req.ExchangeRate,
		FeeAmount:       req.FeeAmount,
		Notes:           req.Notes,
	}); err != nil {
		_ = ctx.Error(mapInvestmentError(ctx, "InvestmentHandler.FundBroker", err))
		return
	}

	ctx.Status(http.StatusCreated)
}

func (h *InvestmentHandler) GetFundingBalances(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized").WithContext(ctx.Request.Context()).WithOperation("InvestmentHandler.GetFundingBalances"))
		return
	}

	balances, err := h.service.GetFundingBalances(ctx, userId)
	if err != nil {
		_ = ctx.Error(mapInvestmentError(ctx, "InvestmentHandler.GetFundingBalances", err))
		return
	}

	ctx.JSON(http.StatusOK, balances)
}

func (h *InvestmentHandler) FindAll(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized").WithContext(ctx.Request.Context()).WithOperation("InvestmentHandler.FindAll"))
		return
	}

	investments, err := h.service.FindAll(ctx, userId)
	if err != nil {
		_ = ctx.Error(mapInvestmentError(ctx, "InvestmentHandler.FindAll", err))
		return
	}

	ctx.JSON(http.StatusOK, investments)
}

func (h *InvestmentHandler) Update(ctx *gin.Context) {
	var req investment.Investment
	if err := ctx.ShouldBindJSON(&req); err != nil {
		_ = ctx.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid investment update payload: "+err.Error()).WithContext(ctx.Request.Context()).WithOperation("InvestmentHandler.Update"))
		return
	}

	// In a real app we might want to fetch first to verify ownership, assuming service/repo handles or strict ID checks
	if err := h.service.Update(ctx, &req); err != nil {
		_ = ctx.Error(mapInvestmentError(ctx, "InvestmentHandler.Update", err))
		return
	}

	ctx.Status(http.StatusOK)
}

func (h *InvestmentHandler) Delete(ctx *gin.Context) {
	id := ctx.Param("id")
	if err := h.service.Delete(ctx, id); err != nil {
		_ = ctx.Error(mapInvestmentError(ctx, "InvestmentHandler.Delete", err))
		return
	}
	ctx.Status(http.StatusOK)
}

func mapInvestmentError(ctx *gin.Context, operation string, err error) error {
	if err == nil {
		return nil
	}

	lowerMessage := strings.ToLower(err.Error())
	appErr := apperrors.NewInternalError("Investment operation failed", err).WithContext(ctx.Request.Context()).WithOperation(operation)

	switch {
	case strings.Contains(lowerMessage, "required"), strings.Contains(lowerMessage, "invalid"), strings.Contains(lowerMessage, "must be"):
		appErr = apperrors.NewValidationError("INVALID_INVESTMENT_INPUT", err.Error()).WithCause(err).WithContext(ctx.Request.Context()).WithOperation(operation)
	case strings.Contains(lowerMessage, "not found"):
		appErr = apperrors.NewNotFoundError("INVESTMENT_RESOURCE", err.Error()).WithCause(err).WithContext(ctx.Request.Context()).WithOperation(operation)
	case strings.Contains(lowerMessage, "insufficient"):
		appErr = apperrors.NewConflictError("INVESTMENT_FUNDING", err.Error()).WithCause(err).WithContext(ctx.Request.Context()).WithOperation(operation)
	}

	log.Warn().
		Err(err).
		Str("operation", operation).
		Str("path", ctx.FullPath()).
		Str("method", ctx.Request.Method).
		Str("request_id", ctx.GetString("X-Request-ID")).
		Str("user_id", ctx.GetString("X-User-Id")).
		Msg("investment operation failed")

	return appErr
}
