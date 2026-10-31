package creditcard

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	cardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/funds"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

var (
	// ErrCardNotFound is returned when a card does not exist or belongs to another user.
	ErrCardNotFound = fmt.Errorf("%w: credit card not found", errorhttp.ErrNotFound)
	// ErrBalanceNotFound is returned when a card balance does not exist or belongs to another user.
	ErrBalanceNotFound = fmt.Errorf("%w: balance not found", errorhttp.ErrNotFound)
	// ErrSourceAccountNotFound is returned when the paying account is not one of the user's accounts.
	ErrSourceAccountNotFound = fmt.Errorf("%w: source account not found", errorhttp.ErrBadRequest)
)

func isNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows) || errors.Is(err, errorhttp.ErrNotFound)
}

type TransactionServiceInterface interface {
	CreateTransaction(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error
	CreateTransactionWithID(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) (string, error)
	DeleteTransaction(ctx context.Context, id string, userId string) error
}

type AccountRepositoryInterface interface {
	Save(ctx context.Context, account *account.Account) error
	FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error)
	Delete(ctx context.Context, id string, userId string) error
	BalanceByCurrency(ctx context.Context, id string, userId string, currency string) (money.Amount, error)
	// FindAll and BalancesByCurrency read the accounts and ledger balances of
	// all the cards in one query each (card lists and summary).
	FindAll(ctx context.Context, userId string) ([]*account.Account, error)
	BalancesByCurrency(ctx context.Context, ids []string, userId string) (map[string]map[string]money.Amount, error)
	// FindByIdAndUserIdForUpdate locks the paying account for the request
	// transaction; Balance feeds the overdraft check (see package funds).
	FindByIdAndUserIdForUpdate(ctx context.Context, id string, userId string) (*account.Account, error)
	Balance(ctx context.Context, id string, userId string) (money.Amount, error)
	// Update renames the card's account (its name is what lists show).
	Update(ctx context.Context, id string, name string, bank string, userId string) error
}

type CreditCardService struct {
	cardRepo        cardRepo.CreditCardRepositoryInterface
	accountRepo     AccountRepositoryInterface
	transactionRepo TransactionServiceInterface
	loc             *time.Location
}

// Option configures a CreditCardService.
type Option func(*CreditCardService)

// WithLocation sets the app time zone that the next cut and due dates are
// computed in (default apptime.Default()).
func WithLocation(loc *time.Location) Option {
	return func(s *CreditCardService) {
		if loc != nil {
			s.loc = loc
		}
	}
}

func NewCreditCardService(
	cardRepo cardRepo.CreditCardRepositoryInterface,
	accountRepo AccountRepositoryInterface,
	transactionRepo TransactionServiceInterface,
	opts ...Option,
) *CreditCardService {
	s := &CreditCardService{
		cardRepo:        cardRepo,
		accountRepo:     accountRepo,
		transactionRepo: transactionRepo,
		loc:             apptime.Default(),
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *CreditCardService) CreateCreditCard(ctx context.Context, req *dto.CreateCreditCardRequest, userId string) (*dto.CreditCardResponse, error) {
	if err := req.Validate(); err != nil {
		log.Error().Err(err).Str("user_id", userId).Msg("Credit card validation failed")
		return nil, err
	}

	uuid, err := ksuid.NewRandom()
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate account ID")
		return nil, err
	}
	accountId := uuid.String()

	primaryCurrency := "DOP"
	if len(req.Balances) > 0 {
		primaryCurrency = req.Balances[0].Currency
	}

	acc := account.NewCreditCardAccount(accountId, req.Name, req.Bank)
	acc.UserId = userId
	acc.Currency = primaryCurrency
	if err := s.accountRepo.Save(ctx, acc); err != nil {
		log.Error().Err(err).Str("user_id", userId).Msg("Failed to save credit card account")
		return nil, err
	}

	card := creditcard.NewCreditCard(accountId, req.Bank, req.LastFourDigits, req.CutDay, req.DueDay)
	if err := s.cardRepo.SaveCard(ctx, card); err != nil {
		log.Error().Err(err).Str("account_id", accountId).Msg("Failed to save credit card details")
		return nil, err
	}

	for _, balanceReq := range req.Balances {
		balanceUuid, _ := ksuid.NewRandom()
		balance := creditcard.NewCardBalance(balanceUuid.String(), accountId, balanceReq.Currency, balanceReq.CreditLimit)
		if err := s.cardRepo.SaveBalance(ctx, balance); err != nil {
			log.Error().Err(err).Str("account_id", accountId).Str("currency", balanceReq.Currency).Msg("Failed to save card balance")
			return nil, err
		}
		// The debt the card already had is the first entry of its ledger.
		if balanceReq.InitialDebt.IsPositive() {
			if err := s.writeAdjustment(ctx, accountId, userId, balanceReq.Currency, balanceReq.InitialDebt.Neg(), i18n.T(ctx, i18n.CardInitialDebtDesc)); err != nil {
				return nil, err
			}
		}
	}

	log.Info().Str("account_id", accountId).Str("user_id", userId).Msg("Credit card created successfully")
	return s.FindCardById(ctx, accountId, userId)
}

