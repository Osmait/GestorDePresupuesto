package transaction

import (
	"context"
	"fmt"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	trasanctionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/segmentio/ksuid"
)

const (
	BILL = "bill"
)

type TransactionService struct {
	transactionRepository trasanctionRepo.TransactionRepsitoryinterface
}

func NewTransactionService(transactionRepository trasanctionRepo.TransactionRepsitoryinterface) *TransactionService {
	return &TransactionService{
		transactionRepository: transactionRepository,
	}
}

func (s TransactionService) CreateTransaction(ctx context.Context, name, descrpition string, amount float64, typeTransaction string, accountId string, userId string, categoryId string, budgetId string) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	id := uuid.String()
	if typeTransaction == BILL {
		amount = amount * -1
	}

	transaction := transaction.NewTransaction(id, name, descrpition, typeTransaction, accountId, categoryId, amount)
	transaction.UserId = userId

	if budgetId != "" {
		transaction.BudgetId = budgetId
	}
	fmt.Println("transaction", transaction.CategoryId)

	err = s.transactionRepository.Save(ctx, transaction)

	return err
}

func (s TransactionService) FindAll(ctx context.Context, date string, date2 string, id string) ([]*dto.TransactionResponse, error) {
	transactionList, err := s.transactionRepository.FindAll(ctx, date, date2, id)
	if err != nil {
		return nil, err
	}

	var trasanctionResponseList []*dto.TransactionResponse
	for _, transaction := range transactionList {
		transactionResponse := dto.NewTransactionResponse(transaction.Id,
			transaction.Name,
			transaction.Description,
			transaction.TypeTransation,
			transaction.AccountId,
			transaction.CategoryId,
			transaction.Amount,
			transaction.CreatedAt)
		transactionResponse.BudgetId = transaction.BudgetId
		trasanctionResponseList = append(trasanctionResponseList, transactionResponse)

	}
	fmt.Println("trasanctionResponseList", trasanctionResponseList)

	return trasanctionResponseList, nil
}

func (s TransactionService) FindAllOfAllAccounts(ctx context.Context, date string, date2 string, id string) ([]*dto.TransactionResponse, error) {
	transactionList, err := s.transactionRepository.FindAllOfAllAccounts(ctx, date, date2, id)
	if err != nil {
		return nil, err
	}

	var trasanctionResponseList []*dto.TransactionResponse
	for _, transaction := range transactionList {
		transactionResponse := dto.NewTransactionResponse(transaction.Id,
			transaction.Name,
			transaction.Description,
			transaction.TypeTransation,
			transaction.AccountId,
			transaction.CategoryId,
			transaction.Amount,
			transaction.CreatedAt)
		transactionResponse.BudgetId = transaction.BudgetId
		trasanctionResponseList = append(trasanctionResponseList, transactionResponse)

	}

	return trasanctionResponseList, nil
}

func (s TransactionService) DeleteTransaction(ctx context.Context, id string) error {
	err := s.transactionRepository.Delete(ctx, id)
	return err
}
