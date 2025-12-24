package recurring_transaction

import (
	"net/http"

	"github.com/gin-gonic/gin"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/recurring_transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/recurring_transaction"
	service "github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
)

type RecurringTransactionHandler struct {
	service *service.RecurringTransactionService
}

func NewRecurringTransactionHandler(service *service.RecurringTransactionService) *RecurringTransactionHandler {
	return &RecurringTransactionHandler{
		service: service,
	}
}

func (h *RecurringTransactionHandler) Create(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	var req dto.RecurringTransactionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rt := domain.NewRecurringTransaction(
		"", // ID generated in service
		userId,
		req.Name,
		req.Description,
		req.Amount,
		req.Type,
		req.AccountID,
		req.CategoryID,
		req.BudgetID,
		req.DayOfMonth,
	)

	if err := h.service.Create(ctx, rt); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"message": "Recurring transaction created"})
}

func (h *RecurringTransactionHandler) FindAll(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	results, err := h.service.FindAllByUser(ctx, userId)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var responses []*dto.RecurringTransactionResponse
	for _, rt := range results {
		responses = append(responses, &dto.RecurringTransactionResponse{
			ID:                rt.ID,
			UserID:            rt.UserID,
			Name:              rt.Name,
			Description:       rt.Description,
			Amount:            rt.Amount,
			Type:              rt.Type,
			AccountID:         rt.AccountID,
			CategoryID:        rt.CategoryID,
			BudgetID:          rt.BudgetID,
			DayOfMonth:        rt.DayOfMonth,
			LastExecutionDate: rt.LastExecutionDate,
			CreatedAt:         rt.CreatedAt,
		})
	}

	ctx.JSON(http.StatusOK, responses)
}

func (h *RecurringTransactionHandler) Delete(ctx *gin.Context) {
	id := ctx.Param("id")
	if err := h.service.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

func (h *RecurringTransactionHandler) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	userId := ctx.GetString("X-User-Id")
	var req dto.RecurringTransactionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rt := domain.NewRecurringTransaction(
		id,
		userId,
		req.Name,
		req.Description,
		req.Amount,
		req.Type,
		req.AccountID,
		req.CategoryID,
		req.BudgetID,
		req.DayOfMonth,
	)

	if err := h.service.Update(ctx, rt); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Updated successfully"})
}

func (h *RecurringTransactionHandler) Process(ctx *gin.Context) {
	if err := h.service.ProcessDueTransactions(ctx); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Processing triggered successfully"})
}
