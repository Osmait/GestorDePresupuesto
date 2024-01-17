package dto

type BudgetRequest struct {
	CategoryId    string  `json:"category_id"`
	Amount        float64 `json:"amount"`
	CurrentAmount float64 `json:"current_amount"`
}

func NewBudgetRequest(categoryId string, amount, curentAmount float64) *BudgetRequest {
	return &BudgetRequest{
		CategoryId:    categoryId,
		Amount:        amount,
		CurrentAmount: curentAmount,
	}
}
