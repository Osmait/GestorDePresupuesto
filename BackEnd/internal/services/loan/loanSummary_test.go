package loan

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
)

func summaryLoan(currency string, status loan.LoanStatus, principal, interest, paidPrincipal, paidInterest int64) *loan.Loan {
	return &loan.Loan{
		Currency: currency, Status: status,
		PrincipalAmount: money.FromInt(principal), TotalInterest: money.FromInt(interest),
		TotalAmount:   money.FromInt(principal + interest),
		PaidPrincipal: money.FromInt(paidPrincipal), PaidInterest: money.FromInt(paidInterest),
	}
}

// Pending covers active loans only (defaulted ones are reported apart), USD
// is converted to DOP, and the per-currency totals stay in their currency.
func TestSummarizeLoans(t *testing.T) {
	t.Parallel()
	rate := money.FromInt(60)

	tests := []struct {
		name          string
		loans         []*loan.Loan
		wantPending   int64
		wantPrincipal int64
		wantDefaulted int64
		wantCollected int64
		wantActive    int
		wantByCur     map[string]int64 // pending per currency
	}{
		{
			name: "active usd plus cancelled dop is only the usd loan, converted",
			loans: []*loan.Loan{
				summaryLoan("USD", loan.LoanStatusActive, 1000, 0, 0, 0),
				summaryLoan("DOP", loan.LoanStatusCancelled, 10000, 0, 0, 0),
			},
			wantPending: 60000, wantPrincipal: 60000, wantActive: 1,
			wantByCur: map[string]int64{"USD": 1000, "DOP": 0},
		},
		{
			name: "defaulted is reported apart, paid owes nothing",
			loans: []*loan.Loan{
				summaryLoan("DOP", loan.LoanStatusActive, 50000, 5000, 10000, 1000),
				summaryLoan("DOP", loan.LoanStatusDefaulted, 20000, 0, 5000, 0),
				summaryLoan("DOP", loan.LoanStatusPaid, 8000, 800, 8000, 800),
			},
			wantPending: 44000, wantPrincipal: 78000, wantDefaulted: 15000, wantCollected: 11000 + 5000 + 8800, wantActive: 1,
			wantByCur: map[string]int64{"DOP": 44000},
		},
		{
			name:        "empty currency is dop",
			loans:       []*loan.Loan{summaryLoan("", loan.LoanStatusActive, 1000, 0, 0, 0)},
			wantPending: 1000, wantPrincipal: 1000, wantActive: 1,
			wantByCur: map[string]int64{"DOP": 1000},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := summarizeLoans(tt.loans, rate)
			moneytest.Equal(t, tt.wantPending, got.TotalPending, "pending")
			moneytest.Equal(t, tt.wantPrincipal, got.TotalPrincipal, "principal")
			moneytest.Equal(t, tt.wantDefaulted, got.DefaultedPending, "defaulted")
			moneytest.Equal(t, tt.wantCollected, got.TotalCollected, "collected")
			assert.Equal(t, tt.wantActive, got.ActiveLoans)
			moneytest.Equal(t, rate, got.UsdToDopRate)
			require.Len(t, got.ByCurrency, len(tt.wantByCur))
			for currency, pending := range tt.wantByCur {
				require.Contains(t, got.ByCurrency, currency)
				moneytest.Equal(t, pending, got.ByCurrency[currency].TotalPending, currency)
			}
		})
	}
}
