package budget

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/budget"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/segmentio/ksuid"
)

// BudgetServices handles business logic related to budget management.
type BudgetServices struct {
	repository      budgetRepo.BudgetRepoInterface
	transactionRepo transactionRepo.TransactionRepositoryInterface
	usdToDopRateFn  func(context.Context) (money.Amount, error)
}

// NewBudgetServices creates a new instance of BudgetServices.
func NewBudgetServices(repo budgetRepo.BudgetRepoInterface, transactionRepo transactionRepo.TransactionRepositoryInterface, usdToDopRateFn func(context.Context) (money.Amount, error)) *BudgetServices {
	return &BudgetServices{
		repository:      repo,
		transactionRepo: transactionRepo,
		usdToDopRateFn:  usdToDopRateFn,
	}
}

// CreateBudget creates a new budget for a user.
func (b *BudgetServices) CreateBudget(ctx context.Context, budgetRequest *dto.BudgetRequest, userId string) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	id := uuid.String()

	budgetToSave := budget.NewBudget(id, budgetRequest.CategoryId, userId, budgetRequest.Amount)

	err = b.repository.Save(ctx, budgetToSave)
	return err
}

// UpdateBudget modifies an existing budget details.
func (b *BudgetServices) UpdateBudget(ctx context.Context, budgetRequest *dto.BudgetRequest, id string, userId string) error {
	budgetToUpdate := budget.NewBudget(id, budgetRequest.CategoryId, userId, budgetRequest.Amount)
	return b.repository.Update(ctx, budgetToUpdate)
}

// FindAll retrieves all budgets for a user, including current spending progress.
func (b *BudgetServices) FindAll(ctx context.Context, userId string) ([]*dto.BudgetResponse, error) {
	budgets, err := b.repository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	usdToDop := money.FromInt(60)
	if b.usdToDopRateFn != nil {
		if rate, rateErr := b.usdToDopRateFn(ctx); rateErr == nil && rate.IsPositive() {
			usdToDop = rate
		}
	}

	// Spending is by category and current local month, not by the budget_id
	// stamped on the bills: a budget sees its category's bills of the month
	// even if they were written before it existed (or before it was
	// re-pointed to the category). Budgets sharing a category show the same
	// spending.
	spentByCategory, err := b.transactionRepo.FindCurrentSpentByCategory(ctx, userId, usdToDop)
	if err != nil {
		return nil, err
	}

	budgetResponses := make([]*dto.BudgetResponse, 0)
	for _, budget := range budgets {
		currentAmount := spentByCategory[budget.CategoryId].RoundCents()
		budgetResponse := dto.NewBudgetReponse(budget.Id, budget.CategoryId, budget.UserId, budget.Amount, currentAmount, budget.CreatedAt)
		budgetResponses = append(budgetResponses, budgetResponse)
	}

	return budgetResponses, nil
}

// Delete removes a budget by its ID and User ID.
func (b *BudgetServices) Delete(ctx context.Context, id string, userId string) error {
	// The repository scopes the delete to userId and reports a missing or
	// foreign budget as not found.
	return b.repository.Delete(ctx, id, userId)
}