func (s *CreditCardService) FindCardById(ctx context.Context, accountId string, userId string) (*dto.CreditCardResponse, error) {
	card, err := s.cardRepo.FindCardById(ctx, accountId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}

	acc, err := s.accountRepo.FindByIdAndUserId(ctx, accountId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}

	balances, err := s.cardRepo.FindBalancesByCard(ctx, accountId, userId)
	if err != nil {
		return nil, err
	}

	ledgers, err := s.accountRepo.BalancesByCurrency(ctx, []string{accountId}, userId)
	if err != nil {
		return nil, err
	}

	return s.buildCardResponse(card, acc, balances, ledgers[accountId]), nil
}

func (s *CreditCardService) FindAllCards(ctx context.Context, userId string) ([]*dto.CreditCardResponse, error) {
	return s.allCardResponses(ctx, userId)
}

// allCardResponses builds the response of every card of userId, newest first
// (nil when there are none), with one query each for the cards, their
// accounts, their currencies and their ledger balances, however many cards
// there are. A card whose account is not found is left out.
func (s *CreditCardService) allCardResponses(ctx context.Context, userId string) ([]*dto.CreditCardResponse, error) {
	cards, err := s.cardRepo.FindAllCards(ctx, userId)
	if err != nil || len(cards) == 0 {
		return nil, err
	}

	accounts, err := s.accountRepo.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	accountsById := make(map[string]*account.Account, len(accounts))
	for _, acc := range accounts {
		accountsById[acc.Id] = acc
	}

	cardIds := make([]string, 0, len(cards))
	for _, card := range cards {
		cardIds = append(cardIds, card.AccountId)
	}
	balances, err := s.cardRepo.FindBalancesByCards(ctx, cardIds, userId)
	if err != nil {
		return nil, err
	}
	ledgers, err := s.accountRepo.BalancesByCurrency(ctx, cardIds, userId)
	if err != nil {
		return nil, err
	}

	var responses []*dto.CreditCardResponse
	for _, card := range cards {
		acc, ok := accountsById[card.AccountId]
		if !ok {
			continue
		}
		responses = append(responses, s.buildCardResponse(card, acc, balances[card.AccountId], ledgers[card.AccountId]))
	}
	return responses, nil
}

func (s *CreditCardService) UpdateCreditCard(ctx context.Context, accountId string, req *dto.UpdateCreditCardRequest, userId string) (*dto.CreditCardResponse, error) {
	card, err := s.cardRepo.FindCardById(ctx, accountId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}

	acc, err := s.accountRepo.FindByIdAndUserId(ctx, accountId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}

	if req.Name != nil {
		acc.Name = *req.Name
	}
	if req.Bank != nil {
		card.Bank = *req.Bank
		acc.Bank = *req.Bank
	}
	if req.LastFourDigits != nil {
		card.LastFourDigits = *req.LastFourDigits
	}
	if req.CutDay != nil {
		card.CutDay = *req.CutDay
	}
	if req.DueDay != nil {
		card.DueDay = *req.DueDay
	}
	card.UpdatedAt = time.Now()

	if err := s.cardRepo.UpdateCard(ctx, card, userId); err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}
	if req.Name != nil || req.Bank != nil {
		if err := s.accountRepo.Update(ctx, accountId, acc.Name, acc.Bank, userId); err != nil {
			if isNotFound(err) {
				return nil, ErrCardNotFound
			}
			return nil, err
		}
	}

	return s.FindCardById(ctx, accountId, userId)
}

