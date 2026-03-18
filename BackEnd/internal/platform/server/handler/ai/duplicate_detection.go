package ai

import (
	"context"
	"math"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
	"github.com/rs/zerolog/log"
)

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
				Amount:         existingTxn.Amount,
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

	extractedAmount := extracted.Amount
	existingAmount := existing.Amount
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
