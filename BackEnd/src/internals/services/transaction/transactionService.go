package transaction

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"

	"github.com/segmentio/ksuid"
)

const (
	BILL = "bill"
)

type TransactionService struct {
	transactionRepository postgress.TransactionRepsitoryinterface
}

func NewTransactionService(transactionRepository postgress.TransactionRepsitoryinterface) *TransactionService {
	return &TransactionService{
		transactionRepository: transactionRepository,
	}
}

func (s TransactionService) CreateTransaction(ctx context.Context, name, descrpition string, amount float64, typeTransaction string, accountId string, userId string, categoryId string) error {
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

	err = s.transactionRepository.Save(ctx, transaction)

	return err
}

func (s TransactionService) FindAll(ctx context.Context, date string, date2 string, id string) ([]*transaction.Transaction, error) {
	transaction, err := s.transactionRepository.FindAll(ctx, date, date2, id)
	if err != nil {
		return nil, err
	}

	return transaction, nil
}

func (s TransactionService) FindAllOfAllAccounts(ctx context.Context, date string, date2 string, id string) ([]*transaction.Transaction, error) {
	accounts, err := s.transactionRepository.FindAllOfAllAccounts(ctx, date, date2, id)
	if err != nil {
		return nil, err
	}

	return accounts, nil
}

func (s TransactionService) DeleteTransaction(ctx context.Context, id string) error {
	err := s.transactionRepository.Delete(ctx, id)
	return err
}
