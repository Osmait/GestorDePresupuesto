package budget

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/budget"
	dto "github.com/osmait/gestorDePresupuesto/src/internals/platform/dto/budget"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/errorhttp"
	"github.com/segmentio/ksuid"
)

type BudgetServices struct {
	repository      postgress.BudgetRepoInterface
	transactionRepo postgress.TransactionRepsitoryinterface
}

func NewBudgetServices(repo postgress.BudgetRepoInterface, trasanctionRepo postgress.TransactionRepsitoryinterface) *BudgetServices {
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
