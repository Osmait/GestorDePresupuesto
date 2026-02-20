package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
)

type CreditCardRepositoryInterface interface {
	SaveCard(ctx context.Context, card *creditcard.CreditCard) error
	FindCardById(ctx context.Context, accountId string, userId string) (*creditcard.CreditCard, error)
	FindAllCards(ctx context.Context, userId string) ([]*creditcard.CreditCard, error)
	UpdateCard(ctx context.Context, card *creditcard.CreditCard) error
	DeleteCard(ctx context.Context, accountId string, userId string) error

	SaveBalance(ctx context.Context, balance *creditcard.CardBalance) error
	FindBalanceById(ctx context.Context, id string) (*creditcard.CardBalance, error)
	FindBalancesByCard(ctx context.Context, cardId string) ([]*creditcard.CardBalance, error)
	FindBalanceByCardAndCurrency(ctx context.Context, cardId string, currency string) (*creditcard.CardBalance, error)
	UpdateBalance(ctx context.Context, balance *creditcard.CardBalance) error
	DeleteBalance(ctx context.Context, id string) error

	SavePayment(ctx context.Context, payment *creditcard.CardPayment) error
	FindPaymentById(ctx context.Context, id string) (*creditcard.CardPayment, error)
	FindPaymentsByCard(ctx context.Context, cardId string) ([]*creditcard.CardPayment, error)
	FindPaymentsByCardAndCurrency(ctx context.Context, cardId string, currency string) ([]*creditcard.CardPayment, error)
}
