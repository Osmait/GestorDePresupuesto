package tasks

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"
	"time"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/ai"
)

//go:embed prompts/spending_analysis.tmpl
var spendingAnalysisPrompt string

type AnalyzerInput struct {
	DateFrom          string
	DateTo            string
	Days              int
	TotalExpenses     float64
	TotalIncome       float64
	NetSavings        float64
	SavingsRate       float64
	CategoryBreakdown []CategoryBreakdownInput
	Transactions      []TransactionInput
	TransactionCount  int
	Language          string
}

type CategoryBreakdownInput struct {
	Category   string
	Amount     float64
	Percentage float64
}

type TransactionInput struct {
	Date        string
	Type        string
	Category    string
	Description string
	Amount      float64
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

	return insights, nil
}

func PrepareAnalyzerInput(transactions []*transaction.Transaction, dateFrom, dateTo time.Time) *AnalyzerInput {
	totalExpenses := 0.0
	totalIncome := 0.0
	categoryTotals := make(map[string]float64)

	txnInputs := make([]TransactionInput, 0, len(transactions))
	for _, txn := range transactions {
		amount := txn.Amount
		if amount < 0 {
			amount = -amount
		}

		category := getCategoryName(txn.CategoryId)

		if txn.TypeTransation == "bill" {
			totalExpenses += amount
			categoryTotals[category] += amount
		} else {
			totalIncome += amount
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
		percentage := 0.0
		if totalExpenses > 0 {
			percentage = (amount / totalExpenses) * 100
		}
		categoryBreakdown = append(categoryBreakdown, CategoryBreakdownInput{
			Category:   cat,
			Amount:     amount,
			Percentage: percentage,
		})
	}

	netSavings := totalIncome - totalExpenses
	savingsRate := 0.0
	if totalIncome > 0 {
		savingsRate = (netSavings / totalIncome) * 100
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
