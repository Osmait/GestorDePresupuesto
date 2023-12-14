package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
)

type TransactionRepsitoryinterface interface {
	Save(ctx context.Context, transaction *transaction.Transaction) error
	FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error)
	Delete(ctx context.Context, id string) error
}
