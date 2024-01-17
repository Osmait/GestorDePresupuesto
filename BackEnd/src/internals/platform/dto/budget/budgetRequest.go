package dto

type BudgetRequest struct {
	CategoryId string  `json:"category_id"`
	Amount     float64 `json:"amount"`
}

func NewBudgetRequest(categoryId string, amount float64) *BudgetRequest {
	return &BudgetRequest{
		CategoryId: categoryId,
		Amount:     amount,
	}
}
