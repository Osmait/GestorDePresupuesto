package transaction

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"

	"github.com/segmentio/ksuid"
)

type TransactionService struct {
	transactionRepository postgress.TransactionRepsitoryinterface
}

func NewTransactionService(transactionRepository postgress.TransactionRepsitoryinterface) *TransactionService {
	return &TransactionService{
		transactionRepository: transactionRepository,
	}
}

func (s TransactionService) CreateTransaction(ctx context.Context, id, name, descrpition string, amount float64, typeTransaction string, accountId string) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	id = uuid.String()
	if typeTransaction == "bill" {
		amount = amount * -1
	}

	transaction := transaction.NewTransaction(id, name, descrpition, typeTransaction, accountId, amount)

	err = s.transactionRepository.Save(ctx, transaction)

	return err
}

func (s TransactionService) FindAll(ctx context.Context, date string, date2 string, id string) ([]*transaction.Transaction, error) {
	accounts, err := s.transactionRepository.FindAll(ctx, date, date2, id)
	if err != nil {
		return nil, err
	}

	return accounts, nil
}

func (s TransactionService) DeleteTransaction(ctx context.Context, id string) error {
	err := s.transactionRepository.Delete(ctx, id)
	return err
}
