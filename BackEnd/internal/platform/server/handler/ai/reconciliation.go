package ai

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

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

			amount := tx.Amount
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
