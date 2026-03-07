package ai

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
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
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"
	"github.com/osmait/gestorDePresupuesto/internal/services/ai/tasks"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

type Handler struct {
	aiService             *aiService.Service
	categoryRepository    categoryRepo.CategoryRepoInterface
	transactionRepository transactionRepo.TransactionRepositoryInterface
	transactionService    *transactionService.TransactionService
	db                    *sql.DB
	aiCache               *aiService.AICacheService
}

func NewHandler(
	aiService *aiService.Service,
	categoryRepo categoryRepo.CategoryRepoInterface,
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	transactionService *transactionService.TransactionService,
	db *sql.DB,
	aiCache *aiService.AICacheService,
) *Handler {
	return &Handler{
		aiService:             aiService,
		categoryRepository:    categoryRepo,
		transactionRepository: transactionRepo,
		transactionService:    transactionService,
		db:                    db,
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

func (h *Handler) ReconciliationPreview(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.ReconciliationPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	transactions, err := h.extractTransactionsFromDocuments(c.Request.Context(), userID, req.AccountID, req.AccountCurrency, req.DocumentType, req.Language, req.Files)
	if err != nil {
		_ = c.Error(err)
		return
	}

	duplicates := h.detectPotentialDuplicates(c.Request.Context(), userID, transactions)
	duplicateByID := make(map[string]dto.PotentialDuplicate, len(duplicates))
	for _, item := range duplicates {
		duplicateByID[item.ExtractedTransactionID] = item
	}

	exactMatches := make([]dto.ReconciliationItem, 0)
	similarMatches := make([]dto.ReconciliationItem, 0)
	unmatched := make([]dto.ReconciliationItem, 0)

	for _, txn := range transactions {
		if txn == nil {
			continue
		}

		dup, found := duplicateByID[txn.Id]
		if !found {
			unmatched = append(unmatched, dto.ReconciliationItem{
				Extracted:  txn,
				Candidates: []dto.DuplicateCandidate{},
				Score:      0,
				Status:     "unmatched",
			})
			continue
		}

		if dup.MatchType == "duplicate" {
			exactMatches = append(exactMatches, dto.ReconciliationItem{
				Extracted:  txn,
				Candidates: dup.Candidates,
				Score:      dup.Score,
				Status:     "exact",
			})
			continue
		}

		similarMatches = append(similarMatches, dto.ReconciliationItem{
			Extracted:  txn,
			Candidates: dup.Candidates,
			Score:      dup.Score,
			Status:     "similar",
		})
	}

	sessionID, err := h.saveReconciliationSession(
		c.Request.Context(),
		userID,
		req.AccountID,
		req.DocumentType,
		exactMatches,
		similarMatches,
		unmatched,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to persist reconciliation session", err))
		return
	}

	c.JSON(http.StatusOK, dto.ReconciliationPreviewResponse{
		Success: true,
		Data: dto.ReconciliationPreviewData{
			SessionID:      sessionID,
			ExtractedCount: len(transactions),
			ExactMatches:   exactMatches,
			SimilarMatches: similarMatches,
			Unmatched:      unmatched,
		},
	})
}

func (h *Handler) GetReconciliationSession(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	sessionID := c.Param("session_id")

	data, err := h.loadReconciliationSession(c.Request.Context(), userID, sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = c.Error(apperrors.NewNotFoundError("RECONCILIATION_NOT_FOUND", "Reconciliation session not found"))
			return
		}
		_ = c.Error(apperrors.NewInternalError("Failed to load reconciliation session", err))
		return
	}

	c.JSON(http.StatusOK, dto.ReconciliationPreviewResponse{Success: true, Data: data})
}

func (h *Handler) ApplyReconciliationSession(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	sessionID := c.Param("session_id")

	var req dto.ReconciliationApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	data, err := h.loadReconciliationSession(c.Request.Context(), userID, sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = c.Error(apperrors.NewNotFoundError("RECONCILIATION_NOT_FOUND", "Reconciliation session not found"))
			return
		}
		_ = c.Error(apperrors.NewInternalError("Failed to load reconciliation session", err))
		return
	}

	sessionAccountID, err := h.getReconciliationSessionAccountID(c.Request.Context(), userID, sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = c.Error(apperrors.NewNotFoundError("RECONCILIATION_NOT_FOUND", "Reconciliation session not found"))
			return
		}
		_ = c.Error(apperrors.NewInternalError("Failed to load reconciliation session account", err))
		return
	}

	itemsByExtractedID := make(map[string]dto.ReconciliationItem)
	for _, item := range append(append(data.ExactMatches, data.SimilarMatches...), data.Unmatched...) {
		if item.Extracted != nil {
			itemsByExtractedID[item.Extracted.Id] = item
		}
	}

	summary := dto.ReconciliationSummary{SessionID: sessionID, Linked: len(data.ExactMatches)}
	addFailure := func(extractedID string, action string, code string, message string, err error) {
		summary.Failed++
		summary.FailedItems = append(summary.FailedItems, dto.ReconciliationFailedItem{
			ExtractedTransactionID: extractedID,
			Action:                 action,
			Code:                   code,
			Message:                message,
		})
		logger := log.Warn().
			Str("session_id", sessionID).
			Str("user_id", userID).
			Str("extracted_transaction_id", extractedID).
			Str("action", action).
			Str("code", code).
			Str("message", message)
		if err != nil {
			logger = logger.Err(err)
		}
		logger.Msg("reconciliation action failed")
	}

	for _, action := range req.Actions {
		item, ok := itemsByExtractedID[action.ExtractedTransactionID]
		if !ok || item.Extracted == nil {
			addFailure(action.ExtractedTransactionID, action.Action, "ITEM_NOT_FOUND", "Extracted transaction was not found in session", nil)
			continue
		}

		switch action.Action {
		case "ignore":
			err = h.updateReconciliationItemAction(c.Request.Context(), sessionID, action.ExtractedTransactionID, "ignore", "", "")
			if err != nil {
				addFailure(action.ExtractedTransactionID, action.Action, "UPDATE_FAILED", "Failed to mark item as ignored", err)
				continue
			}
			summary.Ignored++
		case "link":
			linkedID := action.LinkedTransactionID
			if linkedID == "" && len(item.Candidates) > 0 {
				linkedID = item.Candidates[0].ID
			}
			if strings.TrimSpace(linkedID) == "" {
				addFailure(action.ExtractedTransactionID, action.Action, "MISSING_LINKED_TRANSACTION", "No linked transaction was provided for link action", nil)
				continue
			}
			err = h.updateReconciliationItemAction(c.Request.Context(), sessionID, action.ExtractedTransactionID, "link", linkedID, "")
			if err != nil {
				addFailure(action.ExtractedTransactionID, action.Action, "UPDATE_FAILED", "Failed to save link action", err)
				continue
			}
			summary.Linked++
		case "create":
			tx := item.Extracted
			createdAt := tx.CreatedAt
			if createdAt.IsZero() {
				createdAt = time.Now()
			}

			accountID := strings.TrimSpace(tx.AccountId)
			if accountID == "" {
				accountID = sessionAccountID
			}
			if accountID == "" {
				addFailure(action.ExtractedTransactionID, action.Action, "MISSING_ACCOUNT_ID", "Account ID is required to create transaction", nil)
				continue
			}

			categoryID := strings.TrimSpace(action.CategoryID)
			if categoryID == "" {
				categoryID = strings.TrimSpace(tx.CategoryId)
			}
			if categoryID == "" {
				addFailure(action.ExtractedTransactionID, action.Action, "MISSING_CATEGORY_ID", "Category ID is required to create transaction", nil)
				continue
			}

			currency := strings.ToUpper(strings.TrimSpace(tx.Currency))
			if currency == "" {
				currency = "DOP"
			}

			amount := math.Abs(tx.Amount)
			createdID, createErr := h.transactionService.CreateTransactionWithID(
				c.Request.Context(),
				tx.Name,
				tx.Description,
				amount,
				tx.TypeTransation,
				accountID,
				userID,
				categoryID,
				tx.BudgetId,
				currency,
				createdAt,
			)
			if createErr != nil {
				code, message := classifyReconciliationCreateError(createErr)
				addFailure(action.ExtractedTransactionID, action.Action, code, message, createErr)
				continue
			}

			err = h.updateReconciliationItemAction(c.Request.Context(), sessionID, action.ExtractedTransactionID, "create", "", createdID)
			if err != nil {
				addFailure(action.ExtractedTransactionID, action.Action, "UPDATE_FAILED", "Transaction was created but reconciliation item update failed", err)
				continue
			}
			summary.Created++
		default:
			addFailure(action.ExtractedTransactionID, action.Action, "INVALID_ACTION", "Unsupported reconciliation action", nil)
		}
	}

	if err := h.markReconciliationSessionApplied(c.Request.Context(), sessionID); err != nil {
		log.Warn().Err(err).Str("session_id", sessionID).Msg("failed to mark reconciliation session as applied")
	}

	c.JSON(http.StatusOK, dto.ReconciliationApplyResponse{Success: true, Data: summary})
}

