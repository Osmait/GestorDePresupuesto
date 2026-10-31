package creditcard

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	creditcardDomain "github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// listFixture is two cards (newest first) plus one whose account is missing:
// "visa" in DOP and USD with ledger balances, "amex" in DOP without
// transactions.
func listFixture() (*mockCreditCardRepo, *mockAccountRepo) {
	cards := &mockCreditCardRepo{
		cards: []*creditcardDomain.CreditCard{
			{AccountId: "visa", Bank: "BHD", LastFourDigits: "1111", CutDay: 5, DueDay: 25},
			{AccountId: "ghost", Bank: "Gone"},
			{AccountId: "amex", Bank: "Popular", LastFourDigits: "2222", CutDay: 10, DueDay: 30},
		},
		balancesByCard: map[string][]*creditcardDomain.CardBalance{
			"visa": {
				{Id: "b1", CardId: "visa", Currency: "DOP", CreditLimit: money.FromInt(1000)},
				{Id: "b2", CardId: "visa", Currency: "USD", CreditLimit: money.FromInt(500)},
			},
			"amex": {{Id: "b3", CardId: "amex", Currency: "DOP", CreditLimit: money.FromInt(3000)}},
		},
	}
	accounts := &mockAccountRepo{
		all: []*account.Account{
			{Id: "checking", Name: "Checking"},
			{Id: "visa", Name: "Visa Gold"},
			{Id: "amex", Name: "Amex"},
		},
		ledgers: map[string]map[string]money.Amount{
			"visa": {"DOP": money.FromInt(-250), "USD": money.FromInt(-100), "EUR": money.FromInt(-9)},
		},
	}
	return cards, accounts
}

func TestFindAllCards_BatchesLookups(t *testing.T) {
	cardRepo, accountRepo := listFixture()
	service := NewCreditCardService(cardRepo, accountRepo, &mockTransactionService{})

	got, err := service.FindAllCards(context.Background(), "user-1")
	require.NoError(t, err)
	assert.Equal(t, 1, cardRepo.batchCalls)
	assert.Equal(t, 1, accountRepo.ledgerCalls)

	// The card without an account is left out; the order is kept.
	require.Len(t, got, 2)
	assert.Equal(t, "visa", got[0].Id)
	assert.Equal(t, "Visa Gold", got[0].Name)
	assert.Equal(t, "BHD", got[0].Bank)
	require.Len(t, got[0].Balances, 2)
	assert.Equal(t, "DOP", got[0].Balances[0].Currency)
	assert.Equal(t, "-250", got[0].Balances[0].CurrentBalance.String())
	assert.Equal(t, "USD", got[0].Balances[1].Currency)
	assert.Equal(t, "-100", got[0].Balances[1].CurrentBalance.String())

	assert.Equal(t, "amex", got[1].Id)
	assert.Equal(t, "Amex", got[1].Name)
	require.Len(t, got[1].Balances, 1)
	assert.True(t, got[1].Balances[0].CurrentBalance.IsZero())
	assert.Equal(t, "3000", got[1].Balances[0].CreditLimit.String())
}

func TestFindAllCards_NoCards(t *testing.T) {
	cardRepo, accountRepo := &mockCreditCardRepo{}, &mockAccountRepo{}
	service := NewCreditCardService(cardRepo, accountRepo, &mockTransactionService{})

	got, err := service.FindAllCards(context.Background(), "user-1")
	require.NoError(t, err)
	assert.Nil(t, got)
	assert.Zero(t, cardRepo.batchCalls)
	assert.Zero(t, accountRepo.ledgerCalls)
}

func TestGetSummary_UsesBatchedCards(t *testing.T) {
	cardRepo, accountRepo := listFixture()
	service := NewCreditCardService(cardRepo, accountRepo, &mockTransactionService{})

	summary, err := service.GetSummary(context.Background(), "user-1")
	require.NoError(t, err)
	assert.Equal(t, 1, cardRepo.batchCalls)
	assert.Equal(t, 1, accountRepo.ledgerCalls)

	assert.Equal(t, 2, summary.TotalCards)
	require.Len(t, summary.ByCard, 2)
	assert.Equal(t, "250", summary.TotalDebt["DOP"].String())
	assert.Equal(t, "100", summary.TotalDebt["USD"].String())
	assert.Equal(t, "4000", summary.TotalCreditLimit["DOP"].String())
	assert.Equal(t, "500", summary.TotalCreditLimit["USD"].String())
	assert.InDelta(t, 6.25, summary.AvgUtilization["DOP"], 0.001)
	assert.InDelta(t, 20.0, summary.AvgUtilization["USD"], 0.001)
}

func TestGetSummary_NoCards(t *testing.T) {
	service := NewCreditCardService(&mockCreditCardRepo{}, &mockAccountRepo{}, &mockTransactionService{})

	summary, err := service.GetSummary(context.Background(), "user-1")
	require.NoError(t, err)
	assert.Zero(t, summary.TotalCards)
	assert.NotNil(t, summary.ByCard)
	assert.Empty(t, summary.ByCard)
}
