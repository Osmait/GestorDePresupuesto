package recurring_transaction

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

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

// writeError maps service errors to HTTP responses without leaking internals.
func writeError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"error": "recurring transaction not found"})
	case errors.Is(err, service.ErrInvalidReference), errors.Is(err, service.ErrInvalidInput):
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		log.Error().Err(err).Msg("recurring transaction request failed")
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
	}
}

// userID returns the authenticated user id set by the auth middleware. The
// user id is never read from the request body.
func userID(ctx *gin.Context) (string, bool) {
	id := ctx.GetString("X-User-Id")
	if id == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return "", false
	}
	return id, true
}

func (h *RecurringTransactionHandler) Create(ctx *gin.Context) {
	userId, ok := userID(ctx)
	if !ok {
		return
	}
	var req dto.RecurringTransactionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := req.Validate(); err != nil {
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

	if err := h.service.Create(ctx.Request.Context(), rt); err != nil {
		writeError(ctx, err)
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"message": "Recurring transaction created", "id": rt.ID})
}

func (h *RecurringTransactionHandler) FindAll(ctx *gin.Context) {
	userId, ok := userID(ctx)
	if !ok {
		return
	}
	results, err := h.service.FindAllByUser(ctx.Request.Context(), userId)
	if err != nil {
		writeError(ctx, err)
		return
	}

	responses := make([]*dto.RecurringTransactionResponse, 0, len(results))
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
			NextExecutionDate: rt.NextExecutionDate,
			CreatedAt:         rt.CreatedAt,
		})
	}

	ctx.JSON(http.StatusOK, responses)
}

func (h *RecurringTransactionHandler) Delete(ctx *gin.Context) {
	userId, ok := userID(ctx)
	if !ok {
		return
	}
	if err := h.service.Delete(ctx.Request.Context(), ctx.Param("id"), userId); err != nil {
		writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

func (h *RecurringTransactionHandler) Update(ctx *gin.Context) {
	userId, ok := userID(ctx)
	if !ok {
		return
	}
	var req dto.RecurringTransactionRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := req.Validate(); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rt := domain.NewRecurringTransaction(
		ctx.Param("id"),
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

	if err := h.service.Update(ctx.Request.Context(), rt); err != nil {
		writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Updated successfully"})
}

// Process executes the authenticated user's due recurring transactions now.
// It only touches the caller's own rules; the background scheduler handles
// everyone else.
func (h *RecurringTransactionHandler) Process(ctx *gin.Context) {
	userId, ok := userID(ctx)
	if !ok {
		return
	}
	if err := h.service.ProcessDueTransactionsForUser(ctx.Request.Context(), userId); err != nil {
		writeError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Processing triggered successfully"})
}