func (h *Handler) SavingsPlan(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.SavingsPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	averageMonthlySavings, err := h.calculateAverageMonthlySavings(c.Request.Context(), userID, req.AccountID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to fetch transactions for savings plan", err))
		return
	}

	planningMonths := resolvePlanningMonths(req.TargetDate)
	recommendedMonthly, recommendedWeekly, estimatedMonths := buildSavingsPlan(req.TargetAmount, averageMonthlySavings, planningMonths)
	feasibleByDate := isTargetFeasibleByDate(req.TargetDate, estimatedMonths)
	targetDate := strings.TrimSpace(req.TargetDate)

	c.JSON(http.StatusOK, dto.SavingsPlanResponse{
		Success: true,
		Data: dto.SavingsPlanData{
			TargetAmount:            req.TargetAmount,
			CurrentAverageSavings:   averageMonthlySavings,
			RecommendedMonthlySave:  recommendedMonthly,
			RecommendedWeeklySave:   recommendedWeekly,
			EstimatedMonthsToTarget: estimatedMonths,
			FeasibleByDate:          feasibleByDate,
			TargetDate:              targetDate,
		},
	})
}

func (h *Handler) CreateSavingsGoal(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.CreateSavingsGoalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	goalID := ksuid.New().String()
	now := time.Now()
	targetDate, err := parseOptionalDate(req.TargetDate)
	if err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_DATE", "Invalid target_date format, expected YYYY-MM-DD"))
		return
	}

	_, err = h.db.ExecContext(
		c.Request.Context(),
		`INSERT INTO savings_goals
			(id, user_id, name, target_amount, current_saved, target_date, account_id, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), 'active', $8, $9)`,
		goalID,
		userID,
		strings.TrimSpace(req.Name),
		req.TargetAmount,
		math.Max(req.CurrentSaved, 0),
		targetDate,
		strings.TrimSpace(req.AccountID),
		now,
		now,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to create savings goal", err))
		return
	}

	goal, err := h.findSavingsGoalByID(c.Request.Context(), userID, goalID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to load created savings goal", err))
		return
	}

	c.JSON(http.StatusOK, dto.SavingsGoalResponse{Success: true, Data: goal})
}

