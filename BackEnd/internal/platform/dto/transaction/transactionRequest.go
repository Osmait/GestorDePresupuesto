package dto

type TransactionRequest struct {
	Name           string  `json:"name" validate:"required" example:"Grocery Shopping"`
	Description    string  `json:"description" example:"Weekly grocery shopping at Walmart"`
	Amount         float64 `json:"amount" validate:"required" example:"125.50"`
	TypeTransation string  `json:"type_transation" validator:"required" example:"expense" enums:"income,expense"`
	AccountId      string  `json:"account_id" example:"acc_123456789"`
	CategoryId     string  `json:"category_id" example:"cat_987654321"`
	BudgetId       string  `json:"budget_id" example:"budget_555666777"`
}

func NewTransactionRequest(Name, Description, TypeTransation, AccountId, categoryId, budgetId string, Amount float64) *TransactionRequest {
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
