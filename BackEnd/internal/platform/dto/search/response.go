package search

import (
	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
)

type SearchLoanItem struct {
	ID            string  `json:"id"`
	BorrowerName  string  `json:"borrower_name"`
	PendingAmount float64 `json:"pending_amount"`
	TotalAmount   float64 `json:"total_amount"`
	Currency      string  `json:"currency"`
	Status        string  `json:"status"`
}

type SearchCertificateItem struct {
	ID          string  `json:"id"`
	Bank        string  `json:"bank"`
	BaseCapital float64 `json:"base_capital"`
	Currency    string  `json:"currency"`
	Status      string  `json:"status"`
}

type SearchResponse struct {
	Transactions []*transaction.Transaction `json:"transactions"`
	Categories   []*category.Category       `json:"categories"`
	Accounts     []*account.Account         `json:"accounts"`
	Budgets      []*budget.Budget           `json:"budgets"`
	Loans        []*SearchLoanItem          `json:"loans"`
	Certificates []*SearchCertificateItem   `json:"certificates"`
}