func (s *CreditCardService) DeleteCreditCard(ctx context.Context, accountId string, userId string) error {
	if _, err := s.cardRepo.FindCardById(ctx, accountId, userId); err != nil {
		if isNotFound(err) {
			return ErrCardNotFound
		}
		return err
	}
	// The card's bookkeeping (initial debt, payments received, resets) goes
	// with it; the paying accounts keep their card_payment transactions.
	if err := s.cardRepo.DeleteBookkeeping(ctx, accountId, userId); err != nil {
		return err
	}
	if err := s.cardRepo.DeleteCard(ctx, accountId, userId); err != nil {
		if isNotFound(err) {
			return ErrCardNotFound
		}
		return err
	}
	return s.accountRepo.Delete(ctx, accountId, userId)
}

// UpdateBalance changes the balance `balanceId` of card `cardId`; both must
// belong to userId, otherwise ErrBalanceNotFound is returned.
func (s *CreditCardService) UpdateBalance(ctx context.Context, cardId string, balanceId string, userId string, req *dto.UpdateBalanceRequest) (*dto.BalanceResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", errorhttp.ErrBadRequest, err.Error())
	}
	balance, err := s.cardRepo.FindBalanceById(ctx, balanceId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrBalanceNotFound
		}
		return nil, err
	}
	if cardId != "" && balance.CardId != cardId {
		return nil, ErrBalanceNotFound
	}

	if req.CreditLimit == nil {
		return dto.NewBalanceResponse(balance), nil
	}

	// Only the credit limit is written; the current balance is never written
	// back from the struct read above, so concurrent payments are not lost.
	updated, err := s.cardRepo.UpdateCreditLimit(ctx, balance.Id, userId, *req.CreditLimit)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrBalanceNotFound
		}
		return nil, err
	}

	return dto.NewBalanceResponse(updated), nil
}

func (s *CreditCardService) ResetCardBalance(ctx context.Context, cardId string, userId string, req *dto.ResetBalanceRequest) (*dto.BalanceResetResponse, error) {
	if _, err := s.cardRepo.FindCardById(ctx, cardId, userId); err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}

	var balance *creditcard.CardBalance
	var err error
	if req.BalanceId != "" {
		balance, err = s.cardRepo.FindBalanceById(ctx, req.BalanceId, userId)
	} else if req.Currency != "" {
		balance, err = s.cardRepo.FindBalanceByCardAndCurrency(ctx, cardId, userId, req.Currency)
	} else {
		return nil, fmt.Errorf("%w: balance_id or currency is required", errorhttp.ErrBadRequest)
	}
	if err != nil {
		if isNotFound(err) {
			return nil, ErrBalanceNotFound
		}
		return nil, err
	}
	if balance.CardId != cardId {
		return nil, ErrBalanceNotFound
	}

	// Lock the card account (like a transfer source) so two resets of the same
	// card are serialised: the second one sees the first one's adjustment. A
	// charge or payment committed concurrently is not covered by the read below
	// and stays in the balance; it is neither lost nor counted twice.
	if _, err := s.accountRepo.FindByIdAndUserIdForUpdate(ctx, cardId, userId); err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}
	previousBalance, err := s.accountRepo.BalanceByCurrency(ctx, cardId, userId, balance.Currency)
	if err != nil {
		return nil, err
	}
	description := strings.TrimSpace(req.Notes)
	if description == "" {
		description = i18n.T(ctx, i18n.CardResetDescription)
	}
	if err := s.writeAdjustment(ctx, cardId, userId, balance.Currency, previousBalance.Neg(), description); err != nil {
		return nil, err
	}

	resetUuid, _ := ksuid.NewRandom()
	reset := &creditcard.CardBalanceReset{
		Id:              resetUuid.String(),
		BalanceId:       balance.Id,
		CardId:          cardId,
		Currency:        balance.Currency,
		PreviousBalance: previousBalance,
		Notes:           req.Notes,
		CreatedAt:       time.Now(),
	}
	if err := s.cardRepo.SaveBalanceReset(ctx, reset); err != nil {
		return nil, err
	}

	log.Info().Str("card_id", cardId).Str("balance_id", balance.Id).Stringer("previous_balance", previousBalance).Msg("Card balance reset")
	return dto.NewBalanceResetResponse(reset), nil
}

