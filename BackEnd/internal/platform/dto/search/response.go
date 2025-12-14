package search

import (
	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
)

type SearchResponse struct {
	Transactions []*transaction.Transaction `json:"transactions"`
	Categories   []*category.Category       `json:"categories"`
	Accounts     []*account.Account         `json:"accounts"`
	Budgets      []*budget.Budget           `json:"budgets"`
}
