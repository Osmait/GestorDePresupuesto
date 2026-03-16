package ai

import (
	"context"
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	"github.com/osmait/gestorDePresupuesto/internal/services/ai/tasks"
	"github.com/rs/zerolog/log"
)

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
		DocumentType:    req.DocumentType,
		AccountID:       req.AccountID,
		AccountCurrency: req.AccountCurrency,
		Categories:      categoryData,
		Language:        req.Language,
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

	duplicates := h.detectPotentialDuplicates(c.Request.Context(), userID, response.Data.Transactions)
	response.Data.PotentialDuplicates = duplicates
	response.Data.CategorySuggestions = []dto.CategorySuggestion{}
	if h.db != nil {
		if enabled, flagErr := middleware.IsFeatureEnabled(c, h.db, userID, "ai_category_suggestions"); flagErr == nil && enabled {
			response.Data.CategorySuggestions = h.suggestCategoriesForTransactions(
				c.Request.Context(),
				userID,
				response.Data.Transactions,
				categoryData,
			)
		} else if flagErr != nil {
			log.Warn().Err(flagErr).Str("user_id", userID).Msg("failed to evaluate ai_category_suggestions flag")
		}
	}

	if h.aiCache != nil {
		h.aiCache.SetExtraction(c.Request.Context(), userID, fileHash, req.DocumentType, response)
	}

	log.Info().
		Str("user_id", userID).
		Str("account_id", req.AccountID).
		Int("transactions_count", response.Data.Count).
		Int("potential_duplicates", len(response.Data.PotentialDuplicates)).
		Int("category_suggestions", len(response.Data.CategorySuggestions)).
		Int("total_tokens", result.Usage.TotalTokens).
		Msg("AI extraction completed")

	c.JSON(http.StatusOK, response)
}

func (h *Handler) extractTransactionsFromDocuments(
	ctx context.Context,
	userID string,
	accountID string,
	accountCurrency string,
	documentType string,
	language string,
	filesRequest []struct {
		Filename    string `json:"filename" binding:"required"`
		ContentType string `json:"content_type" binding:"required"`
		Base64Data  string `json:"base64_data" binding:"required"`
	},
) ([]*transaction.Transaction, error) {
	categories, err := h.categoryRepository.FindAll(ctx, userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch user categories")
		return nil, apperrors.NewInternalError("Failed to fetch categories", err)
	}

	categoryData := make([]tasks.CategoryData, len(categories))
	for i, cat := range categories {
		categoryData[i] = tasks.CategoryData{ID: cat.Id, Name: cat.Name}
	}

	input := &tasks.ExtractorInput{
		DocumentType:    documentType,
		AccountID:       accountID,
		AccountCurrency: accountCurrency,
		Categories:      categoryData,
		Language:        language,
	}

	files := make([]domain.DocumentFile, len(filesRequest))
	for i, f := range filesRequest {
		data, decodeErr := base64.StdEncoding.DecodeString(f.Base64Data)
		if decodeErr != nil {
			return nil, apperrors.NewValidationError("INVALID_BASE64", "Invalid base64 data in file "+f.Filename)
		}
		files[i] = domain.DocumentFile{
			Filename:    f.Filename,
			ContentType: f.ContentType,
			Data:        data,
			Size:        int64(len(data)),
		}
	}

	result, execErr := h.aiService.Execute(ctx, domain.TaskExtractTransactions, input, files)
	if execErr != nil {
		log.Error().Err(execErr).Str("user_id", userID).Msg("AI extraction failed")
		return nil, apperrors.NewInternalError("Extraction failed", execErr)
	}

	transactions, ok := result.Data.([]*transaction.Transaction)
	if !ok {
		return []*transaction.Transaction{}, nil
	}

	return transactions, nil
}
