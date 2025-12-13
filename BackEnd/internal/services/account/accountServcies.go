package account

import (
	"context"
	"database/sql"
	"errors"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/account"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"

	"github.com/segmentio/ksuid"
)

type AccountService struct {
	accountRepository accountRepo.AccountRepositoryInterface
}

func NewAccountService(accountRepository accountRepo.AccountRepositoryInterface) *AccountService {
	return &AccountService{
		accountRepository: accountRepository,
	}
}

func (s *AccountService) CreateAccount(ctx context.Context, name, bank string, balace float64, userId string) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	id := uuid.String()

	account := account.NewAccount(balace, id, name, bank)
	account.UserId = userId
	err = s.accountRepository.Save(ctx, account)

	return err
}

func (s *AccountService) FindAll(ctx context.Context, userId string) ([]*dto.AccountResponse, error) {
	accounts, err := s.accountRepository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	balances, err := s.accountRepository.Balances(ctx, userId)
	if err != nil {
		return nil, err
	}
	var accountResponses []*dto.AccountResponse

	for _, account := range accounts {
		balance := balances[account.Id]
		accountResponse := dto.NewAccountResponse(account, balance+account.InitialBalance)
		accountResponses = append(accountResponses, accountResponse)
	}

	return accountResponses, nil
}

func (s *AccountService) DeleteAccount(ctx context.Context, id string, userId string) error {
	err := s.accountRepository.Delete(ctx, id, userId)
	return err
}

func (s *AccountService) Balance(ctx context.Context, id string) (float64, error) {
	balance, err := s.accountRepository.Balance(ctx, id)
	if err != nil {
		return 0, err
	}
	return balance, nil
}

func (s *AccountService) UpdateAccount(ctx context.Context, id string, updateRequest *dto.AccountUpdateRequest, userId string) error {
	// First validate the request
	if err := updateRequest.Validate(); err != nil {
		return errorhttp.ErrBadRequest
	}

	// Check if account exists and belongs to the user
	_, err := s.accountRepository.FindByIdAndUserId(ctx, id, userId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errorhttp.ErrNotFound
		}
		return err
	}

	// Update the account
	err = s.accountRepository.Update(ctx, id, updateRequest.Name, updateRequest.Bank, userId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errorhttp.ErrNotFound
		}
		return err
	}

	return nil
}
