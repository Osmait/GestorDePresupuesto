package creditcard

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	cardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

type TransactionServiceInterface interface {
	CreateTransaction(ctx context.Context, name, description string, amount float64, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error
}

type AccountRepositoryInterface interface {
	Save(ctx context.Context, account *account.Account) error
	FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error)
	Delete(ctx context.Context, id string, userId string) error
	BalanceByCurrency(ctx context.Context, id string, currency string) (float64, error)
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
		balance.CurrentBalance = -balanceReq.InitialDebt
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
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("credit card not found")
		}
		return nil, err
	}

	acc, err := s.accountRepo.FindByIdAndUserId(ctx, accountId, userId)
	if err != nil {
		return nil, err
	}

	balances, err := s.cardRepo.FindBalancesByCard(ctx, accountId)
	if err != nil {
		return nil, err
	}

	return s.buildCardResponse(ctx, card, acc, balances), nil
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
		balances, err := s.cardRepo.FindBalancesByCard(ctx, card.AccountId)
		if err != nil {
			continue
		}
		responses = append(responses, s.buildCardResponse(ctx, card, acc, balances))
	}
	return responses, nil
}

func (s *CreditCardService) UpdateCreditCard(ctx context.Context, accountId string, req *dto.UpdateCreditCardRequest, userId string) (*dto.CreditCardResponse, error) {
	card, err := s.cardRepo.FindCardById(ctx, accountId, userId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("credit card not found")
		}
		return nil, err
	}

	acc, err := s.accountRepo.FindByIdAndUserId(ctx, accountId, userId)
	if err != nil {
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

	if err := s.cardRepo.UpdateCard(ctx, card); err != nil {
		return nil, err
	}

	return s.FindCardById(ctx, accountId, userId)
}

func (s *CreditCardService) DeleteCreditCard(ctx context.Context, accountId string, userId string) error {
	if err := s.cardRepo.DeleteCard(ctx, accountId, userId); err != nil {
		return err
	}
	return s.accountRepo.Delete(ctx, accountId, userId)
}

func (s *CreditCardService) UpdateBalance(ctx context.Context, balanceId string, req *dto.UpdateBalanceRequest) (*dto.BalanceResponse, error) {
	balance, err := s.cardRepo.FindBalanceById(ctx, balanceId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("balance not found")
		}
		return nil, err
	}

	if req.CreditLimit != nil {
		balance.CreditLimit = *req.CreditLimit
	}
	balance.UpdatedAt = time.Now()

	if err := s.cardRepo.UpdateBalance(ctx, balance); err != nil {
		return nil, err
	}

	return dto.NewBalanceResponse(balance), nil
}

func (s *CreditCardService) CreatePayment(ctx context.Context, cardId string, userId string, req *dto.CreatePaymentRequest) (*dto.PaymentResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	balance, err := s.cardRepo.FindBalanceByCardAndCurrency(ctx, cardId, req.Currency)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("balance not found for this currency")
		}
		return nil, err
	}

	fromAccount, err := s.accountRepo.FindByIdAndUserId(ctx, req.FromAccountId, userId)
	if err != nil {
		return nil, errors.New("source account not found")
	}
	if fromAccount.UserId != userId {
		return nil, errors.New("unauthorized: source account does not belong to user")
	}

	fromCurrency := fromAccount.Currency
	if fromCurrency == "" {
		fromCurrency = "DOP"
	}

	sourceAmount, err := convertPaymentAmount(req.Amount, req.Currency, fromCurrency, req.ExchangeRate)
	if err != nil {
		return nil, err
	}

	uuid, _ := ksuid.NewRandom()
	payment := creditcard.NewCardPayment(uuid.String(), cardId, req.FromAccountId, req.Currency, req.Amount)
	payment.SourceCurrency = fromCurrency
	payment.SourceAmount = sourceAmount
	payment.ExchangeRate = req.ExchangeRate
	if payment.ExchangeRate == 0 {
		payment.ExchangeRate = 1
	}
	payment.IncludesInterest = req.IncludesInterest
	payment.InterestAmount = req.InterestAmount
	payment.Notes = req.Notes

	if err := s.cardRepo.SavePayment(ctx, payment); err != nil {
		return nil, err
	}

	balance.CurrentBalance += req.Amount
	balance.UpdatedAt = time.Now()
	if err := s.cardRepo.UpdateBalance(ctx, balance); err != nil {
		log.Error().Err(err).Msg("Failed to update balance after payment")
	}

	card, _ := s.cardRepo.FindCardById(ctx, cardId, userId)
	cardName := "Credit Card"
	if card != nil {
		cardName = card.Bank + " Card"
	}
	transactionDesc := "Payment to " + cardName
	if req.Notes != "" {
		transactionDesc += " - " + req.Notes
	}
	_ = s.transactionRepo.CreateTransaction(ctx, "Card Payment", transactionDesc, sourceAmount, "bill", req.FromAccountId, userId, "", "", fromCurrency, time.Now())

	if req.IncludesInterest && req.InterestAmount > 0 {
		interestSourceAmount, convErr := convertPaymentAmount(req.InterestAmount, req.Currency, fromCurrency, req.ExchangeRate)
		if convErr != nil {
			interestSourceAmount = req.InterestAmount
		}
		_ = s.transactionRepo.CreateTransaction(ctx, "Interest Charge", "Interest paid to "+cardName, interestSourceAmount, "bill", req.FromAccountId, userId, "", "", fromCurrency, time.Now())
	}

	log.Info().Str("card_id", cardId).Str("user_id", userId).Float64("amount", req.Amount).Msg("Card payment created")
	return dto.NewPaymentResponse(payment), nil
}

