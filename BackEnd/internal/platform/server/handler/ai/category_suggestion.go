package ai

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/ai/tasks"
	"github.com/rs/zerolog/log"
)

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