func (h *Handler) ListSavingsGoals(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	rows, err := h.db.QueryContext(
		c.Request.Context(),
		`SELECT id, name, target_amount, current_saved, target_date, account_id, status, created_at, updated_at
		 FROM savings_goals
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to list savings goals", err))
		return
	}
	defer func() { _ = rows.Close() }()

	goals := make([]dto.SavingsGoal, 0)
	for rows.Next() {
		goal, scanErr := scanSavingsGoal(rows)
		if scanErr != nil {
			_ = c.Error(apperrors.NewInternalError("Failed to parse savings goals", scanErr))
			return
		}
		goals = append(goals, goal)
	}

	if err := rows.Err(); err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed while reading savings goals", err))
		return
	}

	c.JSON(http.StatusOK, dto.SavingsGoalListResponse{Success: true, Data: goals})
}

func (h *Handler) UpdateSavingsGoal(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	goalID := c.Param("goal_id")

	var req dto.UpdateSavingsGoalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	current, err := h.findSavingsGoalByID(c.Request.Context(), userID, goalID)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = c.Error(apperrors.NewNotFoundError("SAVINGS_GOAL_NOT_FOUND", "Savings goal not found"))
			return
		}
		_ = c.Error(apperrors.NewInternalError("Failed to load savings goal", err))
		return
	}

	name := current.Name
	if strings.TrimSpace(req.Name) != "" {
		name = strings.TrimSpace(req.Name)
	}

	targetAmount := current.TargetAmount
	if req.TargetAmount > 0 {
		targetAmount = req.TargetAmount
	}

	currentSaved := current.CurrentSaved
	if req.CurrentSaved >= 0 {
		currentSaved = req.CurrentSaved
	}

	status := current.Status
	if strings.TrimSpace(req.Status) != "" {
		status = strings.TrimSpace(req.Status)
	}

	accountID := current.AccountID
	if req.AccountID != "" {
		accountID = req.AccountID
	}

	targetDate := sql.NullTime{}
	if req.TargetDate != "" {
		parsedDate, parseErr := parseOptionalDate(req.TargetDate)
		if parseErr != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_DATE", "Invalid target_date format, expected YYYY-MM-DD"))
			return
		}
		targetDate = parsedDate
	} else if current.TargetDate != "" {
		if parsedDate, parseErr := time.Parse("2006-01-02", current.TargetDate); parseErr == nil {
			targetDate = sql.NullTime{Time: parsedDate, Valid: true}
		}
	}

	_, err = h.db.ExecContext(
		c.Request.Context(),
		`UPDATE savings_goals
		 SET name = $1,
		     target_amount = $2,
		     current_saved = $3,
		     target_date = $4,
		     account_id = NULLIF($5, ''),
		     status = $6,
		     updated_at = $7
		 WHERE id = $8 AND user_id = $9`,
		name,
		targetAmount,
		currentSaved,
		targetDate,
		accountID,
		status,
		time.Now(),
		goalID,
		userID,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to update savings goal", err))
		return
	}

	updated, err := h.findSavingsGoalByID(c.Request.Context(), userID, goalID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to load updated savings goal", err))
		return
	}

	c.JSON(http.StatusOK, dto.SavingsGoalResponse{Success: true, Data: updated})
}

func (h *Handler) DeleteSavingsGoal(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	goalID := c.Param("goal_id")

	result, err := h.db.ExecContext(
		c.Request.Context(),
		`DELETE FROM savings_goals WHERE id = $1 AND user_id = $2`,
		goalID,
		userID,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to delete savings goal", err))
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		_ = c.Error(apperrors.NewNotFoundError("SAVINGS_GOAL_NOT_FOUND", "Savings goal not found"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) GetSavingsGoalProgress(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	goalID := c.Param("goal_id")

	goal, err := h.findSavingsGoalByID(c.Request.Context(), userID, goalID)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = c.Error(apperrors.NewNotFoundError("SAVINGS_GOAL_NOT_FOUND", "Savings goal not found"))
			return
		}
		_ = c.Error(apperrors.NewInternalError("Failed to load savings goal", err))
		return
	}

	averageMonthlySavings, err := h.calculateAverageMonthlySavings(c.Request.Context(), userID, goal.AccountID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to calculate savings progress", err))
		return
	}

	remaining := goal.TargetAmount - goal.CurrentSaved
	if remaining < 0 {
		remaining = 0
	}
	planningMonths := resolvePlanningMonths(goal.TargetDate)
	recommendedMonthly, recommendedWeekly, estimatedMonths := buildSavingsPlan(remaining, averageMonthlySavings, planningMonths)
	feasibleByDate := isTargetFeasibleByDate(goal.TargetDate, estimatedMonths)

	c.JSON(http.StatusOK, dto.SavingsGoalProgressResponse{
		Success: true,
		Data: dto.SavingsGoalProgressData{
			Goal:                    goal,
			CurrentAverageSavings:   averageMonthlySavings,
			RecommendedMonthlySave:  recommendedMonthly,
			RecommendedWeeklySave:   recommendedWeekly,
			EstimatedMonthsToTarget: estimatedMonths,
			FeasibleByDate:          feasibleByDate,
		},
	})
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

func (h *Handler) saveReconciliationSession(
	ctx context.Context,
	userID string,
	accountID string,
	documentType string,
	exactMatches []dto.ReconciliationItem,
	similarMatches []dto.ReconciliationItem,
	unmatched []dto.ReconciliationItem,
) (string, error) {
	if h.db == nil {
		return "", fmt.Errorf("database connection not available")
	}

	sessionID := ksuid.New().String()
	now := time.Now()

	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO reconciliation_sessions
			(id, user_id, account_id, document_type, status, extracted_count, exact_count, similar_count, unmatched_count, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, 'previewed', $5, $6, $7, $8, $9, $10)`,
		sessionID,
		userID,
		accountID,
		documentType,
		len(exactMatches)+len(similarMatches)+len(unmatched),
		len(exactMatches),
		len(similarMatches),
		len(unmatched),
		now,
		now,
	)
	if err != nil {
		return "", err
	}

	allItems := append(append(exactMatches, similarMatches...), unmatched...)
	for _, item := range allItems {
		if item.Extracted == nil {
			continue
		}

		itemID := ksuid.New().String()
		extractedData, marshalErr := json.Marshal(item.Extracted)
		if marshalErr != nil {
			err = marshalErr
			return "", err
		}
		candidateData, marshalErr := json.Marshal(item.Candidates)
		if marshalErr != nil {
			err = marshalErr
			return "", err
		}

		action := "pending"
		if item.Status == "exact" {
			action = "link"
		}

		linkedID := ""
		if item.Status == "exact" && len(item.Candidates) > 0 {
			linkedID = item.Candidates[0].ID
		}

		_, err = tx.ExecContext(
			ctx,
			`INSERT INTO reconciliation_items
				(id, session_id, extracted_transaction_id, extracted_data, candidate_data, match_status, score, action, linked_transaction_id, created_transaction_id, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), NULL, $10, $11)`,
			itemID,
			sessionID,
			item.Extracted.Id,
			string(extractedData),
			string(candidateData),
			item.Status,
			item.Score,
			action,
			linkedID,
			now,
			now,
		)
		if err != nil {
			return "", err
		}
	}

	err = tx.Commit()
	if err != nil {
		return "", err
	}

	return sessionID, nil
}

