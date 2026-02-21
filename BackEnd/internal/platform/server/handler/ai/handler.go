package ai

import (
	"context"
	"encoding/base64"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
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

	if h.aiCache != nil {
		h.aiCache.SetExtraction(c.Request.Context(), userID, fileHash, req.DocumentType, response)
	}

	log.Info().
		Str("user_id", userID).
		Str("account_id", req.AccountID).
		Int("transactions_count", response.Data.Count).
		Int("potential_duplicates", len(response.Data.PotentialDuplicates)).
		Int("total_tokens", result.Usage.TotalTokens).
		Msg("AI extraction completed")

	c.JSON(http.StatusOK, response)
}

func (h *Handler) detectPotentialDuplicates(
	ctx context.Context,
	userID string,
	extracted []*transaction.Transaction,
) []dto.PotentialDuplicate {
	if len(extracted) == 0 {
		return []dto.PotentialDuplicate{}
	}

	minDate, maxDate := getExtractionDateRange(extracted)
	dateFrom := minDate.AddDate(0, 0, -7)
	dateTo := maxDate.AddDate(0, 0, 7)

	existing, err := h.transactionRepository.FindByUserAndDateRange(ctx, userID, dateFrom, dateTo)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("failed to load transactions for duplicate detection")
		return []dto.PotentialDuplicate{}
	}

	if len(existing) == 0 {
		return []dto.PotentialDuplicate{}
	}

	result := make([]dto.PotentialDuplicate, 0)
	for _, extractedTxn := range extracted {
		if extractedTxn == nil {
			continue
		}

		matches := make([]dto.DuplicateCandidate, 0)
		bestScore := 0.0
		bestType := ""

		for _, existingTxn := range existing {
			if existingTxn == nil {
				continue
			}

			matchType, score := compareTransactionsForDuplicate(extractedTxn, existingTxn)
			if matchType == "" {
				continue
			}

			createdAt := ""
			if !existingTxn.CreatedAt.IsZero() {
				createdAt = existingTxn.CreatedAt.Format(time.RFC3339)
			}

			matches = append(matches, dto.DuplicateCandidate{
				ID:             existingTxn.Id,
				Name:           existingTxn.Name,
				Amount:         math.Abs(existingTxn.Amount),
				TypeTransation: existingTxn.TypeTransation,
				AccountID:      existingTxn.AccountId,
				Currency:       normalizeCurrency(existingTxn.Currency),
				CreatedAt:      createdAt,
				Score:          score,
			})

			if matchType == "duplicate" {
				bestType = "duplicate"
			}
			if bestType != "duplicate" {
				bestType = "similar"
			}
			if score > bestScore {
				bestScore = score
			}
		}

		if len(matches) == 0 {
			continue
		}

		sort.Slice(matches, func(i, j int) bool {
			return matches[i].Score > matches[j].Score
		})

		if len(matches) > 3 {
			matches = matches[:3]
		}

		result = append(result, dto.PotentialDuplicate{
			ExtractedTransactionID: extractedTxn.Id,
			MatchType:              bestType,
			Score:                  bestScore,
			Candidates:             matches,
		})
	}

	return result
}

func compareTransactionsForDuplicate(extracted *transaction.Transaction, existing *transaction.Transaction) (string, float64) {
	if extracted == nil || existing == nil {
		return "", 0
	}

	if extracted.TypeTransation != existing.TypeTransation {
		return "", 0
	}

	if extracted.AccountId != "" && existing.AccountId != "" && extracted.AccountId != existing.AccountId {
		return "", 0
	}

	extractedAmount := math.Abs(extracted.Amount)
	existingAmount := math.Abs(existing.Amount)
	amountDiff := math.Abs(extractedAmount - existingAmount)

	dateDiffDays := daysBetween(extracted.CreatedAt, existing.CreatedAt)
	nameSimilarity := nameSimilarityScore(extracted.Name, existing.Name)

	currencyA := normalizeCurrency(extracted.Currency)
	currencyB := normalizeCurrency(existing.Currency)
	sameCurrency := currencyA == currencyB

	exactDuplicate := amountDiff <= 0.01 && dateDiffDays == 0 && sameCurrency && nameSimilarity >= 0.9
	if exactDuplicate {
		return "duplicate", 1
	}

	score := 0.0
	if amountDiff <= 0.5 {
		score += 0.45
	} else if amountDiff <= 2 {
		score += 0.3
	} else if amountDiff <= 5 {
		score += 0.15
	}

	if dateDiffDays == 0 {
		score += 0.3
	} else if dateDiffDays <= 1 {
		score += 0.2
	} else if dateDiffDays <= 2 {
		score += 0.1
	}

	score += nameSimilarity * 0.2

	if sameCurrency {
		score += 0.05
	}

	if score >= 0.55 {
		return "similar", math.Min(score, 0.99)
	}

	return "", 0
}

func getExtractionDateRange(transactions []*transaction.Transaction) (time.Time, time.Time) {
	now := time.Now()
	minDate := now
	maxDate := now
	initialized := false

	for _, txn := range transactions {
		if txn == nil {
			continue
		}
		date := txn.CreatedAt
		if date.IsZero() {
			date = now
		}

		if !initialized {
			minDate = date
			maxDate = date
			initialized = true
			continue
		}

		if date.Before(minDate) {
			minDate = date
		}
		if date.After(maxDate) {
			maxDate = date
		}
	}

	if !initialized {
		return now, now
	}

	return minDate, maxDate
}

func daysBetween(a, b time.Time) int {
	if a.IsZero() || b.IsZero() {
		return 2
	}
	aDate := time.Date(a.Year(), a.Month(), a.Day(), 0, 0, 0, 0, a.Location())
	bDate := time.Date(b.Year(), b.Month(), b.Day(), 0, 0, 0, 0, b.Location())
	diff := aDate.Sub(bDate)
	if diff < 0 {
		diff = -diff
	}
	return int(diff.Hours() / 24)
}

func normalizeCurrency(currency string) string {
	value := strings.ToUpper(strings.TrimSpace(currency))
	if value == "" {
		return "DOP"
	}
	return value
}

func normalizeName(value string) string {
	if value == "" {
		return ""
	}

	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(value)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsSpace(r) {
			b.WriteRune(r)
		}
	}

	return strings.Join(strings.Fields(b.String()), " ")
}

func nameSimilarityScore(a, b string) float64 {
	normalizedA := normalizeName(a)
	normalizedB := normalizeName(b)

	if normalizedA == "" || normalizedB == "" {
		return 0
	}
	if normalizedA == normalizedB {
		return 1
	}
	if strings.Contains(normalizedA, normalizedB) || strings.Contains(normalizedB, normalizedA) {
		return 0.9
	}

	tokensA := strings.Fields(normalizedA)
	tokensB := strings.Fields(normalizedB)
	if len(tokensA) == 0 || len(tokensB) == 0 {
		return 0
	}

	setA := make(map[string]struct{}, len(tokensA))
	for _, token := range tokensA {
		setA[token] = struct{}{}
	}

	common := 0
	for _, token := range tokensB {
		if _, ok := setA[token]; ok {
			common++
		}
	}

	maxLen := len(tokensA)
	if len(tokensB) > maxLen {
		maxLen = len(tokensB)
	}
	if maxLen == 0 {
		return 0
	}

	return float64(common) / float64(maxLen)
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