func (s *CreditCardService) FindBalanceResetsByCard(ctx context.Context, cardId string, userId string) ([]*dto.BalanceResetResponse, error) {
	if _, err := s.cardRepo.FindCardById(ctx, cardId, userId); err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}
	resets, err := s.cardRepo.FindBalanceResetsByCard(ctx, cardId, userId)
	if err != nil {
		return nil, err
	}
	var responses []*dto.BalanceResetResponse
	for _, r := range resets {
		responses = append(responses, dto.NewBalanceResetResponse(r))
	}
	return responses, nil
}

func (s *CreditCardService) CreatePayment(ctx context.Context, cardId string, userId string, req *dto.CreatePaymentRequest) (*dto.PaymentResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	card, err := s.cardRepo.FindCardById(ctx, cardId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}

	balance, err := s.cardRepo.FindBalanceByCardAndCurrency(ctx, cardId, userId, req.Currency)
	if err != nil {
		if isNotFound(err) {
			return nil, fmt.Errorf("%w: balance not found for this currency", errorhttp.ErrBadRequest)
		}
		return nil, err
	}

	// Lock the paying account until the request transaction ends: the funds
	// check below and the debit must not interleave with another payment.
	fromAccount, err := s.accountRepo.FindByIdAndUserIdForUpdate(ctx, req.FromAccountId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrSourceAccountNotFound
		}
		return nil, err
	}
	if fromAccount.UserId != userId {
		return nil, ErrSourceAccountNotFound
	}

	fromCurrency := fromAccount.Currency
	if fromCurrency == "" {
		fromCurrency = "DOP"
	}

	sourceAmount, err := convertPaymentAmount(req.Amount, req.Currency, fromCurrency, req.ExchangeRate)
	if err != nil {
		return nil, err
	}
	chargesInterest := req.IncludesInterest && req.InterestAmount.IsPositive()
	interestSourceAmount := money.Zero
	if chargesInterest {
		var convErr error
		interestSourceAmount, convErr = convertPaymentAmount(req.InterestAmount, req.Currency, fromCurrency, req.ExchangeRate)
		if convErr != nil {
			interestSourceAmount = req.InterestAmount
		}
	}

	// No overdrafts: the paying account must cover the payment plus the
	// interest debited with it.
	if err := funds.Require(ctx, s.accountRepo, fromAccount, userId, sourceAmount.Add(interestSourceAmount)); err != nil {
		return nil, err
	}

	uuid, _ := ksuid.NewRandom()
	payment := creditcard.NewCardPayment(uuid.String(), cardId, req.FromAccountId, req.Currency, req.Amount)
	payment.SourceCurrency = fromCurrency
	payment.SourceAmount = sourceAmount
	payment.ExchangeRate = req.ExchangeRate
	if payment.ExchangeRate.IsZero() {
		payment.ExchangeRate = money.FromInt(1)
	}
	payment.IncludesInterest = req.IncludesInterest
	payment.InterestAmount = req.InterestAmount
	payment.Notes = req.Notes

	if err := s.cardRepo.SavePayment(ctx, payment, userId); err != nil {
		return nil, err
	}

	cardName := i18n.T(ctx, i18n.CardNameFallback)
	if card != nil && strings.TrimSpace(card.Bank) != "" {
		cardName = i18n.T(ctx, i18n.CardNameWithBank, card.Bank)
	}
	transactionDesc := i18n.T(ctx, i18n.CardPaymentDescription, cardName)
	if req.Notes != "" {
		transactionDesc += " - " + req.Notes
	}
	// Card payment transactions get a dedicated "Pago de tarjeta" category
	// instead of the transaction repository's fallback (the user's oldest
	// category, e.g. "Supermercado"). It is found by its deterministic id, so
	// the request language only affects the name of a newly created row.
	paymentCategoryID, err := s.cardRepo.EnsurePaymentCategory(ctx, userId)
	if err != nil {
		return nil, err
	}
	// Two sides of one transfer: money leaves the paying account and the debt
	// on the card goes down (in the card currency). Every write runs in the
	// request transaction, so on any later error everything rolls back.
	now := time.Now()
	if _, err := s.transactionRepo.CreateTransactionWithID(ctx, i18n.T(ctx, i18n.CardPaymentName), transactionDesc, sourceAmount, "card_payment", req.FromAccountId, userId, paymentCategoryID, "", fromCurrency, now); err != nil {
		return nil, err
	}
	receivedDesc := i18n.T(ctx, i18n.CardPaymentReceivedDsc, fromAccount.Name)
	if req.Notes != "" {
		receivedDesc += " - " + req.Notes
	}
	if _, err := s.transactionRepo.CreateTransactionWithID(ctx, i18n.T(ctx, i18n.CardPaymentReceived), receivedDesc, req.Amount, creditcard.PaymentReceivedType, cardId, userId, paymentCategoryID, "", balance.Currency, now); err != nil {
		return nil, err
	}

	if chargesInterest {
		if _, err := s.transactionRepo.CreateTransactionWithID(ctx, i18n.T(ctx, i18n.CardInterestName), i18n.T(ctx, i18n.CardInterestDesc, cardName), interestSourceAmount, "bill", req.FromAccountId, userId, paymentCategoryID, "", fromCurrency, time.Now()); err != nil {
			return nil, err
		}
	}

	log.Info().Str("card_id", cardId).Str("user_id", userId).Stringer("amount", req.Amount).Msg("Card payment created")
	return dto.NewPaymentResponse(payment), nil
}