func (h *Handler) loadReconciliationSession(ctx context.Context, userID string, sessionID string) (dto.ReconciliationPreviewData, error) {
	if h.db == nil {
		return dto.ReconciliationPreviewData{}, fmt.Errorf("database connection not available")
	}

	var data dto.ReconciliationPreviewData
	err := h.db.QueryRowContext(
		ctx,
		`SELECT id, extracted_count FROM reconciliation_sessions WHERE id = $1 AND user_id = $2`,
		sessionID,
		userID,
	).Scan(&data.SessionID, &data.ExtractedCount)
	if err != nil {
		return dto.ReconciliationPreviewData{}, err
	}

	rows, err := h.db.QueryContext(
		ctx,
		`SELECT extracted_data, candidate_data, match_status, score
		 FROM reconciliation_items
		 WHERE session_id = $1
		 ORDER BY created_at ASC`,
		sessionID,
	)
	if err != nil {
		return dto.ReconciliationPreviewData{}, err
	}
	defer func() { _ = rows.Close() }()

	data.ExactMatches = []dto.ReconciliationItem{}
	data.SimilarMatches = []dto.ReconciliationItem{}
	data.Unmatched = []dto.ReconciliationItem{}

	for rows.Next() {
		var extractedRaw string
		var candidateRaw string
		var matchStatus string
		var score float64

		if err := rows.Scan(&extractedRaw, &candidateRaw, &matchStatus, &score); err != nil {
			return dto.ReconciliationPreviewData{}, err
		}

		extracted := &transaction.Transaction{}
		if err := json.Unmarshal([]byte(extractedRaw), extracted); err != nil {
			return dto.ReconciliationPreviewData{}, err
		}

		candidates := []dto.DuplicateCandidate{}
		if err := json.Unmarshal([]byte(candidateRaw), &candidates); err != nil {
			return dto.ReconciliationPreviewData{}, err
		}

		item := dto.ReconciliationItem{
			Extracted:  extracted,
			Candidates: candidates,
			Score:      score,
			Status:     matchStatus,
		}

		switch matchStatus {
		case "exact":
			data.ExactMatches = append(data.ExactMatches, item)
		case "similar":
			data.SimilarMatches = append(data.SimilarMatches, item)
		default:
			data.Unmatched = append(data.Unmatched, item)
		}
	}

	return data, rows.Err()
}