func convertPaymentAmount(cardAmount float64, cardCurrency string, sourceCurrency string, rate float64) (float64, error) {
	if cardCurrency == sourceCurrency {
		return cardAmount, nil
	}
	if rate <= 0 {
		return 0, errors.New("exchange_rate is required when paying with a different currency")
	}

	if cardCurrency == "USD" && sourceCurrency == "DOP" {
		return cardAmount * rate, nil
	}
	if cardCurrency == "DOP" && sourceCurrency == "USD" {
		return cardAmount / rate, nil
	}

	return 0, fmt.Errorf("unsupported currency conversion from %s to %s", sourceCurrency, cardCurrency)
}

func (s *CreditCardService) FindPaymentsByCard(ctx context.Context, cardId string, userId string) ([]*dto.PaymentResponse, error) {
	_, err := s.cardRepo.FindCardById(ctx, cardId, userId)
	if err != nil {
		return nil, err
	}

	payments, err := s.cardRepo.FindPaymentsByCard(ctx, cardId)
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
		TotalDebt:        make(map[string]float64),
		TotalCreditLimit: make(map[string]float64),
		AvgUtilization:   make(map[string]float64),
		ByCard:           []*dto.CreditCardResponse{},
	}

	currencyCardCount := make(map[string]int)

	for _, card := range cards {
		acc, err := s.accountRepo.FindByIdAndUserId(ctx, card.AccountId, userId)
		if err != nil {
			continue
		}
		balances, err := s.cardRepo.FindBalancesByCard(ctx, card.AccountId)
		if err != nil {
			continue
		}

		cardResp := s.buildCardResponse(ctx, card, acc, balances)
		summary.ByCard = append(summary.ByCard, cardResp)
		summary.TotalCards++

		for _, b := range cardResp.Balances {
			currency := b.Currency
			debt := -b.CurrentBalance
			if debt < 0 {
				debt = 0
			}
			summary.TotalDebt[currency] += debt
			summary.TotalCreditLimit[currency] += b.CreditLimit
			currencyCardCount[currency]++
		}
	}

	for currency, count := range currencyCardCount {
		if count > 0 {
			summary.AvgUtilization[currency] = summary.TotalDebt[currency] / summary.TotalCreditLimit[currency] * 100
		}
	}

	return summary, nil
}

func (s *CreditCardService) buildCardResponse(ctx context.Context, card *creditcard.CreditCard, acc *account.Account, balances []*creditcard.CardBalance) *dto.CreditCardResponse {
	var balanceResponses []*dto.BalanceResponse
	for _, b := range balances {
		transactionsBalance, _ := s.accountRepo.BalanceByCurrency(ctx, card.AccountId, b.Currency)
		realBalance := b.CurrentBalance + transactionsBalance

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
