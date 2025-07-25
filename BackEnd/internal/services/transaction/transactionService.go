package transaction

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

const (
	BILL = "bill"
)

type TransactionService struct {
	transactionRepository transactionRepo.TransactionRepositoryInterface
}

func NewTransactionService(transactionRepository transactionRepo.TransactionRepositoryInterface) *TransactionService {
	return &TransactionService{
		transactionRepository: transactionRepository,
	}
}

func (s TransactionService) CreateTransaction(ctx context.Context, name, description string, amount float64, typeTransaction string, accountId string, userId string, categoryId string, budgetId string) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	id := uuid.String()
	if typeTransaction == BILL {
		amount = amount * -1
	}

	transaction := transaction.NewTransaction(id, name, description, typeTransaction, accountId, categoryId, amount)
	transaction.UserId = userId

	if budgetId != "" {
		transaction.BudgetId = budgetId
	}
	log.Debug().Str("category_id", transaction.CategoryId).Msg("creating transaction")

	err = s.transactionRepository.Save(ctx, transaction)

	return err
}

func (s TransactionService) FindAll(ctx context.Context, date string, date2 string, id string) ([]*dto.TransactionResponse, error) {
	transactionList, err := s.transactionRepository.FindAll(ctx, date, date2, id)
	if err != nil {
		return nil, err
	}

	var transactionResponseList []*dto.TransactionResponse
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
		transactionResponseList = append(transactionResponseList, transactionResponse)

	}

	log.Debug().Int("count", len(transactionResponseList)).Msg("found transactions")
	return transactionResponseList, nil
}

func (s TransactionService) FindAllOfAllAccounts(ctx context.Context, id string) ([]*dto.TransactionResponse, error) {
	transactionList, err := s.transactionRepository.FindAllOfAllAccounts(ctx, id)
	if err != nil {
		return nil, err
	}

	var transactionResponseList []*dto.TransactionResponse
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
		transactionResponseList = append(transactionResponseList, transactionResponse)

	}

	return transactionResponseList, nil
}

func (s TransactionService) DeleteTransaction(ctx context.Context, id string) error {
	err := s.transactionRepository.Delete(ctx, id)
	return err
}