func (h *Handler) getReconciliationSessionAccountID(ctx context.Context, userID string, sessionID string) (string, error) {
	if h.db == nil {
		return "", fmt.Errorf("database connection not available")
	}

	var accountID string
	err := h.db.QueryRowContext(
		ctx,
		`SELECT account_id FROM reconciliation_sessions WHERE id = $1 AND user_id = $2`,
		sessionID,
		userID,
	).Scan(&accountID)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(accountID), nil
}

func classifyReconciliationCreateError(err error) (string, string) {
	if err == nil {
		return "CREATE_TRANSACTION_FAILED", "Failed to create transaction"
	}

	message := err.Error()
	lowerMessage := strings.ToLower(message)

	if strings.Contains(lowerMessage, "currency must match account currency") {
		return "ACCOUNT_CURRENCY_MISMATCH", message
	}

	if strings.Contains(lowerMessage, "card does not have a balance in currency") {
		return "CARD_BALANCE_CURRENCY_NOT_ENABLED", message
	}

	if strings.Contains(lowerMessage, "violates foreign key constraint") {
		if strings.Contains(lowerMessage, "category") {
			return "INVALID_CATEGORY_ID", message
		}
		if strings.Contains(lowerMessage, "account") {
			return "INVALID_ACCOUNT_ID", message
		}
	}

	return "CREATE_TRANSACTION_FAILED", message
}

func (h *Handler) updateReconciliationItemAction(ctx context.Context, sessionID string, extractedTransactionID string, action string, linkedID string, createdID string) error {
	if h.db == nil {
		return fmt.Errorf("database connection not available")
	}

	_, err := h.db.ExecContext(
		ctx,
		`UPDATE reconciliation_items
		 SET action = $1,
		     linked_transaction_id = NULLIF($2, ''),
		     created_transaction_id = NULLIF($3, ''),
		     updated_at = $4
		 WHERE session_id = $5 AND extracted_transaction_id = $6`,
		action,
		linkedID,
		createdID,
		time.Now(),
		sessionID,
		extractedTransactionID,
	)
	return err
}

