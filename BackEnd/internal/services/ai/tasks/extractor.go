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
	"github.com/segmentio/ksuid"
)

//go:embed prompts/transaction_extraction.tmpl
var transactionExtractionPrompt string

type ExtractorInput struct {
	DocumentType    string         `json:"document_type"`
	AccountID       string         `json:"account_id"`
	AccountCurrency string         `json:"account_currency"`
	Categories      []CategoryData `json:"categories"`
	Language        string         `json:"language"`
}

type CategoryData struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type TransactionExtractor struct {
	template *template.Template
}

func NewTransactionExtractor() (*TransactionExtractor, error) {
	tmpl, err := template.New("transaction_extraction").Parse(transactionExtractionPrompt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse prompt template: %w", err)
	}

	return &TransactionExtractor{
		template: tmpl,
	}, nil
}

func (e *TransactionExtractor) GetType() domain.AITaskType {
	return domain.TaskExtractTransactions
}

func (e *TransactionExtractor) ValidateInput(input interface{}) error {
	inp, ok := input.(*ExtractorInput)
	if !ok {
		return domain.ErrInvalidInput
	}

	if inp.AccountID == "" {
		return fmt.Errorf("account_id is required")
	}

	validTypes := map[string]bool{
		"receipt":   true,
		"statement": true,
		"invoice":   true,
	}

	if !validTypes[inp.DocumentType] {
		return fmt.Errorf("invalid document_type: %s (must be receipt, statement, or invoice)", inp.DocumentType)
	}

	return nil
}

func (e *TransactionExtractor) BuildPrompt(input interface{}) (string, error) {
	inp, ok := input.(*ExtractorInput)
	if !ok {
		return "", domain.ErrInvalidInput
	}

	language := inp.Language
	if language == "" {
		language = "es"
	}

	data := map[string]interface{}{
		"DocumentType":    inp.DocumentType,
		"AccountID":       inp.AccountID,
		"AccountCurrency": strings.ToUpper(strings.TrimSpace(inp.AccountCurrency)),
		"IsStatement":     inp.DocumentType == "statement",
		"Categories":      inp.Categories,
		"Timestamp":       time.Now().Unix(),
		"Language":        language,
	}

	var buf strings.Builder
	if err := e.template.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to render prompt template: %w", err)
	}

	return buf.String(), nil
}

func (e *TransactionExtractor) ParseResponse(rawJSON string) (interface{}, error) {
	var transactions []*transaction.Transaction

	if err := json.Unmarshal([]byte(rawJSON), &transactions); err != nil {
		return nil, fmt.Errorf("%w: %v", domain.ErrInvalidJSON, err)
	}

	for i, txn := range transactions {
		if txn.Id == "" {
			id, err := ksuid.NewRandom()
			if err != nil {
				return nil, fmt.Errorf("failed to generate transaction ID: %w", err)
			}
			txn.Id = "ai-" + id.String()
		}

		if txn.CreatedAt.IsZero() {
			txn.CreatedAt = time.Now()
		}

		txn.TypeTransation = strings.ToLower(txn.TypeTransation)
		if txn.TypeTransation != "income" && txn.TypeTransation != "bill" {
			txn.TypeTransation = "bill"
		}

		if txn.Amount < 0 {
			txn.Amount = -txn.Amount
		}

		txn.Currency = normalizeCurrency(txn.Currency)

		transactions[i] = txn
	}

	return transactions, nil
}

func normalizeCurrency(currency string) string {
	value := strings.ToUpper(strings.TrimSpace(currency))
	value = strings.ReplaceAll(value, "$", "")
	value = strings.ReplaceAll(value, " ", "")

	switch value {
	case "USD", "US", "US$", "DOLLAR", "DOLLARS":
		return "USD"
	case "DOP", "RD", "RD$", "PESO", "PESODOMINICANO", "PESODOMINICANOS":
		return "DOP"
	default:
		return "DOP"
	}
}
