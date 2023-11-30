package account

import (
	"context"
	"fmt"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"

	"github.com/segmentio/ksuid"
)

type AccountService struct {
	accountRepository postgress.Repository
}

func NewAccountService(accountRepository postgress.Repository) *AccountService {
	return &AccountService{
		accountRepository: accountRepository,
	}
}

func (s AccountService) CreateAccount(ctx context.Context, id, name, bank string, balace float64) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	id = uuid.String()

	account := account.NewAccount(balace, id, name, bank)
	err = s.accountRepository.Save(ctx, *account)

	return err
}

func (s AccountService) FindAll(ctx context.Context) ([]*account.Account, error) {
	accounts, err := s.accountRepository.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	fmt.Println("hello")
	return accounts, nil
}

func (s AccountService) DeleteAccount(ctx context.Context, id string) error {
	err := s.accountRepository.Delete(ctx, id)
	return err
}

func (s AccountService) Balance(ctx context.Context, id string) (float64, error) {
	balance, err := s.accountRepository.Balance(ctx, id)
	fmt.Println(balance)

	if err != nil {
		return 0, err
	}
	return balance, nil
}
