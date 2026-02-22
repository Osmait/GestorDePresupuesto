package recurring_transaction

import (
	"net/http"

	"github.com/gin-gonic/gin"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/recurring_transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/recurring_transaction"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
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
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("authentication required").WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.Create"))
		return
	}
	var req dto.RecurringTransactionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		_ = ctx.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid recurring transaction payload: "+err.Error()).WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.Create"))
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
		_ = ctx.Error(apperrors.NewInternalError("failed to create recurring transaction", err).WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.Create"))
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"message": "Recurring transaction created"})
}

func (h *RecurringTransactionHandler) FindAll(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("authentication required").WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.FindAll"))
		return
	}
	results, err := h.service.FindAllByUser(ctx, userId)
	if err != nil {
		_ = ctx.Error(apperrors.NewInternalError("failed to load recurring transactions", err).WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.FindAll"))
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
		_ = ctx.Error(apperrors.NewInternalError("failed to delete recurring transaction", err).WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.Delete"))
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

func (h *RecurringTransactionHandler) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	userId := ctx.GetString("X-User-Id")
	if userId == "" {
		_ = ctx.Error(apperrors.NewUnauthorizedError("authentication required").WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.Update"))
		return
	}
	var req dto.RecurringTransactionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		_ = ctx.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid recurring transaction payload: "+err.Error()).WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.Update"))
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
		_ = ctx.Error(apperrors.NewInternalError("failed to update recurring transaction", err).WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.Update"))
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Updated successfully"})
}

func (h *RecurringTransactionHandler) Process(ctx *gin.Context) {
	if err := h.service.ProcessDueTransactions(ctx); err != nil {
		_ = ctx.Error(apperrors.NewInternalError("failed to process recurring transactions", err).WithContext(ctx.Request.Context()).WithOperation("RecurringTransactionHandler.Process"))
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Processing triggered successfully"})
}
