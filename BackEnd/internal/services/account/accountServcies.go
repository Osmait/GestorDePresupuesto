package account

import (
	"context"
	"database/sql"
	"errors"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/account"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/systemcategory"

	"github.com/segmentio/ksuid"
)

// AccountService handles business logic related to account management.
type AccountService struct {
	accountRepository accountRepo.AccountRepositoryInterface

	// Set by WithReconciliation (reconcile.go).
	reconciliations accountRepo.ReconciliationRepositoryInterface
	adjustments     AdjustmentWriter
	categories      systemcategory.Store
}

// NewAccountService creates a new instance of AccountService.
func NewAccountService(accountRepository accountRepo.AccountRepositoryInterface, opts ...Option) *AccountService {
	s := &AccountService{
		accountRepository: accountRepository,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// CreateAccount creates a new account for a user.
func (s *AccountService) CreateAccount(ctx context.Context, name, bank string, balace money.Amount, userId string) error {
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

// FindAll retrieves all accounts for a specific user, including their current balances.
func (s *AccountService) FindAll(ctx context.Context, userId string) ([]*dto.AccountResponse, error) {
	accounts, err := s.accountRepository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	balances, err := s.accountRepository.Balances(ctx, userId)
	if err != nil {
		return nil, err
	}
	reconciledAt, err := s.lastReconciledAt(ctx, userId)
	if err != nil {
		return nil, err
	}
	accountResponses := make([]*dto.AccountResponse, 0)

	for _, account := range accounts {
		balance := balances[account.Id]
		accountResponse := dto.NewAccountResponse(account, balance.Add(account.InitialBalance))
		if at, ok := reconciledAt[account.Id]; ok {
			accountResponse.LastReconciledAt = &at
		}
		accountResponses = append(accountResponses, accountResponse)
	}

	return accountResponses, nil
}

// DeleteAccount removes an account by its ID and User ID.
func (s *AccountService) DeleteAccount(ctx context.Context, id string, userId string) error {
	err := s.accountRepository.Delete(ctx, id, userId)
	return err
}

// Balance retrieves the current balance of an account owned by userId.
func (s *AccountService) Balance(ctx context.Context, id string, userId string) (money.Amount, error) {
	balance, err := s.accountRepository.Balance(ctx, id, userId)
	if err != nil {
		return money.Zero, err
	}
	return balance, nil
}

// UpdateAccount modifies an existing account's details.
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

// FindById retrieves a specific account by its ID and User ID.
func (s *AccountService) FindById(ctx context.Context, id, userId string) (*dto.AccountResponse, error) {
	acc, err := s.accountRepository.FindByIdAndUserId(ctx, id, userId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errorhttp.ErrNotFound
		}
		return nil, err
	}

	balance, err := s.accountRepository.Balance(ctx, id, userId)
	if err != nil {
		return nil, err
	}
	reconciledAt, err := s.lastReconciledAt(ctx, userId)
	if err != nil {
		return nil, err
	}

	response := dto.NewAccountResponse(acc, balance.Add(acc.InitialBalance))
	if at, ok := reconciledAt[id]; ok {
		response.LastReconciledAt = &at
	}
	return response, nil
}