// writeAdjustment moves the card's balance in currency by delta with one
// balance adjustment (neutral in reports); nothing when delta is zero.
func (s *CreditCardService) writeAdjustment(ctx context.Context, cardId, userId, currency string, delta money.Amount, description string) error {
	adjustmentType, ok := account.AdjustmentType(delta)
	if !ok {
		return nil
	}
	categoryId, err := s.cardRepo.EnsureAdjustmentCategory(ctx, userId)
	if err != nil {
		return err
	}
	_, err = s.transactionRepo.CreateTransactionWithID(ctx, i18n.T(ctx, i18n.BalanceAdjustmentName), description, delta.Abs(),
		adjustmentType, cardId, userId, categoryId, "", currency, time.Now())
	return err
}

func convertPaymentAmount(cardAmount money.Amount, cardCurrency string, sourceCurrency string, rate money.Amount) (money.Amount, error) {
	if cardCurrency == sourceCurrency {
		return cardAmount, nil
	}
	if !rate.IsPositive() {
		return money.Zero, fmt.Errorf("%w: exchange_rate is required when paying with a different currency", errorhttp.ErrBadRequest)
	}

	// The converted amount is a derived monetary value: rounded half-even to
	// cents, the scale of the card/transaction columns it is stored in.
	var converted money.Amount
	switch {
	case cardCurrency == "USD" && sourceCurrency == "DOP":
		converted = cardAmount.Mul(rate).RoundCents()
	case cardCurrency == "DOP" && sourceCurrency == "USD":
		converted = cardAmount.Div(rate).RoundCents()
	default:
		return money.Zero, fmt.Errorf("%w: unsupported currency conversion from %s to %s", errorhttp.ErrBadRequest, sourceCurrency, cardCurrency)
	}
	// A rate that rounds the debit to nothing would pay the card for free.
	if !converted.IsPositive() {
		return money.Zero, fmt.Errorf("%w: the exchange rate converts the payment to %s 0.00", errorhttp.ErrBadRequest, sourceCurrency)
	}
	return converted, nil
}

