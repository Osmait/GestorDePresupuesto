package analytics

import (
	"context"

	"github.com/rs/zerolog/log"

	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	certificateDomain "github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	investmentDomain "github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	loanDomain "github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// LoanLister lists a user's loans (the loan repository).
type LoanLister interface {
	FindAllByUser(ctx context.Context, userId string) ([]*loanDomain.Loan, error)
}

// WithLoans sets the loan repository: the outstanding principal of active
// loans counts as an asset in net worth. Without it loans are left out.
func WithLoans(loans LoanLister) Option {
	return func(s *AnalyticsService) {
		s.loanRepository = loans
	}
}

// accountBalance is a bank/cash account's balance (initial balance plus its
// ledger) in the account's currency.
type accountBalance struct {
	currency string
	balance  money.Amount
}

// netWorthInputs are what net worth is computed from, each in its own
// currency except cardDebtDOP.
type netWorthInputs struct {
	accounts       []accountBalance
	cardDebtDOP    money.Amount
	cardsCount     int
	investments    []*investmentDomain.Investment
	wallets        []*investmentDomain.FundingBalance
	certificates   []*certificateDomain.Certificate
	latestPayments map[string]*certificateDomain.CertificatePayment
	loans          []*loanDomain.Loan
}

// netWorthBreakdown is net worth by component, all in DOP rounded to cents.
type netWorthBreakdown struct {
	accountsTotal        money.Amount
	investmentsTotal     money.Amount
	certificatesTotal    money.Amount
	brokerCashTotal      money.Amount
	loansReceivableTotal money.Amount
	loansDefaultedTotal  money.Amount
	creditCardDebt       money.Amount
	netWorth             money.Amount

	accountsCount        int
	creditCardsCount     int
	investmentsCount     int
	certificatesCount    int
	loansReceivableCount int
}

// computeNetWorth values every component in its own currency and converts it
// to DOP (USD at usdToDop):
//
//   - accounts: initial balance plus ledger, in the account's currency.
//   - investments: quantity * current price in the position's settlement
//     currency (USD when empty).
//   - broker cash: the wallet balances (money moved to the broker and not
//     spent on positions): funding the broker moves money, it does not lose
//     it.
//   - certificates: only active ones, at their current value (capital plus
//     capitalized interest). Interest paid out is already in the payout
//     account's balance; a matured or cancelled certificate returned its
//     capital.
//   - loans receivable: the outstanding principal of active loans (lending
//     moves money to the borrower, it does not lose it). Defaulted loans are
//     written off: reported in loansDefaultedTotal, not added. Paid and
//     cancelled loans owe nothing.
//   - credit card debt is subtracted.
//
// An amount in an unsupported currency cannot be converted: it is logged and
// left out.
func computeNetWorth(in netWorthInputs, usdToDop money.Amount) netWorthBreakdown {
	toDOP := func(kind string, amount money.Amount, currency string) money.Amount {
		dop, ok := money.ToDOP(amount, currency, usdToDop)
		if !ok {
			log.Warn().Str("component", kind).Str("currency", currency).Msg("net worth: unsupported currency left out")
		}
		return dop
	}

	var out netWorthBreakdown

	accounts := money.Zero
	for _, acc := range in.accounts {
		accounts = accounts.Add(toDOP("account", acc.balance, acc.currency))
		out.accountsCount++
	}

	investments := money.Zero
	for _, inv := range in.investments {
		investments = investments.Add(toDOP("investment", inv.MarketValue(), inv.Currency()))
		out.investmentsCount++
	}

	brokerCash := money.Zero
	for _, wallet := range in.wallets {
		brokerCash = brokerCash.Add(toDOP("broker_cash", wallet.Available, money.NormalizeCurrency(wallet.Currency, money.CurrencyUSD)))
	}

	certificates := money.Zero
	for _, cert := range in.certificates {
		if !cert.IsActive() {
			continue
		}
		certificates = certificates.Add(toDOP("certificate", cert.CurrentValue(in.latestPayments[cert.Id]), cert.CurrencyCode()))
		out.certificatesCount++
	}

	loans, defaulted := money.Zero, money.Zero
	for _, item := range in.loans {
		switch {
		case item.IsReceivable():
			loans = loans.Add(toDOP("loan", item.OutstandingPrincipal(), item.CurrencyCode()))
			out.loansReceivableCount++
		case item.Status == loanDomain.LoanStatusDefaulted:
			defaulted = defaulted.Add(toDOP("loan", item.OutstandingPrincipal(), item.CurrencyCode()))
		}
	}

	out.accountsTotal = accounts.RoundCents()
	out.investmentsTotal = investments.RoundCents()
	out.brokerCashTotal = brokerCash.RoundCents()
	out.certificatesTotal = certificates.RoundCents()
	out.loansReceivableTotal = loans.RoundCents()
	out.loansDefaultedTotal = defaulted.RoundCents()
	out.creditCardDebt = in.cardDebtDOP.RoundCents()
	out.creditCardsCount = in.cardsCount
	out.netWorth = out.accountsTotal.Add(out.investmentsTotal).Add(out.brokerCashTotal).
		Add(out.certificatesTotal).Add(out.loansReceivableTotal).Sub(out.creditCardDebt)
	return out
}

// netWorthInputs loads the balances of computeNetWorth. A component whose
// read fails is left out (logged), so the rest of the dashboard still loads.
func (s *AnalyticsService) netWorthInputs(ctx context.Context, userID string, usdToDop money.Amount) netWorthInputs {
	var in netWorthInputs
	warn := func(err error, what string) {
		log.Warn().Err(err).Str("user_id", userID).Msgf("net worth: could not load %s", what)
	}

	if s.accountRepository != nil {
		accounts, err := s.accountRepository.FindAll(ctx, userID)
		if err != nil {
			warn(err, "accounts")
		} else if balances, err := s.accountRepository.Balances(ctx, userID); err != nil {
			warn(err, "account balances")
		} else {
			for _, acc := range accounts {
				if acc.Type == accountDomain.AccountTypeCreditCard {
					in.cardsCount++
					in.cardDebtDOP = in.cardDebtDOP.Add(s.cardDebtDOP(ctx, acc.Id, userID, usdToDop))
					continue
				}
				in.accounts = append(in.accounts, accountBalance{
					currency: money.NormalizeCurrency(acc.Currency, money.CurrencyDOP),
					balance:  balances[acc.Id].Add(acc.InitialBalance),
				})
			}
		}
	}

	if s.investmentRepository != nil {
		investments, err := s.investmentRepository.FindAll(ctx, userID)
		if err != nil {
			warn(err, "investments")
		}
		in.investments = investments
		wallets, err := s.investmentRepository.GetFundingBalances(ctx, userID)
		if err != nil {
			warn(err, "broker wallet")
		}
		in.wallets = wallets
	}

	if s.certificateRepository != nil {
		certificates, err := s.certificateRepository.FindAll(ctx, userID)
		if err != nil {
			warn(err, "certificates")
		}
		in.certificates = certificates
		payments, err := s.certificateRepository.FindAllPayments(ctx, userID)
		if err != nil {
			warn(err, "certificate payments")
		}
		in.latestPayments = certificateDomain.LatestPayments(payments)
	}

	if s.loanRepository != nil {
		loans, err := s.loanRepository.FindAllByUser(ctx, userID)
		if err != nil {
			warn(err, "loans")
		}
		in.loans = loans
	}

	return in
}
