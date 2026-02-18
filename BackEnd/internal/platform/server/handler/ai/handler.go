package ai

import (
	"encoding/base64"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	"github.com/osmait/gestorDePresupuesto/internal/services/ai/tasks"
	"github.com/rs/zerolog/log"
)

type Handler struct {
	aiService             *aiService.Service
	categoryRepository    categoryRepo.CategoryRepoInterface
	transactionRepository transactionRepo.TransactionRepositoryInterface
	aiCache               *aiService.AICacheService
}

func NewHandler(
	aiService *aiService.Service,
	categoryRepo categoryRepo.CategoryRepoInterface,
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	aiCache *aiService.AICacheService,
) *Handler {
	return &Handler{
		aiService:             aiService,
		categoryRepository:    categoryRepo,
		transactionRepository: transactionRepo,
		aiCache:               aiCache,
	}
}

// ExtractTransactions godoc
//
//	@Summary		Extract transactions from documents using AI
//	@Description	Upload receipts, invoices or bank statements to extract transactions automatically
//	@Tags			AI
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			request	body		dto.ExtractRequest	true	"Extraction request with files"
//	@Success		200		{object}	dto.ExtractResponse	"Transactions extracted successfully"
//	@Failure		400		{object}	map[string]string	"Bad request"
//	@Failure		401		{object}	map[string]string	"Unauthorized"
//	@Failure		500		{object}	map[string]string	"Internal server error"
//	@Router			/ai/extract/transactions [post]
func (h *Handler) ExtractTransactions(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.ExtractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	categories, err := h.categoryRepository.FindAll(c.Request.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch user categories")
		_ = c.Error(apperrors.NewInternalError("Failed to fetch categories", err))
		return
	}

	categoryData := make([]tasks.CategoryData, len(categories))
	for i, cat := range categories {
		categoryData[i] = tasks.CategoryData{
			ID:   cat.Id,
			Name: cat.Name,
		}
	}

	input := &tasks.ExtractorInput{
		DocumentType: req.DocumentType,
		AccountID:    req.AccountID,
		Categories:   categoryData,
		Language:     req.Language,
	}

	files := make([]domain.DocumentFile, len(req.Files))
	for i, f := range req.Files {
		data, err := base64.StdEncoding.DecodeString(f.Base64Data)
		if err != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_BASE64", "Invalid base64 data in file "+f.Filename))
			return
		}

		files[i] = domain.DocumentFile{
			Filename:    f.Filename,
			ContentType: f.ContentType,
			Data:        data,
			Size:        int64(len(data)),
		}
	}

	fileHash, err := aiService.ComputeFileHash(files)
	if err != nil {
		log.Error().Err(err).Msg("Failed to compute file hash")
		_ = c.Error(apperrors.NewInternalError("Failed to compute file hash", err))
		return
	}

	if h.aiCache != nil {
		if cached, found := h.aiCache.GetExtraction(c.Request.Context(), userID, fileHash, req.DocumentType); found {
			log.Info().
				Str("user_id", userID).
				Str("file_hash", fileHash).
				Msg("Returning cached AI extraction")
			c.JSON(http.StatusOK, cached)
			return
		}
	}

	result, err := h.aiService.Execute(
		c.Request.Context(),
		domain.TaskExtractTransactions,
		input,
		files,
	)

	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("AI extraction failed")
		_ = c.Error(apperrors.NewInternalError("Extraction failed", err))
		return
	}

	response := dto.ToExtractResponse(result)

	if h.aiCache != nil {
		h.aiCache.SetExtraction(c.Request.Context(), userID, fileHash, req.DocumentType, response)
	}

	log.Info().
		Str("user_id", userID).
		Str("account_id", req.AccountID).
		Int("transactions_count", response.Data.Count).
		Int("total_tokens", result.Usage.TotalTokens).
		Msg("AI extraction completed")

	c.JSON(http.StatusOK, response)
}

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
