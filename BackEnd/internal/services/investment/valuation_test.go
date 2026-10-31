package investment

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	domainInvestment "github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

func amountEq(want string) any {
	return mock.MatchedBy(func(a money.Amount) bool { return a.Equal(money.MustParse(want)) })
}

// A purchase needs a strictly positive quantity and unit price and a DOP or
// USD settlement currency; its cost is quantity * price in that currency.
func TestCreate_ValidatesPurchase(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		quantity     string
		price        string
		currency     string
		wantCurrency string
		wantCost     string
		wantErr      bool
	}{
		{name: "negative quantity is rejected (it used to buy Abs(qty))", quantity: "-4", price: "150", currency: "USD", wantErr: true},
		{name: "zero quantity is rejected", quantity: "0", price: "150", currency: "USD", wantErr: true},
		{name: "negative price is rejected", quantity: "4", price: "-150", currency: "USD", wantErr: true},
		{name: "zero price is rejected", quantity: "4", price: "0", currency: "USD", wantErr: true},
		{name: "unsupported currency is rejected", quantity: "4", price: "150", currency: "EUR", wantErr: true},
		{name: "usd purchase", quantity: "4", price: "150", currency: "USD", wantCurrency: "USD", wantCost: "600"},
		{name: "dop purchase is settled in dop", quantity: "2", price: "5000", currency: "dop", wantCurrency: "DOP", wantCost: "10000"},
		{name: "empty currency defaults to usd", quantity: "0.5", price: "10.015", currency: "", wantCurrency: "USD", wantCost: "5.01"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			repo := &MockInvestmentRepository{}
			service := NewInvestmentService(repo, nil, nil, nil, nil)
			if !tt.wantErr {
				repo.On("ConsumeFundingForInvestment", mock.Anything, mock.MatchedBy(func(inv *domainInvestment.Investment) bool {
					return inv.SettlementCurrency == tt.wantCurrency && inv.SourceAmount.Equal(money.MustParse(tt.wantCost))
				}), tt.wantCurrency, amountEq(tt.wantCost)).Return(nil)
			}

			err := service.Create(context.Background(), "inv-1", "user-1", domainInvestment.Stock, "Apple", "AAPL",
				money.MustParse(tt.quantity), money.MustParse(tt.price), money.FromInt(1), tt.currency)

			if tt.wantErr {
				require.Error(t, err)
				assert.ErrorIs(t, err, errorhttp.ErrBadRequest)
				repo.AssertNotCalled(t, "ConsumeFundingForInvestment", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
				return
			}
			require.NoError(t, err)
			repo.AssertExpectations(t)
		})
	}
}

// Quotes are USD: only USD positions (or legacy ones without a currency) are
// refreshed, never DOP ones.
func TestPositionsToRefresh_SkipsNonUSD(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)
	old := now.Add(-time.Hour)
	fresh := now.Add(-time.Minute)
	position := func(id, currency string, price int64, updated time.Time) *domainInvestment.Investment {
		return &domainInvestment.Investment{ID: id, SettlementCurrency: currency, CurrentPrice: money.FromInt(price), UpdatedAt: updated}
	}

	tests := []struct {
		name string
		inv  *domainInvestment.Investment
		want bool
	}{
		{"stale usd position is refreshed", position("usd-old", "USD", 10, old), true},
		{"usd position without price is refreshed", position("usd-zero", "USD", 0, fresh), true},
		{"fresh usd position is kept", position("usd-fresh", "USD", 10, fresh), false},
		{"legacy position without currency is usd", position("legacy", "", 10, old), true},
		{"stale dop position is never refreshed", position("dop-old", "DOP", 10, old), false},
		{"dop position without price is never refreshed", position("dop-zero", "dop", 0, old), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := positionsToRefresh([]*domainInvestment.Investment{tt.inv}, now)
			assert.Equal(t, tt.want, len(got) == 1)
		})
	}
}

