package postgress

import (
	"context"
	"database/sql"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/rs/zerolog/log"
)

type CreditCardRepository struct {
	db *sql.DB
}

func NewCreditCardRepository(db *sql.DB) *CreditCardRepository {
	return &CreditCardRepository{db: db}
}

func (r *CreditCardRepository) SaveCard(ctx context.Context, card *creditcard.CreditCard) error {
	query := `INSERT INTO credit_cards (account_id, bank, last_four_digits, cut_day, due_day, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query, card.AccountId, card.Bank, card.LastFourDigits,
		card.CutDay, card.DueDay, card.CreatedAt, card.UpdatedAt)
	if err != nil {
		log.Error().Err(err).Str("account_id", card.AccountId).Msg("Failed to save credit card")
	}
	return err
}

func (r *CreditCardRepository) FindCardById(ctx context.Context, accountId string, userId string) (*creditcard.CreditCard, error) {
	query := `SELECT cc.account_id, cc.bank, cc.last_four_digits, cc.cut_day, cc.due_day, cc.created_at, cc.updated_at
		FROM credit_cards cc
		JOIN account a ON cc.account_id = a.id
		WHERE cc.account_id = $1 AND a.user_id = $2`
	row := r.db.QueryRowContext(ctx, query, accountId, userId)

	card := &creditcard.CreditCard{}
	err := row.Scan(&card.AccountId, &card.Bank, &card.LastFourDigits, &card.CutDay, &card.DueDay, &card.CreatedAt, &card.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return card, nil
}

func (r *CreditCardRepository) FindAllCards(ctx context.Context, userId string) ([]*creditcard.CreditCard, error) {
	query := `SELECT cc.account_id, cc.bank, cc.last_four_digits, cc.cut_day, cc.due_day, cc.created_at, cc.updated_at
		FROM credit_cards cc
		JOIN account a ON cc.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY cc.created_at DESC`
	rows, err := r.db.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var cards []*creditcard.CreditCard
	for rows.Next() {
		card := &creditcard.CreditCard{}
		if err = rows.Scan(&card.AccountId, &card.Bank, &card.LastFourDigits, &card.CutDay, &card.DueDay, &card.CreatedAt, &card.UpdatedAt); err == nil {
			cards = append(cards, card)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return cards, nil
}

func (r *CreditCardRepository) UpdateCard(ctx context.Context, card *creditcard.CreditCard) error {
	query := `UPDATE credit_cards SET bank = $1, last_four_digits = $2, cut_day = $3, due_day = $4, updated_at = $5
		WHERE account_id = $6`
	result, err := r.db.ExecContext(ctx, query, card.Bank, card.LastFourDigits, card.CutDay, card.DueDay, time.Now(), card.AccountId)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *CreditCardRepository) DeleteCard(ctx context.Context, accountId string, userId string) error {
	query := `DELETE FROM credit_cards WHERE account_id = $1 AND account_id IN (SELECT id FROM account WHERE user_id = $2)`
	result, err := r.db.ExecContext(ctx, query, accountId, userId)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *CreditCardRepository) SaveBalance(ctx context.Context, balance *creditcard.CardBalance) error {
	query := `INSERT INTO card_balances (id, card_id, currency, current_balance, credit_limit, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query, balance.Id, balance.CardId, balance.Currency, balance.CurrentBalance,
		balance.CreditLimit, balance.CreatedAt, balance.UpdatedAt)
	if err != nil {
		log.Error().Err(err).Str("card_id", balance.CardId).Str("currency", balance.Currency).Msg("Failed to save card balance")
	}
	return err
}