func (s *CreditCardService) FindPaymentsByCard(ctx context.Context, cardId string, userId string) ([]*dto.PaymentResponse, error) {
	_, err := s.cardRepo.FindCardById(ctx, cardId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrCardNotFound
		}
		return nil, err
	}

	payments, err := s.cardRepo.FindPaymentsByCard(ctx, cardId, userId)
	if err != nil {
		return nil, err
	}

	var responses []*dto.PaymentResponse
	for _, p := range payments {
		responses = append(responses, dto.NewPaymentResponse(p))
	}
	return responses, nil
}

func (s *CreditCardService) GetSummary(ctx context.Context, userId string) (*dto.CreditCardSummaryResponse, error) {
	cards, err := s.allCardResponses(ctx, userId)
	if err != nil {
		return nil, err
	}

	summary := &dto.CreditCardSummaryResponse{
		TotalDebt:        make(map[string]money.Amount),
		TotalCreditLimit: make(map[string]money.Amount),
		AvgUtilization:   make(map[string]float64),
		ByCard:           []*dto.CreditCardResponse{},
	}

	currencyCardCount := make(map[string]int)

	for _, cardResp := range cards {
		summary.ByCard = append(summary.ByCard, cardResp)
		summary.TotalCards++

		for _, b := range cardResp.Balances {
			currency := b.Currency
			debt := money.Max(b.CurrentBalance.Neg(), money.Zero)
			summary.TotalDebt[currency] = summary.TotalDebt[currency].Add(debt)
			summary.TotalCreditLimit[currency] = summary.TotalCreditLimit[currency].Add(b.CreditLimit)
			currencyCardCount[currency]++
		}
	}

	for currency, count := range currencyCardCount {
		if count > 0 {
			// Display-only ratio, computed in decimal (0 when there is no limit).
			summary.AvgUtilization[currency] = money.Percent(summary.TotalDebt[currency], summary.TotalCreditLimit[currency])
		}
	}

	return summary, nil
}

// buildCardResponse builds the response of card. ledger is the card
// account's ledger balance per currency (AccountRepository.BalancesByCurrency):
// the card's balance in a currency, zero when absent.
func (s *CreditCardService) buildCardResponse(card *creditcard.CreditCard, acc *account.Account, balances []*creditcard.CardBalance, ledger map[string]money.Amount) *dto.CreditCardResponse {
	var balanceResponses []*dto.BalanceResponse
	for _, b := range balances {
		balanceCopy := *b
		balanceCopy.CurrentBalance = ledger[b.Currency]
		balanceResponses = append(balanceResponses, dto.NewBalanceResponse(&balanceCopy))
	}

	return &dto.CreditCardResponse{
		Id:             card.AccountId,
		Name:           acc.Name,
		Bank:           card.Bank,
		LastFourDigits: card.LastFourDigits,
		CutDay:         card.CutDay,
		DueDay:         card.DueDay,
		Balances:       balanceResponses,
		NextCutDate:    calculateNextDate(card.CutDay, time.Now(), s.loc),
		NextDueDate:    calculateNextDate(card.DueDay, time.Now(), s.loc),
		CreatedAt:      card.CreatedAt,
		UpdatedAt:      card.UpdatedAt,
	}
}

// calculateNextDate returns the next occurrence of day of month after today
// in loc (the app time zone; today itself counts as passed), clamped to the
// month's last day, as that calendar day at 12:00 UTC (the same day in UTC
// and in the app time zone).
func calculateNextDate(day int, now time.Time, loc *time.Location) *time.Time {
	year, month, today := now.In(apptime.OrDefault(loc)).Date()
	clamp := func(y int, m time.Month) int {
		if last := apptime.DaysIn(y, m); day > last {
			return last
		}
		return day
	}

	var nextDate time.Time
	if d := clamp(year, month); today < d {
		nextDate = apptime.NoonUTC(year, month, d)
	} else {
		first := time.Date(year, month+1, 1, 0, 0, 0, 0, time.UTC)
		nextDate = apptime.NoonUTC(first.Year(), first.Month(), clamp(first.Year(), first.Month()))
	}

	return &nextDate
}
