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
//
// Runs outside the request transaction (see routes.AIProviderRoutes): the
// categories are read in one short transaction, the provider is called with
// no connection held, and duplicates/suggestions are read in another.
func (h *Handler) ExtractTransactions(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.ExtractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body"))
		return
	}

	files, err := decodeDocumentFiles(req.Files)
	if err != nil {
		_ = c.Error(err)
		return
	}

	fileHash, err := aiService.ComputeFileHash(files)
	if err != nil {
		log.Error().Err(err).Msg("Failed to compute file hash")
		_ = c.Error(apperrors.NewInternalError("Failed to compute file hash", err))
		return
	}

	// A cached extraction needs no database at all.
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

	var categoryData []tasks.CategoryData
	if err := h.inTx(c, func(ctx context.Context) error {
		var loadErr error
		categoryData, loadErr = h.loadCategoryData(ctx, userID)
		return loadErr
	}); err != nil {
		_ = c.Error(err)
		return
	}

	input := &tasks.ExtractorInput{
		DocumentType:    req.DocumentType,
		AccountID:       req.AccountID,
		AccountCurrency: req.AccountCurrency,
		Categories:      categoryData,
		Language:        req.Language,
	}

	// No transaction (and so no pooled connection) is held here.
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
	response.Data.PotentialDuplicates = []dto.PotentialDuplicate{}
	response.Data.CategorySuggestions = []dto.CategorySuggestion{}

	// Duplicates and suggestions enrich the result; the extraction itself
	// (already paid for) is returned even if they cannot be computed.
	if err := h.inTx(c, func(ctx context.Context) error {
		response.Data.PotentialDuplicates = h.detectPotentialDuplicates(ctx, userID, response.Data.Transactions)
		if h.flags != nil {
			if enabled, flagErr := h.flags.Enabled(ctx, userID, "ai_category_suggestions"); flagErr == nil && enabled {
				response.Data.CategorySuggestions = h.suggestCategoriesForTransactions(
					ctx,
					userID,
					response.Data.Transactions,
					categoryData,
				)
			} else if flagErr != nil {
				log.Warn().Err(flagErr).Str("user_id", userID).Msg("failed to evaluate ai_category_suggestions flag")
			}
		}
		return nil
	}); err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("could not compute duplicates and category suggestions")
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

// loadCategoryData returns the user's categories as the extractor expects
// them.
func (h *Handler) loadCategoryData(ctx context.Context, userID string) ([]tasks.CategoryData, error) {
	categories, err := h.categoryRepository.FindAll(ctx, userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch user categories")
		return nil, apperrors.NewInternalError("Failed to fetch categories", err)
	}
	categoryData := make([]tasks.CategoryData, len(categories))
	for i, cat := range categories {
		categoryData[i] = tasks.CategoryData{ID: cat.Id, Name: cat.Name}
	}
	return categoryData, nil
}

// documentFileRequest is one uploaded file of an extraction request.
type documentFileRequest = struct {
	Filename    string `json:"filename" binding:"required"`
	ContentType string `json:"content_type" binding:"required"`
	Base64Data  string `json:"base64_data" binding:"required"`
}

func decodeDocumentFiles(filesRequest []documentFileRequest) ([]domain.DocumentFile, error) {
	files := make([]domain.DocumentFile, len(filesRequest))
	for i, f := range filesRequest {
		data, err := base64.StdEncoding.DecodeString(f.Base64Data)
		if err != nil {
			return nil, apperrors.NewValidationError("INVALID_BASE64", "Invalid base64 data in file "+f.Filename)
		}
		files[i] = domain.DocumentFile{
			Filename:    f.Filename,
			ContentType: f.ContentType,
			Data:        data,
			Size:        int64(len(data)),
		}
	}
	return files, nil
}

// extractTransactionsFromDocuments calls the provider on the decoded files.
// It must be called without a transaction held (the caller reads the
// categories beforehand in its own short transaction).
func (h *Handler) extractTransactionsFromDocuments(
	ctx context.Context,
	userID string,
	accountID string,
	accountCurrency string,
	documentType string,
	language string,
	categoryData []tasks.CategoryData,
	files []domain.DocumentFile,
) ([]*transaction.Transaction, error) {
	input := &tasks.ExtractorInput{
		DocumentType:    documentType,
		AccountID:       accountID,
		AccountCurrency: accountCurrency,
		Categories:      categoryData,
		Language:        language,
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
