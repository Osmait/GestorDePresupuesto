package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	certificateDomain "github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	investmentDomain "github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	loanDomain "github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
)

func position(currency string, quantity, price string) *investmentDomain.Investment {
	return &investmentDomain.Investment{SettlementCurrency: currency, Quantity: money.MustParse(quantity), CurrentPrice: money.MustParse(price)}
}

func cert(id, currency string, status certificateDomain.CertificateStatus, interest certificateDomain.InterestType, reinvest bool, capital int64) *certificateDomain.Certificate {
	payout := "bank-1"
	c := &certificateDomain.Certificate{
		Id: id, Currency: currency, Status: status, InterestType: interest, ReinvestInterest: reinvest,
		BaseCapital: money.FromInt(capital),
	}
	if !reinvest {
		c.PayoutAccountId = &payout
	}
	return c
}

func payment(certID string, day int, capital, net string) *certificateDomain.CertificatePayment {
	return &certificateDomain.CertificatePayment{
		CertificateId: certID, PaymentDate: time.Date(2026, 10, day, 12, 0, 0, 0, time.UTC),
		AppliedCapital: money.MustParse(capital), NetInterest: money.MustParse(net),
	}
}

func lent(currency string, status loanDomain.LoanStatus, principal, paid int64) *loanDomain.Loan {
	return &loanDomain.Loan{
		Currency: currency, Status: status, PrincipalAmount: money.FromInt(principal), PaidPrincipal: money.FromInt(paid),
		TotalAmount: money.FromInt(principal), PaidInterest: money.Zero,
	}
}

// Each net worth component is valued in its own currency and converted to
// DOP only from USD.
func TestComputeNetWorth(t *testing.T) {
	t.Parallel()
	rate := money.FromInt(60)

	tests := []struct {
		name  string
		in    netWorthInputs
		check func(t *testing.T, got netWorthBreakdown)
	}{
		{
			name: "dop position is not multiplied by the rate",
			in:   netWorthInputs{investments: []*investmentDomain.Investment{position("DOP", "2", "5000")}},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, 10000, got.investmentsTotal)
				moneytest.Equal(t, 10000, got.netWorth)
			},
		},
		{
			name: "usd and legacy positions are converted",
			in: netWorthInputs{investments: []*investmentDomain.Investment{
				position("USD", "4", "150"), position("", "1", "10.5"),
			}},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, (600+10.5)*60, got.investmentsTotal)
				assert.Equal(t, 2, got.investmentsCount)
			},
		},
		{
			name: "unsupported currency is left out",
			in:   netWorthInputs{investments: []*investmentDomain.Investment{position("EUR", "1", "100")}},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, 0, got.investmentsTotal)
			},
		},
		{
			name: "usd accounts are converted, dop ones are not",
			in: netWorthInputs{accounts: []accountBalance{
				{currency: "DOP", balance: money.FromInt(1000)}, {currency: "USD", balance: money.FromInt(10)},
			}},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, 1600, got.accountsTotal)
				assert.Equal(t, 2, got.accountsCount)
			},
		},
		{
			name: "broker wallet counts as cash in each currency",
			in: netWorthInputs{wallets: []*investmentDomain.FundingBalance{
				{Currency: "USD", Available: money.FromInt(100)}, {Currency: "DOP", Available: money.FromInt(5000)},
			}},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, 11000, got.brokerCashTotal)
				moneytest.Equal(t, 11000, got.netWorth)
			},
		},
		{
			name: "only active certificates count",
			in: netWorthInputs{certificates: []*certificateDomain.Certificate{
				cert("active", "DOP", certificateDomain.StatusActive, certificateDomain.InterestTypeSimple, false, 100000),
				cert("matured", "DOP", certificateDomain.StatusMatured, certificateDomain.InterestTypeSimple, false, 50000),
				cert("cancelled", "DOP", certificateDomain.StatusCancelled, certificateDomain.InterestTypeSimple, false, 70000),
			}},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, 100000, got.certificatesTotal)
				assert.Equal(t, 1, got.certificatesCount)
			},
		},
		{
			name: "paid-out interest is not added, reinvested interest is",
			in: netWorthInputs{
				certificates: []*certificateDomain.Certificate{
					cert("paid-out", "DOP", certificateDomain.StatusActive, certificateDomain.InterestTypeSimple, false, 100000),
					cert("reinvested", "DOP", certificateDomain.StatusActive, certificateDomain.InterestTypeCompound, true, 100000),
				},
				latestPayments: certificateDomain.LatestPayments([]*certificateDomain.CertificatePayment{
					payment("paid-out", 15, "100000", "450"),
					payment("reinvested", 14, "100000", "450"),
					payment("reinvested", 15, "100450", "452.03"),
				}),
			},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, "200902.03", got.certificatesTotal)
			},
		},
		{
			name: "usd certificate capital is converted",
			in: netWorthInputs{certificates: []*certificateDomain.Certificate{
				cert("usd", "USD", certificateDomain.StatusActive, certificateDomain.InterestTypeSimple, false, 1000),
			}},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, 60000, got.certificatesTotal)
			},
		},
		{
			name: "loans: outstanding principal of active ones; defaulted reported apart",
			in: netWorthInputs{loans: []*loanDomain.Loan{
				lent("DOP", loanDomain.LoanStatusActive, 50000, 10000),
				lent("USD", loanDomain.LoanStatusActive, 1000, 0),
				lent("DOP", loanDomain.LoanStatusDefaulted, 20000, 5000),
				lent("DOP", loanDomain.LoanStatusCancelled, 10000, 0),
				lent("DOP", loanDomain.LoanStatusPaid, 8000, 8000),
			}},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, 40000+60000, got.loansReceivableTotal)
				moneytest.Equal(t, 15000, got.loansDefaultedTotal)
				assert.Equal(t, 2, got.loansReceivableCount)
				moneytest.Equal(t, 100000, got.netWorth)
			},
		},
		{
			name: "funding the broker without buying leaves net worth unchanged",
			in: netWorthInputs{
				accounts: []accountBalance{{currency: "DOP", balance: money.FromInt(40000)}},
				wallets:  []*investmentDomain.FundingBalance{{Currency: "DOP", Available: money.FromInt(60000)}},
			},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, 100000, got.netWorth)
			},
		},
		{
			name: "card debt is subtracted",
			in: netWorthInputs{
				accounts:    []accountBalance{{currency: "DOP", balance: money.FromInt(1000)}},
				cardDebtDOP: money.MustParse("250.555"),
				cardsCount:  1,
			},
			check: func(t *testing.T, got netWorthBreakdown) {
				moneytest.Equal(t, "250.56", got.creditCardDebt)
				moneytest.Equal(t, "749.44", got.netWorth)
				assert.Equal(t, 1, got.creditCardsCount)
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			tt.check(t, computeNetWorth(tt.in, rate))
		})
	}
}
