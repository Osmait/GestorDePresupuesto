package dto

type TransactionRequest struct {
	Name           string  `json:"name" validate:"required"`
	Description    string  `json:"description"`
	Amount         float64 `json:"amount" validate:"required"`
	TypeTransation string  `json:"type_transation" validator:"required"`
	AccountId      string  `json:"account_id"`
	CategoryId     string  `json:"category_id"`
	BudgetId       string  `json:"budget_id"`
}

func NewTransactionRequest(Id, Name, Description, TypeTransation, AccountId, categoryId, budgetId string, Amount float64) *TransactionRequest {
	return &TransactionRequest{
		Name:           Name,
		Description:    Description,
		Amount:         Amount,
		TypeTransation: TypeTransation,
		AccountId:      AccountId,
		CategoryId:     categoryId,
		BudgetId:       budgetId,
	}
}