func (r *CreditCardRepository) FindBalanceById(ctx context.Context, id string) (*creditcard.CardBalance, error) {
	query := `SELECT id, card_id, currency, current_balance, credit_limit, created_at, updated_at
		FROM card_balances WHERE id = $1`
	row := r.db.QueryRowContext(ctx, query, id)

	balance := &creditcard.CardBalance{}
	err := row.Scan(&balance.Id, &balance.CardId, &balance.Currency, &balance.CurrentBalance,
		&balance.CreditLimit, &balance.CreatedAt, &balance.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return balance, nil
}

func (r *CreditCardRepository) FindBalancesByCard(ctx context.Context, cardId string) ([]*creditcard.CardBalance, error) {
	query := `SELECT id, card_id, currency, current_balance, credit_limit, created_at, updated_at
		FROM card_balances WHERE card_id = $1 ORDER BY currency`
	rows, err := r.db.QueryContext(ctx, query, cardId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var balances []*creditcard.CardBalance
	for rows.Next() {
		balance := &creditcard.CardBalance{}
		if err = rows.Scan(&balance.Id, &balance.CardId, &balance.Currency, &balance.CurrentBalance,
			&balance.CreditLimit, &balance.CreatedAt, &balance.UpdatedAt); err == nil {
			balances = append(balances, balance)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return balances, nil
}

func (r *CreditCardRepository) FindBalanceByCardAndCurrency(ctx context.Context, cardId string, currency string) (*creditcard.CardBalance, error) {
	query := `SELECT id, card_id, currency, current_balance, credit_limit, created_at, updated_at
		FROM card_balances WHERE card_id = $1 AND currency = $2`
	row := r.db.QueryRowContext(ctx, query, cardId, currency)

	balance := &creditcard.CardBalance{}
	err := row.Scan(&balance.Id, &balance.CardId, &balance.Currency, &balance.CurrentBalance,
		&balance.CreditLimit, &balance.CreatedAt, &balance.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return balance, nil
}

func (r *CreditCardRepository) UpdateBalance(ctx context.Context, balance *creditcard.CardBalance) error {
	query := `UPDATE card_balances SET current_balance = $1, credit_limit = $2, updated_at = $3
		WHERE id = $4`
	result, err := r.db.ExecContext(ctx, query, balance.CurrentBalance, balance.CreditLimit, time.Now(), balance.Id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *CreditCardRepository) DeleteBalance(ctx context.Context, id string) error {
	query := `DELETE FROM card_balances WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *CreditCardRepository) SavePayment(ctx context.Context, payment *creditcard.CardPayment) error {
	query := `INSERT INTO card_payments (id, card_id, from_account_id, currency, amount, includes_interest, interest_amount, payment_date, status, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.db.ExecContext(ctx, query, payment.Id, payment.CardId, payment.FromAccountId, payment.Currency,
		payment.Amount, payment.IncludesInterest, payment.InterestAmount, payment.PaymentDate, payment.Status, payment.Notes, payment.CreatedAt)
	if err != nil {
		log.Error().Err(err).Str("card_id", payment.CardId).Msg("Failed to save card payment")
	}
	return err
}

func (r *CreditCardRepository) FindPaymentById(ctx context.Context, id string) (*creditcard.CardPayment, error) {
	query := `SELECT id, card_id, from_account_id, currency, amount, includes_interest, interest_amount, payment_date, status, notes, created_at
		FROM card_payments WHERE id = $1`
	row := r.db.QueryRowContext(ctx, query, id)

	payment := &creditcard.CardPayment{}
	err := row.Scan(&payment.Id, &payment.CardId, &payment.FromAccountId, &payment.Currency, &payment.Amount,
		&payment.IncludesInterest, &payment.InterestAmount, &payment.PaymentDate, &payment.Status, &payment.Notes, &payment.CreatedAt)
	if err != nil {
		return nil, err
	}
	return payment, nil
}

func (r *CreditCardRepository) FindPaymentsByCard(ctx context.Context, cardId string) ([]*creditcard.CardPayment, error) {
	query := `SELECT id, card_id, from_account_id, currency, amount, includes_interest, interest_amount, payment_date, status, notes, created_at
		FROM card_payments WHERE card_id = $1 ORDER BY payment_date DESC`
	rows, err := r.db.QueryContext(ctx, query, cardId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var payments []*creditcard.CardPayment
	for rows.Next() {
		payment := &creditcard.CardPayment{}
		if err = rows.Scan(&payment.Id, &payment.CardId, &payment.FromAccountId, &payment.Currency, &payment.Amount,
			&payment.IncludesInterest, &payment.InterestAmount, &payment.PaymentDate, &payment.Status, &payment.Notes, &payment.CreatedAt); err == nil {
			payments = append(payments, payment)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}

func (r *CreditCardRepository) FindPaymentsByCardAndCurrency(ctx context.Context, cardId string, currency string) ([]*creditcard.CardPayment, error) {
	query := `SELECT id, card_id, from_account_id, currency, amount, includes_interest, interest_amount, payment_date, status, notes, created_at
		FROM card_payments WHERE card_id = $1 AND currency = $2 ORDER BY payment_date DESC`
	rows, err := r.db.QueryContext(ctx, query, cardId, currency)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var payments []*creditcard.CardPayment
	for rows.Next() {
		payment := &creditcard.CardPayment{}
		if err = rows.Scan(&payment.Id, &payment.CardId, &payment.FromAccountId, &payment.Currency, &payment.Amount,
			&payment.IncludesInterest, &payment.InterestAmount, &payment.PaymentDate, &payment.Status, &payment.Notes, &payment.CreatedAt); err == nil {
			payments = append(payments, payment)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}
