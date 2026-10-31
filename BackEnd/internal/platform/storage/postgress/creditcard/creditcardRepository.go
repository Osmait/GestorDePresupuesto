package postgress

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

// Credit card rows (credit_cards, card_balances, card_payments,
// card_balance_resets) have no user_id column: a card is an `account` row and
// is owned through account.user_id. Every query below is scoped through that
// parent with ownedCardClause.
//
// ownedCardClause restricts `card_id` (or `account_id` for credit_cards) to the
// cards of the user bound to the given placeholder.
func ownedCardClause(column string, placeholder string) string {
	return column + " IN (SELECT id FROM account WHERE user_id = " + placeholder + ")"
}

type CreditCardRepository struct {
	db *sql.DB
}

func NewCreditCardRepository(db *sql.DB) *CreditCardRepository {
	return &CreditCardRepository{db: db}
}

func (r *CreditCardRepository) SaveCard(ctx context.Context, card *creditcard.CreditCard) error {
	query := `INSERT INTO credit_cards (account_id, bank, last_four_digits, cut_day, due_day, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, card.AccountId, card.Bank, card.LastFourDigits,
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
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, accountId, userId)

	card := &creditcard.CreditCard{}
	err := row.Scan(&card.AccountId, &card.Bank, &card.LastFourDigits, &card.CutDay, &card.DueDay, &card.CreatedAt, &card.UpdatedAt)
	if err != nil {
		return nil, ownership.NotFoundIfNoRows(err)
	}
	return card, nil
}

func (r *CreditCardRepository) FindAllCards(ctx context.Context, userId string) ([]*creditcard.CreditCard, error) {
	query := `SELECT cc.account_id, cc.bank, cc.last_four_digits, cc.cut_day, cc.due_day, cc.created_at, cc.updated_at
		FROM credit_cards cc
		JOIN account a ON cc.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY cc.created_at DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userId)
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

func (r *CreditCardRepository) UpdateCard(ctx context.Context, card *creditcard.CreditCard, userId string) error {
	query := `UPDATE credit_cards SET bank = $1, last_four_digits = $2, cut_day = $3, due_day = $4, updated_at = $5
		WHERE account_id = $6 AND ` + ownedCardClause("account_id", "$7")
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, card.Bank, card.LastFourDigits, card.CutDay, card.DueDay, time.Now(), card.AccountId, userId)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}

// DeleteBookkeeping deletes the card account's own bookkeeping transactions
// (initial debt and reset adjustments, payments received): until migration
// 000060 they lived in card_balances and went away with the card. Charges
// stay, so a card with purchases still cannot be deleted (like any account
// with transactions).
func (r *CreditCardRepository) DeleteBookkeeping(ctx context.Context, cardId string, userId string) error {
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx,
		`DELETE FROM transactions WHERE account_id = $1 AND user_id = $2
		 AND type_transation::text IN ('adjustment_in', 'adjustment_out', 'card_payment_received')`, cardId, userId)
	return err
}

func (r *CreditCardRepository) DeleteCard(ctx context.Context, accountId string, userId string) error {
	query := `DELETE FROM credit_cards WHERE account_id = $1 AND ` + ownedCardClause("account_id", "$2")
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, accountId, userId)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}

// SaveBalance stores a card currency with its credit limit. The card's
// balance is the ledger of the card account (migration 000060), so
// current_balance is always stored as 0 and balance.CurrentBalance is ignored;
// write an initial debt as an adjustment transaction.
func (r *CreditCardRepository) SaveBalance(ctx context.Context, balance *creditcard.CardBalance) error {
	query := `INSERT INTO card_balances (id, card_id, currency, current_balance, credit_limit, created_at, updated_at)
		VALUES ($1, $2, $3, 0, $4, $5, $6)`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, balance.Id, balance.CardId, balance.Currency,
		balance.CreditLimit, balance.CreatedAt, balance.UpdatedAt)
	if err != nil {
		log.Error().Err(err).Str("card_id", balance.CardId).Str("currency", balance.Currency).Msg("Failed to save card balance")
	}
	return err
}

