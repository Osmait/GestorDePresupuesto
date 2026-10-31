package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// CreditCardRepositoryInterface persists credit cards and their balances,
// payments and resets. Cards are owned through their `account` row, and every
// read/update/delete is scoped to userId: rows of other users are reported as
// not found (ownership.ErrNotFound).
type CreditCardRepositoryInterface interface {
	SaveCard(ctx context.Context, card *creditcard.CreditCard) error
	FindCardById(ctx context.Context, accountId string, userId string) (*creditcard.CreditCard, error)
	FindAllCards(ctx context.Context, userId string) ([]*creditcard.CreditCard, error)
	UpdateCard(ctx context.Context, card *creditcard.CreditCard, userId string) error
	DeleteCard(ctx context.Context, accountId string, userId string) error
	// DeleteBookkeeping deletes the card account's adjustments and payments
	// received (not its charges); see DeleteCreditCard.
	DeleteBookkeeping(ctx context.Context, cardId string, userId string) error

	SaveBalance(ctx context.Context, balance *creditcard.CardBalance) error
	FindBalanceById(ctx context.Context, id string, userId string) (*creditcard.CardBalance, error)
	FindBalancesByCard(ctx context.Context, cardId string, userId string) ([]*creditcard.CardBalance, error)
	// FindBalancesByCards is FindBalancesByCard for several cards in one
	// query, keyed by card id (cards without balances are absent).
	FindBalancesByCards(ctx context.Context, cardIds []string, userId string) (map[string][]*creditcard.CardBalance, error)
	FindBalanceByCardAndCurrency(ctx context.Context, cardId string, userId string, currency string) (*creditcard.CardBalance, error)
	UpdateCreditLimit(ctx context.Context, id string, userId string, creditLimit money.Amount) (*creditcard.CardBalance, error)
	DeleteBalance(ctx context.Context, id string, userId string) error

	SaveBalanceReset(ctx context.Context, reset *creditcard.CardBalanceReset) error
	FindBalanceResetsByCard(ctx context.Context, cardId string, userId string) ([]*creditcard.CardBalanceReset, error)

	SavePayment(ctx context.Context, payment *creditcard.CardPayment, userId string) error
	DeletePayment(ctx context.Context, id string, userId string) error
	FindPaymentById(ctx context.Context, id string, userId string) (*creditcard.CardPayment, error)
	FindPaymentsByCard(ctx context.Context, cardId string, userId string) ([]*creditcard.CardPayment, error)
	FindPaymentsByCardAndCurrency(ctx context.Context, cardId string, userId string, currency string) ([]*creditcard.CardPayment, error)
	GetTotalPaymentsByCardAndCurrency(ctx context.Context, cardId string, userId string, currency string) (money.Amount, error)

	// EnsurePaymentCategory returns the id of the user's dedicated card payment
	// category, creating it on first use.
	EnsurePaymentCategory(ctx context.Context, userId string) (string, error)
	// EnsureAdjustmentCategory returns the id of the user's "Ajuste de saldo"
	// system category, creating it on first use.
	EnsureAdjustmentCategory(ctx context.Context, userId string) (string, error)
}