// Editing quantity or purchase price moves the wallet by the cost difference
// (debit with the funds check, credit capped at what the position took);
// the settlement currency cannot change; quantities and prices stay positive.
func TestUpdate_WalletFollowsCost(t *testing.T) {
	t.Parallel()

	qty := func(v string) *money.Amount { a := money.MustParse(v); return &a }
	str := func(v string) *string { return &v }

	tests := []struct {
		name           string
		sourceAmount   string
		input          UpdateInput
		adjustErr      error
		wantDelta      string // "" = wallet untouched
		wantSource     string
		wantErr        bool
		wantNoLookup   bool
		wantInsuffient bool
	}{
		{name: "rename only leaves the wallet alone", sourceAmount: "600", input: UpdateInput{Name: str("Apple Inc")}, wantSource: "600"},
		{name: "same quantity and price leaves the wallet alone", sourceAmount: "600", input: UpdateInput{Quantity: qty("4"), PurchasePrice: qty("150")}, wantSource: "600"},
		{name: "more shares debit the cost difference", sourceAmount: "600", input: UpdateInput{Quantity: qty("6")}, wantDelta: "300", wantSource: "900"},
		{name: "lower price credits the difference", sourceAmount: "600", input: UpdateInput{PurchasePrice: qty("100")}, wantDelta: "-200", wantSource: "400"},
		{name: "credit is capped at what the position took", sourceAmount: "50", input: UpdateInput{Quantity: qty("1")}, wantDelta: "-50", wantSource: "0"},
		{name: "unfunded legacy position refunds nothing", sourceAmount: "0", input: UpdateInput{Quantity: qty("1")}, wantSource: "0"},
		{name: "insufficient wallet rejects the edit", sourceAmount: "600", input: UpdateInput{Quantity: qty("40")}, adjustErr: investmentRepo.ErrInsufficientFunding, wantDelta: "5400", wantErr: true, wantInsuffient: true},
		{name: "negative quantity is rejected", sourceAmount: "600", input: UpdateInput{Quantity: qty("-4")}, wantErr: true, wantNoLookup: true},
		{name: "zero purchase price is rejected", sourceAmount: "600", input: UpdateInput{PurchasePrice: qty("0")}, wantErr: true, wantNoLookup: true},
		{name: "changing the settlement currency is rejected", sourceAmount: "600", input: UpdateInput{SettlementCurrency: str("DOP")}, wantErr: true},
		{name: "same settlement currency in lower case is accepted", sourceAmount: "600", input: UpdateInput{SettlementCurrency: str("usd")}, wantSource: "600"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			repo := &MockInvestmentRepository{}
			service := NewInvestmentService(repo, nil, nil, nil, nil)
			ctx := context.Background()
			stored := &domainInvestment.Investment{
				ID: "inv-1", UserID: "user-1", Symbol: "AAPL", SettlementCurrency: "USD",
				Quantity: money.FromInt(4), PurchasePrice: money.FromInt(150), SourceAmount: money.MustParse(tt.sourceAmount),
			}
			if !tt.wantNoLookup {
				repo.On("FindByIDForUpdate", ctx, "inv-1", "user-1").Return(stored, nil)
			}
			if tt.wantDelta != "" {
				repo.On("AdjustFundingForInvestment", ctx, "user-1", "inv-1", "USD", amountEq(tt.wantDelta), mock.Anything).Return(tt.adjustErr)
			}
			if !tt.wantErr {
				repo.On("Update", ctx, mock.Anything).Return(nil)
			}

			updated, err := service.Update(ctx, "inv-1", "user-1", tt.input)

			if tt.wantErr {
				require.Error(t, err)
				assert.ErrorIs(t, err, errorhttp.ErrBadRequest)
				if tt.wantInsuffient {
					assert.Contains(t, err.Error(), "insufficient broker funding")
				}
				repo.AssertNotCalled(t, "Update", mock.Anything, mock.Anything)
			} else {
				require.NoError(t, err)
				moneytest.Equal(t, tt.wantSource, updated.SourceAmount)
			}
			if tt.wantDelta == "" {
				repo.AssertNotCalled(t, "AdjustFundingForInvestment", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			}
			repo.AssertExpectations(t)
		})
	}
}

func TestWalletDelta(t *testing.T) {
	t.Parallel()
	tests := []struct{ cost, source, want string }{
		{"100", "0", "100"},
		{"-100", "300", "-100"},
		{"-100", "40", "-40"},
		{"-100", "-5", "0"},
		{"0", "10", "0"},
	}
	for _, tt := range tests {
		moneytest.Equal(t, tt.want, walletDelta(money.MustParse(tt.cost), money.MustParse(tt.source)), tt)
	}
}