func (r *CreditCardRepository) FindBalanceById(ctx context.Context, id string, userId string) (*creditcard.CardBalance, error) {
	query := `SELECT id, card_id, currency, current_balance, credit_limit, created_at, updated_at
		FROM card_balances WHERE id = $1 AND ` + ownedCardClause("card_id", "$2")
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, id, userId)

	balance := &creditcard.CardBalance{}
	err := row.Scan(&balance.Id, &balance.CardId, &balance.Currency, &balance.CurrentBalance,
		&balance.CreditLimit, &balance.CreatedAt, &balance.UpdatedAt)
	if err != nil {
		return nil, ownership.NotFoundIfNoRows(err)
	}
	return balance, nil
}

func (r *CreditCardRepository) FindBalancesByCard(ctx context.Context, cardId string, userId string) ([]*creditcard.CardBalance, error) {
	query := `SELECT id, card_id, currency, current_balance, credit_limit, created_at, updated_at
		FROM card_balances WHERE card_id = $1 AND ` + ownedCardClause("card_id", "$2") + ` ORDER BY currency`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, cardId, userId)
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

// FindBalancesByCards is FindBalancesByCard for several cards in one query,
// keyed by card id; each card's balances are ordered by currency and a card
// without balances is absent from the map.
func (r *CreditCardRepository) FindBalancesByCards(ctx context.Context, cardIds []string, userId string) (map[string][]*creditcard.CardBalance, error) {
	balances := make(map[string][]*creditcard.CardBalance)
	if len(cardIds) == 0 {
		return balances, nil
	}
	query := `SELECT id, card_id, currency, current_balance, credit_limit, created_at, updated_at
		FROM card_balances WHERE card_id = ANY($1::varchar[]) AND ` + ownedCardClause("card_id", "$2") + ` ORDER BY card_id, currency`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, pq.Array(cardIds), userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	for rows.Next() {
		balance := &creditcard.CardBalance{}
		if err = rows.Scan(&balance.Id, &balance.CardId, &balance.Currency, &balance.CurrentBalance,
			&balance.CreditLimit, &balance.CreatedAt, &balance.UpdatedAt); err == nil {
			balances[balance.CardId] = append(balances[balance.CardId], balance)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return balances, nil
}

func (r *CreditCardRepository) FindBalanceByCardAndCurrency(ctx context.Context, cardId string, userId string, currency string) (*creditcard.CardBalance, error) {
	query := `SELECT id, card_id, currency, current_balance, credit_limit, created_at, updated_at
		FROM card_balances WHERE card_id = $1 AND currency = $2 AND ` + ownedCardClause("card_id", "$3")
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, cardId, currency, userId)

	balance := &creditcard.CardBalance{}
	err := row.Scan(&balance.Id, &balance.CardId, &balance.Currency, &balance.CurrentBalance,
		&balance.CreditLimit, &balance.CreatedAt, &balance.UpdatedAt)
	if err != nil {
		return nil, ownership.NotFoundIfNoRows(err)
	}
	return balance, nil
}

// UpdateCreditLimit changes only the credit limit of balance `id`. The
// current balance is deliberately never written from an in-memory struct:
// doing so would overwrite concurrent payments (lost update). Use
// AdjustBalance / ResetBalance to change it atomically.
func (r *CreditCardRepository) UpdateCreditLimit(ctx context.Context, id string, userId string, creditLimit money.Amount) (*creditcard.CardBalance, error) {
	query := `UPDATE card_balances SET credit_limit = $1, updated_at = $2
		WHERE id = $3 AND ` + ownedCardClause("card_id", "$4") + `
		RETURNING id, card_id, currency, current_balance, credit_limit, created_at, updated_at`
	balance := &creditcard.CardBalance{}
	err := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, creditLimit, time.Now(), id, userId).
		Scan(&balance.Id, &balance.CardId, &balance.Currency, &balance.CurrentBalance, &balance.CreditLimit, &balance.CreatedAt, &balance.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ownership.ErrNotFound
		}
		return nil, err
	}
	return balance, nil
}

