package investment

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
	"github.com/segmentio/ksuid"
)

type InvestmentHandler struct {
	service *investmentService.InvestmentService
}

func NewInvestmentHandler(service *investmentService.InvestmentService) *InvestmentHandler {
	return &InvestmentHandler{service: service}
}

// UpdateInvestmentRequest is the body accepted by the update endpoint. Only the
// fields listed here can be changed; any id/user_id sent by the client is
// ignored (ownership always comes from the JWT). Omitted fields keep their
// current value.
type UpdateInvestmentRequest struct {
	// ID is only read by the legacy `PUT /investments` route, which has no path
	// parameter. It is used to look the row up among the caller's investments.
	ID                 string                     `json:"id"`
	Type               *investment.InvestmentType `json:"type"`
	Name               *string                    `json:"name"`
	Symbol             *string                    `json:"symbol"`
	Quantity           *money.Amount              `json:"quantity" binding:"omitempty,gt=0"`
	PurchasePrice      *money.Amount              `json:"purchase_price" binding:"omitempty,gt=0"`
	CurrentPrice       *money.Amount              `json:"current_price" binding:"omitempty,gte=0"`
	SettlementCurrency *string                    `json:"settlement_currency"`
}

func (h *InvestmentHandler) Create(ctx *gin.Context) {
	var req struct {
		Type               investment.InvestmentType `json:"type" binding:"required"`
		Name               string                    `json:"name" binding:"required"`
		Symbol             string                    `json:"symbol" binding:"required"`
		Quantity           money.Amount              `json:"quantity" binding:"required,gt=0"`
		PurchasePrice      money.Amount              `json:"purchase_price" binding:"required,gt=0"`
		CurrentPrice       money.Amount              `json:"current_price" binding:"required,gt=0"`
		SettlementCurrency string                    `json:"settlement_currency"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
		return
	}

	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized"))
		return
	}

	// The id is always generated server side.
	id := ksuid.New().String()

	if err := h.service.Create(ctx.Request.Context(), id, userId, req.Type, req.Name, req.Symbol, req.Quantity, req.PurchasePrice, req.CurrentPrice, req.SettlementCurrency); err != nil {
		_ = ctx.Error(err)
		return
	}

	ctx.Status(http.StatusCreated)
}

func (h *InvestmentHandler) FundBroker(ctx *gin.Context) {
	var req struct {
		SourceAccountID string       `json:"source_account_id" binding:"required"`
		SourceAmount    money.Amount `json:"source_amount" binding:"required,gt=0"`
		TargetCurrency  string       `json:"target_currency"`
		ExchangeRate    money.Amount `json:"exchange_rate"`
		FeeAmount       money.Amount `json:"fee_amount"`
		Notes           string       `json:"notes"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
		return
	}

	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized"))
		return
	}

	if err := h.service.FundBroker(ctx.Request.Context(), userId, investmentService.FundingRequest{
		SourceAccountID: req.SourceAccountID,
		SourceAmount:    req.SourceAmount,
		TargetCurrency:  req.TargetCurrency,
		ExchangeRate:    req.ExchangeRate,
		FeeAmount:       req.FeeAmount,
		Notes:           req.Notes,
	}); err != nil {
		_ = ctx.Error(err)
		return
	}

	ctx.Status(http.StatusCreated)
}

func (h *InvestmentHandler) GetFundingBalances(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized"))
		return
	}

	balances, err := h.service.GetFundingBalances(ctx.Request.Context(), userId)
	if err != nil {
		_ = ctx.Error(err)
		return
	}

	ctx.JSON(http.StatusOK, balances)
}

func (h *InvestmentHandler) FindAll(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized"))
		return
	}

	investments, err := h.service.FindAll(ctx.Request.Context(), userId)
	if err != nil {
		_ = ctx.Error(err)
		return
	}

	ctx.JSON(http.StatusOK, investments)
}

// Update modifies an investment owned by the authenticated user. The target id
// comes from the `:id` path parameter (`PUT /investments/:id`) or, for the
// legacy `PUT /investments` route, from the body. Either way the lookup is
// scoped to the caller, so another user's id yields 404.
func (h *InvestmentHandler) Update(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized"))
		return
	}

	var req UpdateInvestmentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
		return
	}

	id := strings.TrimSpace(ctx.Param("id"))
	if id == "" {
		id = strings.TrimSpace(req.ID)
	}
	if id == "" {
		_ = ctx.Error(apperrors.NewValidationError("MISSING_ID", "Investment id is required"))
		return
	}

	updated, err := h.service.Update(ctx.Request.Context(), id, userId, investmentService.UpdateInput{
		Type:               req.Type,
		Name:               req.Name,
		Symbol:             req.Symbol,
		Quantity:           req.Quantity,
		PurchasePrice:      req.PurchasePrice,
		CurrentPrice:       req.CurrentPrice,
		SettlementCurrency: req.SettlementCurrency,
	})
	if err != nil {
		_ = ctx.Error(err)
		return
	}

	ctx.JSON(http.StatusOK, updated)
}

func (h *InvestmentHandler) Delete(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("unauthorized"))
		return
	}

	id := ctx.Param("id")
	if err := h.service.Delete(ctx.Request.Context(), id, userId); err != nil {
		_ = ctx.Error(err)
		return
	}
	ctx.Status(http.StatusOK)
}