func (h *Handler) markReconciliationSessionApplied(ctx context.Context, sessionID string) error {
	if h.db == nil {
		return fmt.Errorf("database connection not available")
	}

	_, err := h.db.ExecContext(
		ctx,
		`UPDATE reconciliation_sessions SET status = 'applied', updated_at = $1 WHERE id = $2`,
		time.Now(),
		sessionID,
	)
	return err
}

func (h *Handler) calculateAverageMonthlySavings(ctx context.Context, userID string, accountID string) (float64, error) {
	dateTo := time.Now()
	dateFrom := dateTo.AddDate(0, -3, 0)
	transactions, err := h.transactionRepository.FindByUserAndDateRange(ctx, userID, dateFrom, dateTo)
	if err != nil {
		return 0, err
	}

	totalIncome := 0.0
	totalExpense := 0.0
	for _, txn := range transactions {
		if txn == nil {
			continue
		}
		if accountID != "" && txn.AccountId != accountID {
			continue
		}
		amount := math.Abs(txn.Amount)
		switch txn.TypeTransation {
		case "income":
			totalIncome += amount
		case "bill":
			totalExpense += amount
		}
	}

	averageMonthlySavings := (totalIncome - totalExpense) / 3
	if averageMonthlySavings < 0 {
		averageMonthlySavings = 0
	}

	return averageMonthlySavings, nil
}

func buildSavingsPlan(targetAmount float64, averageMonthlySavings float64, planningMonths int) (float64, float64, int) {
	if planningMonths <= 0 {
		planningMonths = 6
	}

	recommendedMonthly := averageMonthlySavings
	if targetAmount > 0 {
		targetByPlan := targetAmount / float64(planningMonths)
		recommendedMonthly = math.Max(targetByPlan, averageMonthlySavings)
	}

	recommendedWeekly := recommendedMonthly / 4.33
	estimatedMonths := 0
	if recommendedMonthly > 0 {
		estimatedMonths = int(math.Ceil(targetAmount / recommendedMonthly))
	}
	return recommendedMonthly, recommendedWeekly, estimatedMonths
}

func resolvePlanningMonths(targetDate string) int {
	const defaultPlanningMonths = 6

	monthsAvailable, ok := monthsUntilTargetDate(targetDate)
	if !ok {
		return defaultPlanningMonths
	}
	if monthsAvailable < 1 {
		return 1
	}

	return monthsAvailable
}

func isTargetFeasibleByDate(targetDate string, estimatedMonths int) bool {
	monthsAvailable, ok := monthsUntilTargetDate(targetDate)
	if !ok {
		return false
	}

	return estimatedMonths > 0 && estimatedMonths <= monthsAvailable
}

func monthsUntilTargetDate(targetDate string) (int, bool) {
	targetDate = strings.TrimSpace(targetDate)
	if targetDate == "" {
		return 0, false
	}

	parsedDate, err := time.Parse("2006-01-02", targetDate)
	if err != nil {
		return 0, false
	}

	monthsAvailable := int(math.Ceil(time.Until(parsedDate).Hours() / (24 * 30)))
	if monthsAvailable < 0 {
		monthsAvailable = 0
	}

	return monthsAvailable, true
}

func parseOptionalDate(value string) (sql.NullTime, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return sql.NullTime{}, nil
	}

	parsedDate, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return sql.NullTime{}, err
	}

	return sql.NullTime{Time: parsedDate, Valid: true}, nil
}

func scanSavingsGoal(scanner interface {
	Scan(dest ...interface{}) error
}) (dto.SavingsGoal, error) {
	var (
		goal       dto.SavingsGoal
		targetDate sql.NullTime
		accountID  sql.NullString
		createdAt  time.Time
		updatedAt  time.Time
	)

	err := scanner.Scan(
		&goal.ID,
		&goal.Name,
		&goal.TargetAmount,
		&goal.CurrentSaved,
		&targetDate,
		&accountID,
		&goal.Status,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return dto.SavingsGoal{}, err
	}

	goal.ProgressPct = 0
	if goal.TargetAmount > 0 {
		goal.ProgressPct = math.Min((goal.CurrentSaved/goal.TargetAmount)*100, 100)
	}
	if targetDate.Valid {
		goal.TargetDate = targetDate.Time.Format("2006-01-02")
	}
	if accountID.Valid {
		goal.AccountID = accountID.String
	}
	goal.CreatedAt = createdAt.Format(time.RFC3339)
	goal.UpdatedAt = updatedAt.Format(time.RFC3339)

	return goal, nil
}

