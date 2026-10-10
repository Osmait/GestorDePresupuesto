package dto

import "github.com/osmait/gestorDePresupuesto/internal/domain/money"

type ExtractRequest struct {
	AccountID       string `json:"account_id" binding:"required"`
	AccountCurrency string `json:"account_currency"`
	DocumentType    string `json:"document_type" binding:"required,oneof=receipt statement invoice"`
	Language        string `json:"language"`
	Files           []struct {
		Filename    string `json:"filename" binding:"required"`
		ContentType string `json:"content_type" binding:"required"`
		Base64Data  string `json:"base64_data" binding:"required"`
	} `json:"files" binding:"required,min=1,max=5,dive"`
}

func (r *ExtractRequest) Validate() error {
	return nil
}

type AnalyzeSpendingRequest struct {
	DateFrom string `json:"date_from" binding:"required"`
	DateTo   string `json:"date_to" binding:"required"`
	Language string `json:"language"`
}

func (r *AnalyzeSpendingRequest) Validate() error {
	return nil
}

type SuggestCategoryRequest struct {
	Name        string       `json:"name" binding:"required"`
	Description string       `json:"description"`
	Amount      money.Amount `json:"amount" binding:"required"`
	Type        string       `json:"type_transation" binding:"required,oneof=income bill"`
	AccountID   string       `json:"account_id" binding:"required"`
	Currency    string       `json:"currency"`
}

type SuggestCategoriesBatchRequest struct {
	Transactions []SuggestCategoryRequest `json:"transactions" binding:"required,min=1,max=100,dive"`
}

type ReconciliationPreviewRequest struct {
	AccountID       string `json:"account_id" binding:"required"`
	AccountCurrency string `json:"account_currency"`
	DocumentType    string `json:"document_type" binding:"required,oneof=receipt statement invoice"`
	Language        string `json:"language"`
	Files           []struct {
		Filename    string `json:"filename" binding:"required"`
		ContentType string `json:"content_type" binding:"required"`
		Base64Data  string `json:"base64_data" binding:"required"`
	} `json:"files" binding:"required,min=1,max=5,dive"`
}

type SavingsPlanRequest struct {
	TargetAmount money.Amount `json:"target_amount" binding:"required,gt=0"`
	TargetDate   string       `json:"target_date"`
	AccountID    string       `json:"account_id"`
}

type ReconciliationApplyRequest struct {
	Actions []ReconciliationAction `json:"actions" binding:"required,min=1,dive"`
}

type ReconciliationAction struct {
	ExtractedTransactionID string `json:"extracted_transaction_id" binding:"required"`
	Action                 string `json:"action" binding:"required,oneof=create link ignore"`
	LinkedTransactionID    string `json:"linked_transaction_id"`
	CategoryID             string `json:"category_id"`
}

type CreateSavingsGoalRequest struct {
	Name         string       `json:"name" binding:"required,min=2,max=120"`
	TargetAmount money.Amount `json:"target_amount" binding:"required,gt=0"`
	TargetDate   string       `json:"target_date"`
	AccountID    string       `json:"account_id"`
	CurrentSaved money.Amount `json:"current_saved"`
}

type UpdateSavingsGoalRequest struct {
	Name         string       `json:"name"`
	TargetAmount money.Amount `json:"target_amount"`
	TargetDate   string       `json:"target_date"`
	AccountID    string       `json:"account_id"`
	CurrentSaved money.Amount `json:"current_saved"`
	Status       string       `json:"status"`
}
