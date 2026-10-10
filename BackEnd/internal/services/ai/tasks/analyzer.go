package tasks

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"
	"time"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
)

//go:embed prompts/spending_analysis.tmpl
var spendingAnalysisPrompt string

type AnalyzerInput struct {
	DateFrom      string
	DateTo        string
	Days          int
	TotalExpenses money.Amount
	TotalIncome   money.Amount
	NetSavings    money.Amount
	// SavingsRate is a display-only percentage for the prompt.
	SavingsRate       float64
	CategoryBreakdown []CategoryBreakdownInput
	Transactions      []TransactionInput
	TransactionCount  int
	Language          string
}

type CategoryBreakdownInput struct {
	Category string
	Amount   money.Amount
	// Percentage is a display-only share of expenses for the prompt.
	Percentage float64
}

type TransactionInput struct {
	Date        string
	Type        string
	Category    string
	Description string
	Amount      money.Amount
}

type SpendingAnalyzer struct {
	template *template.Template
}

func NewSpendingAnalyzer() (*SpendingAnalyzer, error) {
	tmpl, err := template.New("spending_analysis").Parse(spendingAnalysisPrompt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse prompt template: %w", err)
	}

	return &SpendingAnalyzer{
		template: tmpl,
	}, nil
}

func (a *SpendingAnalyzer) GetType() domain.AITaskType {
	return domain.TaskSpendingAnalysis
}

func (a *SpendingAnalyzer) ValidateInput(input interface{}) error {
	_, ok := input.(*AnalyzerInput)
	if !ok {
		return domain.ErrInvalidInput
	}
	return nil
}

func (a *SpendingAnalyzer) BuildPrompt(input interface{}) (string, error) {
	inp, ok := input.(*AnalyzerInput)
	if !ok {
		return "", domain.ErrInvalidInput
	}

	var buf strings.Builder
	if err := a.template.Execute(&buf, inp); err != nil {
		return "", fmt.Errorf("failed to render prompt template: %w", err)
	}

	return buf.String(), nil
}

func (a *SpendingAnalyzer) ParseResponse(rawJSON string) (interface{}, error) {
	var insights dto.SpendingInsights

	cleaned := cleanJSONResponse(rawJSON)
	if err := json.Unmarshal([]byte(cleaned), &insights); err != nil {
		return nil, fmt.Errorf("%w: %v", domain.ErrInvalidJSON, err)
	}
	insights.RoundAmounts()

	return insights, nil
}

func PrepareAnalyzerInput(transactions []*transaction.Transaction, dateFrom, dateTo time.Time) *AnalyzerInput {
	totalExpenses := money.Zero
	totalIncome := money.Zero
	categoryTotals := make(map[string]money.Amount)

	txnInputs := make([]TransactionInput, 0, len(transactions))
	for _, txn := range transactions {
		amount := txn.Amount.Abs()

		category := getCategoryName(txn.CategoryId)

		if txn.TypeTransation == "bill" {
			totalExpenses = totalExpenses.Add(amount)
			categoryTotals[category] = categoryTotals[category].Add(amount)
		} else {
			totalIncome = totalIncome.Add(amount)
		}

		txnInputs = append(txnInputs, TransactionInput{
			Date:        txn.CreatedAt.Format("2006-01-02"),
			Type:        txn.TypeTransation,
			Category:    category,
			Description: txn.Name,
			Amount:      amount,
		})
	}

	categoryBreakdown := make([]CategoryBreakdownInput, 0)
	for cat, amount := range categoryTotals {
		percentage := money.Percent(amount, totalExpenses)
		categoryBreakdown = append(categoryBreakdown, CategoryBreakdownInput{
			Category:   cat,
			Amount:     amount,
			Percentage: percentage,
		})
	}

	netSavings := totalIncome.Sub(totalExpenses)
	savingsRate := 0.0
	if totalIncome.IsPositive() {
		savingsRate = money.Percent(netSavings, totalIncome)
	}

	days := int(dateTo.Sub(dateFrom).Hours() / 24)
	if days < 1 {
		days = 1
	}

	return &AnalyzerInput{
		DateFrom:          dateFrom.Format("2006-01-02"),
		DateTo:            dateTo.Format("2006-01-02"),
		Days:              days,
		TotalExpenses:     totalExpenses,
		TotalIncome:       totalIncome,
		NetSavings:        netSavings,
		SavingsRate:       savingsRate,
		CategoryBreakdown: categoryBreakdown,
		Transactions:      txnInputs,
		TransactionCount:  len(transactions),
	}
}

func getCategoryName(categoryId string) string {
	if categoryId == "" {
		return "Uncategorized"
	}
	return categoryId
}

func cleanJSONResponse(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	return strings.TrimSpace(raw)
}