func (h *Handler) findSavingsGoalByID(ctx context.Context, userID string, goalID string) (dto.SavingsGoal, error) {
	row := h.db.QueryRowContext(
		ctx,
		`SELECT id, name, target_amount, current_saved, target_date, account_id, status, created_at, updated_at
		 FROM savings_goals
		 WHERE id = $1 AND user_id = $2`,
		goalID,
		userID,
	)

	return scanSavingsGoal(row)
}

func (h *Handler) SuggestCategory(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.SuggestCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	categories, err := h.categoryRepository.FindAll(c.Request.Context(), userID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to fetch categories", err))
		return
	}

	categoryData := make([]tasks.CategoryData, len(categories))
	for i, cat := range categories {
		categoryData[i] = tasks.CategoryData{ID: cat.Id, Name: cat.Name}
	}

	txn := &transaction.Transaction{
		Id:             "manual-preview",
		Name:           req.Name,
		Description:    req.Description,
		Amount:         float64(req.Amount),
		TypeTransation: strings.ToLower(strings.TrimSpace(req.Type)),
		AccountId:      req.AccountID,
		Currency:       req.Currency,
		CreatedAt:      time.Now(),
	}

	suggestion := h.suggestCategoryForTransaction(c.Request.Context(), userID, txn, categoryData)
	c.JSON(http.StatusOK, dto.SuggestCategoryResponse{Success: true, Data: suggestion})
}

func (h *Handler) SuggestCategoriesBatch(c *gin.Context) {
	userID := c.GetString("X-User-Id")

	var req dto.SuggestCategoriesBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	categories, err := h.categoryRepository.FindAll(c.Request.Context(), userID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("Failed to fetch categories", err))
		return
	}

	categoryData := make([]tasks.CategoryData, len(categories))
	for i, cat := range categories {
		categoryData[i] = tasks.CategoryData{ID: cat.Id, Name: cat.Name}
	}

	items := make([]dto.CategorySuggestionItem, 0, len(req.Transactions))
	for idx, item := range req.Transactions {
		txn := &transaction.Transaction{
			Id:             fmt.Sprintf("manual-batch-%d", idx),
			Name:           item.Name,
			Description:    item.Description,
			Amount:         float64(item.Amount),
			TypeTransation: strings.ToLower(strings.TrimSpace(item.Type)),
			AccountId:      item.AccountID,
			Currency:       item.Currency,
			CreatedAt:      time.Now(),
		}
		suggestion := h.suggestCategoryForTransaction(c.Request.Context(), userID, txn, categoryData)
		items = append(items, dto.CategorySuggestionItem{Index: idx, Suggestion: suggestion})
	}

	c.JSON(http.StatusOK, dto.SuggestCategoryResponse{Success: true, Items: items})
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

func (h *Handler) suggestCategoriesForTransactions(
	ctx context.Context,
	userID string,
	transactions []*transaction.Transaction,
	categories []tasks.CategoryData,
) []dto.CategorySuggestion {
	suggestions := make([]dto.CategorySuggestion, 0)
	for _, txn := range transactions {
		if txn == nil {
			continue
		}
		suggestion := h.suggestCategoryForTransaction(ctx, userID, txn, categories)
		if suggestion != nil {
			suggestions = append(suggestions, *suggestion)
		}
	}
	return suggestions
}