func (r *CreditCardRepository) DeleteBalance(ctx context.Context, id string, userId string) error {
	query := `DELETE FROM card_balances WHERE id = $1 AND ` + ownedCardClause("card_id", "$2")
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, id, userId)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}

func (r *CreditCardRepository) SaveBalanceReset(ctx context.Context, reset *creditcard.CardBalanceReset) error {
	query := `INSERT INTO card_balance_resets (id, balance_id, card_id, currency, previous_balance, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, reset.Id, reset.BalanceId, reset.CardId,
		reset.Currency, reset.PreviousBalance, reset.Notes, reset.CreatedAt)
	if err != nil {
		log.Error().Err(err).Str("card_id", reset.CardId).Str("balance_id", reset.BalanceId).Msg("Failed to save card balance reset")
	}
	return err
}

func (r *CreditCardRepository) FindBalanceResetsByCard(ctx context.Context, cardId string, userId string) ([]*creditcard.CardBalanceReset, error) {
	query := `SELECT id, balance_id, card_id, currency, previous_balance, COALESCE(notes, ''), created_at
		FROM card_balance_resets WHERE card_id = $1 AND ` + ownedCardClause("card_id", "$2") + ` ORDER BY created_at DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, cardId, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var resets []*creditcard.CardBalanceReset
	for rows.Next() {
		reset := &creditcard.CardBalanceReset{}
		if err = rows.Scan(&reset.Id, &reset.BalanceId, &reset.CardId, &reset.Currency,
			&reset.PreviousBalance, &reset.Notes, &reset.CreatedAt); err == nil {
			resets = append(resets, reset)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return resets, nil
}

// SavePayment stores a card payment. Both the card and the paying account must
// belong to userId, otherwise ownership.ErrReferenceNotOwned is returned.
func (r *CreditCardRepository) SavePayment(ctx context.Context, payment *creditcard.CardPayment, userId string) error {
	q := txhelper.FromContext(ctx, r.db)
	if err := ownership.VerifyReferences(ctx, q, userId,
		ownership.Reference{Table: ownership.Account, ID: payment.CardId},
		ownership.Reference{Table: ownership.Account, ID: payment.FromAccountId},
	); err != nil {
		return err
	}

	query := `INSERT INTO card_payments (id, card_id, from_account_id, currency, amount, source_currency, source_amount, exchange_rate, includes_interest, interest_amount, payment_date, status, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
	_, err := q.ExecContext(ctx, query, payment.Id, payment.CardId, payment.FromAccountId, payment.Currency,
		payment.Amount, payment.SourceCurrency, payment.SourceAmount, payment.ExchangeRate, payment.IncludesInterest, payment.InterestAmount, payment.PaymentDate, payment.Status, payment.Notes, payment.CreatedAt)
	if err != nil {
		log.Error().Err(err).Str("card_id", payment.CardId).Msg("Failed to save card payment")
	}
	return err
}

func (r *CreditCardRepository) DeletePayment(ctx context.Context, id string, userId string) error {
	query := `DELETE FROM card_payments WHERE id = $1 AND ` + ownedCardClause("card_id", "$2")
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, id, userId)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}

func (r *CreditCardRepository) FindPaymentById(ctx context.Context, id string, userId string) (*creditcard.CardPayment, error) {
	query := `SELECT id, card_id, from_account_id, currency, amount, COALESCE(source_currency, ''), COALESCE(source_amount, 0), COALESCE(exchange_rate, 1), includes_interest, interest_amount, payment_date, status, notes, created_at
		FROM card_payments WHERE id = $1 AND ` + ownedCardClause("card_id", "$2")
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, id, userId)

	payment := &creditcard.CardPayment{}
	err := row.Scan(&payment.Id, &payment.CardId, &payment.FromAccountId, &payment.Currency, &payment.Amount,
		&payment.SourceCurrency, &payment.SourceAmount, &payment.ExchangeRate, &payment.IncludesInterest, &payment.InterestAmount, &payment.PaymentDate, &payment.Status, &payment.Notes, &payment.CreatedAt)
	if err != nil {
		return nil, ownership.NotFoundIfNoRows(err)
	}
	return payment, nil
}

func (r *CreditCardRepository) FindPaymentsByCard(ctx context.Context, cardId string, userId string) ([]*creditcard.CardPayment, error) {
	query := `SELECT id, card_id, from_account_id, currency, amount, COALESCE(source_currency, ''), COALESCE(source_amount, 0), COALESCE(exchange_rate, 1), includes_interest, interest_amount, payment_date, status, notes, created_at
		FROM card_payments WHERE card_id = $1 AND ` + ownedCardClause("card_id", "$2") + ` ORDER BY payment_date DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, cardId, userId)
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
			&payment.SourceCurrency, &payment.SourceAmount, &payment.ExchangeRate, &payment.IncludesInterest, &payment.InterestAmount, &payment.PaymentDate, &payment.Status, &payment.Notes, &payment.CreatedAt); err == nil {
			payments = append(payments, payment)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}

func (r *CreditCardRepository) FindPaymentsByCardAndCurrency(ctx context.Context, cardId string, userId string, currency string) ([]*creditcard.CardPayment, error) {
	query := `SELECT id, card_id, from_account_id, currency, amount, COALESCE(source_currency, ''), COALESCE(source_amount, 0), COALESCE(exchange_rate, 1), includes_interest, interest_amount, payment_date, status, notes, created_at
		FROM card_payments WHERE card_id = $1 AND currency = $2 AND ` + ownedCardClause("card_id", "$3") + ` ORDER BY payment_date DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, cardId, currency, userId)
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
			&payment.SourceCurrency, &payment.SourceAmount, &payment.ExchangeRate, &payment.IncludesInterest, &payment.InterestAmount, &payment.PaymentDate, &payment.Status, &payment.Notes, &payment.CreatedAt); err == nil {
			payments = append(payments, payment)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}

func (r *CreditCardRepository) GetTotalPaymentsByCardAndCurrency(ctx context.Context, cardId string, userId string, currency string) (money.Amount, error) {
	query := `SELECT COALESCE(SUM(amount), 0) FROM card_payments WHERE card_id = $1 AND currency = $2 AND status = 'completed' AND ` + ownedCardClause("card_id", "$3")
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, cardId, currency, userId)

	var total money.Amount
	err := row.Scan(&total)
	if err != nil {
		return money.Zero, err
	}
	return total, nil
}

// PaymentCategoryName is the default-locale (Spanish) name of the category
// given to the transactions generated by a card payment (the debit on the
// paying account and any interest charge). The name is localized when the
// category is created; the category is always looked up by its id.
const PaymentCategoryName = "Pago de tarjeta"

// PaymentCategoryID is the deterministic id of a user's card payment
// category. It matches the id used by migration 000030 when it backfilled
// card payment transactions, so both paths share one category per user.
func PaymentCategoryID(userId string) string {
	return category.SystemCardPayment.ID(userId)
}

// EnsurePaymentCategory returns the user's card payment category: the row
// with the deterministic id, else a pre-existing one with a known name
// ("Pago de tarjeta"/"Card payment"), else a new one named in the request's
// locale. Concurrent first calls converge on the same row.
func (r *CreditCardRepository) EnsurePaymentCategory(ctx context.Context, userId string) (string, error) {
	return categoryRepo.EnsureSystem(ctx, txhelper.FromContext(ctx, r.db), userId, category.SystemCardPayment)
}

// EnsureAdjustmentCategory returns the user's "Ajuste de saldo" system
// category (initial card debt, card resets).
func (r *CreditCardRepository) EnsureAdjustmentCategory(ctx context.Context, userId string) (string, error) {
	return categoryRepo.EnsureSystem(ctx, txhelper.FromContext(ctx, r.db), userId, category.SystemBalanceAdjustment)
}
