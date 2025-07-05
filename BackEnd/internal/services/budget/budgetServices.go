package budget

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/budget"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	trasanctionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/segmentio/ksuid"
)

type BudgetServices struct {
	repository      budgetRepo.BudgetRepoInterface
	transactionRepo trasanctionRepo.TransactionRepsitoryinterface
}

func NewBudgetServices(repo budgetRepo.BudgetRepoInterface, trasanctionRepo trasanctionRepo.TransactionRepsitoryinterface) *BudgetServices {
	return &BudgetServices{
		repository:      repo,
		transactionRepo: trasanctionRepo,
	}
}

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

func (b *BudgetServices) FindAll(ctx context.Context, userId string) ([]*dto.BudgetResponse, error) {
	budgets, err := b.repository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	var budgetResponses []*dto.BudgetResponse
	for _, budget := range budgets {
		currentAmount, err := b.transactionRepo.FindCurrentBudget(ctx, budget.Id)
		if err != nil {
			return nil, err
		}
		budgetResponse := dto.NewBudgetReponse(budget.Id, budget.CategoryId, budget.UserId, budget.Amount, currentAmount, budget.CreatedAt)
		budgetResponses = append(budgetResponses, budgetResponse)
	}

	return budgetResponses, nil
}

func (b *BudgetServices) Delete(ctx context.Context, id string) error {
	budgets, err := b.repository.FindOne(ctx, id)
	if err != nil {
		return err
	}
	if budgets.Id != id {
		return errorhttp.ErrNotFound
	}
	err = b.repository.Delete(ctx, id)
	return err
}
