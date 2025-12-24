package investment

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
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
		ID            string                    `json:"id"`
		Type          investment.InvestmentType `json:"type" binding:"required"`
		Name          string                    `json:"name" binding:"required"`
		Symbol        string                    `json:"symbol" binding:"required"`
		Quantity      float64                   `json:"quantity" binding:"required"`
		PurchasePrice float64                   `json:"purchase_price" binding:"required"`
		CurrentPrice  float64                   `json:"current_price" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if req.ID == "" {
		req.ID = ksuid.New().String()
	}

	if err := h.service.Create(ctx, req.ID, userId, req.Type, req.Name, req.Symbol, req.Quantity, req.PurchasePrice, req.CurrentPrice); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.Status(http.StatusCreated)
}

func (h *InvestmentHandler) FindAll(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	investments, err := h.service.FindAll(ctx, userId)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, investments)
}

func (h *InvestmentHandler) Update(ctx *gin.Context) {
	var req investment.Investment
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In a real app we might want to fetch first to verify ownership, assuming service/repo handles or strict ID checks
	if err := h.service.Update(ctx, &req); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.Status(http.StatusOK)
}

func (h *InvestmentHandler) Delete(ctx *gin.Context) {
	id := ctx.Param("id")
	if err := h.service.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.Status(http.StatusOK)
}
