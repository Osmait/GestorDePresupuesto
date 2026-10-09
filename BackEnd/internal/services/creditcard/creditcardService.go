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
	// FindByIdAndUserIdForUpdate locks the paying account for the request
	// transaction; Balance feeds the overdraft check (see package funds).
	FindByIdAndUserIdForUpdate(ctx context.Context, id string, userId string) (*account.Account, error)
	Balance(ctx context.Context, id string, userId string) (money.Amount, error)
}

type CreditCardService struct {
	cardRepo        cardRepo.CreditCardRepositoryInterface
	accountRepo     AccountRepositoryInterface
	transactionRepo TransactionServiceInterface
}

func NewCreditCardService(
	cardRepo cardRepo.CreditCardRepositoryInterface,
	accountRepo AccountRepositoryInterface,
	transactionRepo TransactionServiceInterface,
) *CreditCardService {
	return &CreditCardService{
		cardRepo:        cardRepo,
		accountRepo:     accountRepo,
		transactionRepo: transactionRepo,
	}
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
		balance.CurrentBalance = balanceReq.InitialDebt.Neg()
		if err := s.cardRepo.SaveBalance(ctx, balance); err != nil {
			log.Error().Err(err).Str("account_id", accountId).Str("currency", balanceReq.Currency).Msg("Failed to save card balance")
			return nil, err
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

	return s.buildCardResponse(ctx, card, acc, balances, userId), nil
}

func (s *CreditCardService) FindAllCards(ctx context.Context, userId string) ([]*dto.CreditCardResponse, error) {
	cards, err := s.cardRepo.FindAllCards(ctx, userId)
	if err != nil {
		return nil, err
	}

	var responses []*dto.CreditCardResponse
	for _, card := range cards {
		acc, err := s.accountRepo.FindByIdAndUserId(ctx, card.AccountId, userId)
		if err != nil {
			continue
		}
		balances, err := s.cardRepo.FindBalancesByCard(ctx, card.AccountId, userId)
		if err != nil {
			continue
		}
		responses = append(responses, s.buildCardResponse(ctx, card, acc, balances, userId))
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

	return s.FindCardById(ctx, accountId, userId)
}

func (s *CreditCardService) DeleteCreditCard(ctx context.Context, accountId string, userId string) error {
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

	// Read the previous balance and zero it in one atomic statement, so a
	// payment committed in between can neither be lost nor recorded twice.
	previousBalance, err := s.cardRepo.ResetBalance(ctx, balance.Id, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrBalanceNotFound
		}
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

	// Atomic increment (UPDATE ... SET current_balance = current_balance + $1)
	// instead of read-modify-write: concurrent payments cannot overwrite each
	// other. Every write of this method runs in the request transaction, so on
	// any later error the caller fails the request and everything rolls back;
	// there are no hand-written compensating writes.
	if _, err := s.cardRepo.AdjustBalance(ctx, balance.Id, userId, req.Amount); err != nil {
		if isNotFound(err) {
			return nil, ErrBalanceNotFound
		}
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
	if _, err := s.transactionRepo.CreateTransactionWithID(ctx, i18n.T(ctx, i18n.CardPaymentName), transactionDesc, sourceAmount, "card_payment", req.FromAccountId, userId, paymentCategoryID, "", fromCurrency, time.Now()); err != nil {
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

func convertPaymentAmount(cardAmount money.Amount, cardCurrency string, sourceCurrency string, rate money.Amount) (money.Amount, error) {
	if cardCurrency == sourceCurrency {
		return cardAmount, nil
	}
	if !rate.IsPositive() {
		return money.Zero, fmt.Errorf("%w: exchange_rate is required when paying with a different currency", errorhttp.ErrBadRequest)
	}

	// The converted amount is a derived monetary value: rounded half-even to
	// cents, the scale of the card/transaction columns it is stored in.
	if cardCurrency == "USD" && sourceCurrency == "DOP" {
		return cardAmount.Mul(rate).RoundCents(), nil
	}
	if cardCurrency == "DOP" && sourceCurrency == "USD" {
		return cardAmount.Div(rate).RoundCents(), nil
	}

	return money.Zero, fmt.Errorf("%w: unsupported currency conversion from %s to %s", errorhttp.ErrBadRequest, sourceCurrency, cardCurrency)
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
	cards, err := s.cardRepo.FindAllCards(ctx, userId)
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

	for _, card := range cards {
		acc, err := s.accountRepo.FindByIdAndUserId(ctx, card.AccountId, userId)
		if err != nil {
			continue
		}
		balances, err := s.cardRepo.FindBalancesByCard(ctx, card.AccountId, userId)
		if err != nil {
			continue
		}

		cardResp := s.buildCardResponse(ctx, card, acc, balances, userId)
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

func (s *CreditCardService) buildCardResponse(ctx context.Context, card *creditcard.CreditCard, acc *account.Account, balances []*creditcard.CardBalance, userId string) *dto.CreditCardResponse {
	var balanceResponses []*dto.BalanceResponse
	for _, b := range balances {
		transactionsBalance, _ := s.accountRepo.BalanceByCurrency(ctx, card.AccountId, userId, b.Currency)
		realBalance := b.CurrentBalance.Add(transactionsBalance)

		balanceCopy := *b
		balanceCopy.CurrentBalance = realBalance
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
		NextCutDate:    calculateNextDate(card.CutDay),
		NextDueDate:    calculateNextDate(card.DueDay),
		CreatedAt:      card.CreatedAt,
		UpdatedAt:      card.UpdatedAt,
	}
}

func calculateNextDate(day int) *time.Time {
	now := time.Now()
	var nextDate time.Time

	if now.Day() < day {
		nextDate = time.Date(now.Year(), now.Month(), day, 0, 0, 0, 0, now.Location())
	} else {
		nextMonth := now.Month() + 1
		nextYear := now.Year()
		if nextMonth > 12 {
			nextMonth = 1
			nextYear++
		}
		daysInMonth := time.Date(nextYear, nextMonth+1, 0, 0, 0, 0, 0, now.Location()).Day()
		if day > daysInMonth {
			day = daysInMonth
		}
		nextDate = time.Date(nextYear, nextMonth, day, 0, 0, 0, 0, now.Location())
	}

	return &nextDate
}
