package ai

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/ai/tasks"
	"github.com/rs/zerolog/log"
)

// AnalyzeSpending godoc
//
//	@Summary		Analyze spending patterns with AI
//	@Description	Analyze transactions within a date range to provide insights and recommendations
//	@Tags			AI
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			request	body		dto.AnalyzeSpendingRequest	true	"Analysis request with date range"
//	@Success		200		{object}	dto.SpendingAnalysisResponse	"Analysis completed successfully"
//	@Failure		400		{object}	map[string]string	"Bad request"
//	@Failure		401		{object}	map[string]string	"Unauthorized"
//	@Failure		500		{object}	map[string]string	"Internal server error"
//	@Router			/ai/analyze/spending [post]
func (h *Handler) AnalyzeSpending(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.AnalyzeSpendingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	dateFrom, err := time.Parse("2006-01-02", req.DateFrom)
	if err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_DATE_FROM", "Invalid date_from format, use YYYY-MM-DD"))
		return
	}

	dateTo, err := time.Parse("2006-01-02", req.DateTo)
	if err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_DATE_TO", "Invalid date_to format, use YYYY-MM-DD"))
		return
	}

	if dateFrom.After(dateTo) {
		_ = c.Error(apperrors.NewValidationError("INVALID_DATE_RANGE", "date_from must be before date_to"))
		return
	}

	if h.aiCache != nil {
		if cached, found := h.aiCache.GetAnalysis(c.Request.Context(), userID, req.DateFrom, req.DateTo); found {
			log.Info().
				Str("user_id", userID).
				Str("date_from", req.DateFrom).
				Str("date_to", req.DateTo).
				Msg("Returning cached AI analysis")
			c.JSON(http.StatusOK, cached)
			return
		}
	}

	dateToEnd := dateTo.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	transactions, err := h.transactionRepository.FindByUserAndDateRange(
		c.Request.Context(),
		userID,
		dateFrom,
		dateToEnd,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch transactions for analysis")
		_ = c.Error(apperrors.NewInternalError("Failed to fetch transactions", err))
		return
	}

	if len(transactions) == 0 {
		c.JSON(http.StatusOK, dto.SpendingAnalysisResponse{
			Success:        true,
			Task:           string(domain.TaskSpendingAnalysis),
			Data:           dto.SpendingInsights{},
			Usage:          domain.TokenUsage{},
			ProcessingTime: 0,
			ModelUsed:      "",
		})
		return
	}

	input := tasks.PrepareAnalyzerInput(transactions, dateFrom, dateTo)
	if req.Language != "" {
		input.Language = req.Language
	} else {
		input.Language = "es"
	}

	result, err := h.aiService.Execute(
		c.Request.Context(),
		domain.TaskSpendingAnalysis,
		input,
		nil,
	)

	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("AI spending analysis failed")
		_ = c.Error(apperrors.NewInternalError("Analysis failed", err))
		return
	}

	insights, ok := result.Data.(dto.SpendingInsights)
	if !ok {
		_ = c.Error(apperrors.NewInternalError("Failed to parse analysis result", nil))
		return
	}

	response := dto.SpendingAnalysisResponse{
		Success:        true,
		Task:           string(result.TaskType),
		Data:           insights,
		Usage:          result.Usage,
		ProcessingTime: result.ProcessingTime.Milliseconds(),
		ModelUsed:      result.ModelUsed,
	}

	if h.aiCache != nil {
		h.aiCache.SetAnalysis(c.Request.Context(), userID, req.DateFrom, req.DateTo, &response)
	}

	log.Info().
		Str("user_id", userID).
		Int("transactions_count", len(transactions)).
		Int("total_tokens", result.Usage.TotalTokens).
		Msg("AI spending analysis completed")

	c.JSON(http.StatusOK, response)
}