func (h *Handler) suggestCategoryForTransaction(
	ctx context.Context,
	userID string,
	txn *transaction.Transaction,
	categories []tasks.CategoryData,
) *dto.CategorySuggestion {
	if txn == nil || txn.Name == "" || len(categories) == 0 {
		return nil
	}

	history, err := h.transactionRepository.FindAllOfAllAccounts(ctx, userID)
	if err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("failed to load history for category suggestion")
		return nil
	}

	categoryByID := make(map[string]string, len(categories))
	for _, cat := range categories {
		categoryByID[cat.ID] = cat.Name
	}

	type categoryStat struct {
		score      float64
		occurrence int
	}

	stats := make(map[string]*categoryStat)
	targetAmount := math.Abs(txn.Amount)

	for _, existing := range history {
		if existing == nil || existing.CategoryId == "" || existing.TypeTransation != txn.TypeTransation {
			continue
		}
		if _, ok := categoryByID[existing.CategoryId]; !ok {
			continue
		}

		nameSim := nameSimilarityScore(txn.Name+" "+txn.Description, existing.Name+" "+existing.Description)
		amountDiff := math.Abs(targetAmount - math.Abs(existing.Amount))

		entryScore := 0.0
		if nameSim >= 0.65 {
			entryScore += nameSim * 0.55
		}
		if amountDiff <= 1 {
			entryScore += 0.25
		} else if amountDiff <= 5 {
			entryScore += 0.15
		} else if amountDiff <= 20 {
			entryScore += 0.08
		}
		if txn.AccountId != "" && existing.AccountId == txn.AccountId {
			entryScore += 0.15
		}

		if entryScore < 0.25 {
			continue
		}

		if stats[existing.CategoryId] == nil {
			stats[existing.CategoryId] = &categoryStat{}
		}
		stats[existing.CategoryId].score += entryScore
		stats[existing.CategoryId].occurrence++
	}

	bestCategoryID := ""
	bestScore := 0.0
	bestOccurrence := 0

	for categoryID, stat := range stats {
		if stat == nil {
			continue
		}
		adjusted := stat.score + math.Min(float64(stat.occurrence)*0.05, 0.2)
		if adjusted > bestScore {
			bestScore = adjusted
			bestCategoryID = categoryID
			bestOccurrence = stat.occurrence
		}
	}

	if bestCategoryID == "" {
		fallbackID, fallbackScore := suggestCategoryByName(txn.Name+" "+txn.Description, categories)
		if fallbackID == "" {
			return nil
		}
		return &dto.CategorySuggestion{
			TransactionID:   txn.Id,
			CategoryID:      fallbackID,
			CategoryName:    categoryByID[fallbackID],
			NewCategoryName: suggestSpecificCategoryName(txn.Name, txn.Description, categoryByID[fallbackID]),
			Confidence:      scoreToConfidence(fallbackScore),
			Score:           fallbackScore,
			Reason:          "match by category name keywords",
		}
	}

	finalScore := math.Min(bestScore, 0.99)
	return &dto.CategorySuggestion{
		TransactionID:   txn.Id,
		CategoryID:      bestCategoryID,
		CategoryName:    categoryByID[bestCategoryID],
		NewCategoryName: suggestSpecificCategoryName(txn.Name, txn.Description, categoryByID[bestCategoryID]),
		Confidence:      scoreToConfidence(finalScore),
		Score:           finalScore,
		Reason:          fmt.Sprintf("based on %d similar transaction(s)", bestOccurrence),
	}
}

func suggestSpecificCategoryName(name string, description string, baseCategoryName string) string {
	merchant := extractMerchantName(name, description)
	if merchant == "" {
		merchant = "General"
	}

	base := strings.TrimSpace(baseCategoryName)
	if base == "" {
		return merchant
	}

	if strings.EqualFold(base, merchant) {
		return merchant
	}

	return fmt.Sprintf("%s - %s", base, merchant)
}

func extractMerchantName(name string, description string) string {
	source := strings.TrimSpace(name)
	if source == "" {
		source = strings.TrimSpace(description)
	}
	normalized := normalizeName(source)
	if normalized == "" {
		return ""
	}

	stopwords := map[string]struct{}{
		"pago": {}, "payment": {}, "factura": {}, "bill": {}, "compra": {}, "purchase": {},
		"debito": {}, "credito": {}, "card": {}, "tarjeta": {}, "transaccion": {}, "transaction": {},
		"online": {}, "pos": {}, "ref": {}, "reference": {},
	}

	parts := strings.Fields(normalized)
	kept := make([]string, 0, 3)
	for _, part := range parts {
		if len(kept) >= 3 {
			break
		}
		if _, isStopword := stopwords[part]; isStopword {
			continue
		}
		if len(part) <= 1 {
			continue
		}
		kept = append(kept, titleToken(part))
	}

	if len(kept) == 0 {
		return titleToken(parts[0])
	}

	return strings.Join(kept, " ")
}

func titleToken(value string) string {
	if value == "" {
		return ""
	}
	runes := []rune(value)
	runes[0] = unicode.ToUpper(runes[0])
	for i := 1; i < len(runes); i++ {
		runes[i] = unicode.ToLower(runes[i])
	}
	return string(runes)
}

func suggestCategoryByName(text string, categories []tasks.CategoryData) (string, float64) {
	normalized := normalizeName(text)
	if normalized == "" {
		return "", 0
	}

	bestID := ""
	bestScore := 0.0
	for _, cat := range categories {
		similarity := nameSimilarityScore(normalized, cat.Name)
		if strings.Contains(normalized, normalizeName(cat.Name)) {
			similarity = math.Max(similarity, 0.75)
		}
		if similarity > bestScore {
			bestScore = similarity
			bestID = cat.ID
		}
	}

	if bestScore < 0.6 {
		return "", 0
	}

	return bestID, math.Min(bestScore, 0.85)
}

func scoreToConfidence(score float64) string {
	if score >= 0.85 {
		return "high"
	}
	if score >= 0.65 {
		return "medium"
	}
	return "low"
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
