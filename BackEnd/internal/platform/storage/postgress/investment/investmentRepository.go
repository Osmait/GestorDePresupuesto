package postgress

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

type InvestmentRepository struct {
	db *sql.DB
}

var ErrInsufficientFunding = errors.New("insufficient investment funding balance")

func NewInvestmentRepository(db *sql.DB) *InvestmentRepository {
	return &InvestmentRepository{db: db}
}

func (r *InvestmentRepository) Save(ctx context.Context, investment *investment.Investment) error {
	if err := ownership.VerifyReference(ctx, txhelper.FromContext(ctx, r.db), investment.UserID, ownership.Account, investment.SourceAccountID); err != nil {
		return err
	}
	query := `INSERT INTO investments (id, user_id, investment_type, name, symbol, quantity, purchase_price, current_price, source_account_id, source_amount, settlement_currency, exchange_rate, created_at, updated_at)
	              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), $10, NULLIF($11, ''), NULLIF($12::numeric, 0), $13, $14)`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, investment.ID, investment.UserID, investment.Type, investment.Name, investment.Symbol, investment.Quantity, investment.PurchasePrice, investment.CurrentPrice, investment.SourceAccountID, investment.SourceAmount, investment.SettlementCurrency, investment.ExchangeRate, investment.CreatedAt, investment.UpdatedAt)
	if err != nil {
		return fmt.Errorf("error saving investment: %w", err)
	}
	return nil
}

func (r *InvestmentRepository) FindAll(ctx context.Context, userId string) ([]*investment.Investment, error) {
	query := `SELECT id, user_id, investment_type, name, symbol, quantity, purchase_price, current_price, COALESCE(source_account_id, ''), COALESCE(source_amount, 0), COALESCE(settlement_currency, ''), COALESCE(exchange_rate, 0), created_at, updated_at FROM investments WHERE user_id = $1`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userId)
	if err != nil {
		return nil, fmt.Errorf("error finding investments: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var investments []*investment.Investment
	for rows.Next() {
		var i investment.Investment
		if err := rows.Scan(&i.ID, &i.UserID, &i.Type, &i.Name, &i.Symbol, &i.Quantity, &i.PurchasePrice, &i.CurrentPrice, &i.SourceAccountID, &i.SourceAmount, &i.SettlementCurrency, &i.ExchangeRate, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, fmt.Errorf("error scanning investment: %w", err)
		}
		investments = append(investments, &i)
	}
	return investments, nil
}

// FindByID returns the investment `id` owned by userId, or ownership.ErrNotFound.
func (r *InvestmentRepository) FindByID(ctx context.Context, id string, userId string) (*investment.Investment, error) {
	return r.findByID(ctx, id, userId, false)
}

// FindByIDForUpdate is FindByID plus a row lock (SELECT ... FOR UPDATE) held
// until the request transaction ends.
func (r *InvestmentRepository) FindByIDForUpdate(ctx context.Context, id string, userId string) (*investment.Investment, error) {
	return r.findByID(ctx, id, userId, true)
}

// UpdateCurrentPrice sets only the market price of investment `id`, leaving
// quantity, cost and funding columns untouched.
func (r *InvestmentRepository) UpdateCurrentPrice(ctx context.Context, id string, userId string, price money.Amount) error {
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx,
		`UPDATE investments SET current_price = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`,
		price, time.Now(), id, userId)
	if err != nil {
		return fmt.Errorf("error updating investment price: %w", err)
	}
	return ownership.RequireAffected(result)
}

func (r *InvestmentRepository) findByID(ctx context.Context, id string, userId string, forUpdate bool) (*investment.Investment, error) {
	query := `SELECT id, user_id, investment_type, name, symbol, quantity, purchase_price, current_price, COALESCE(source_account_id, ''), COALESCE(source_amount, 0), COALESCE(settlement_currency, ''), COALESCE(exchange_rate, 0), created_at, updated_at FROM investments WHERE id = $1 AND user_id = $2`
	if forUpdate {
		query += " FOR UPDATE"
	}
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, id, userId)

	var i investment.Investment
	if err := row.Scan(&i.ID, &i.UserID, &i.Type, &i.Name, &i.Symbol, &i.Quantity, &i.PurchasePrice, &i.CurrentPrice, &i.SourceAccountID, &i.SourceAmount, &i.SettlementCurrency, &i.ExchangeRate, &i.CreatedAt, &i.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ownership.ErrNotFound
		}
		return nil, fmt.Errorf("error finding investment by id: %w", err)
	}
	return &i, nil
}

// Update rewrites an investment owned by investment.UserID. It returns
// ownership.ErrNotFound when the row does not exist or belongs to another user
// and ownership.ErrReferenceNotOwned when source_account_id is not the user's.
func (r *InvestmentRepository) Update(ctx context.Context, investment *investment.Investment) error {
	q := txhelper.FromContext(ctx, r.db)
	if investment.UserID == "" {
		return ownership.ErrNotFound
	}
	if err := ownership.VerifyReference(ctx, q, investment.UserID, ownership.Account, investment.SourceAccountID); err != nil {
		return err
	}
	query := `UPDATE investments SET investment_type = $1, name = $2, symbol = $3, quantity = $4, purchase_price = $5, current_price = $6, source_account_id = NULLIF($7, ''), source_amount = $8, settlement_currency = NULLIF($9, ''), exchange_rate = NULLIF($10::numeric, 0), updated_at = $11 WHERE id = $12 AND user_id = $13`
	result, err := q.ExecContext(ctx, query, investment.Type, investment.Name, investment.Symbol, investment.Quantity, investment.PurchasePrice, investment.CurrentPrice, investment.SourceAccountID, investment.SourceAmount, investment.SettlementCurrency, investment.ExchangeRate, time.Now(), investment.ID, investment.UserID)
	if err != nil {
		return fmt.Errorf("error updating investment: %w", err)
	}
	return ownership.RequireAffected(result)
}

// Delete removes the investment `id` owned by userId, or returns ownership.ErrNotFound.
func (r *InvestmentRepository) Delete(ctx context.Context, id string, userId string) error {
	query := `DELETE FROM investments WHERE id = $1 AND user_id = $2`
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, id, userId)
	if err != nil {
		return fmt.Errorf("error deleting investment: %w", err)
	}
	return ownership.RequireAffected(result)
}

func (r *InvestmentRepository) GetFundingBalances(ctx context.Context, userId string) ([]*investment.FundingBalance, error) {
	query := `SELECT currency, available_amount FROM investment_funding_balances WHERE user_id = $1 ORDER BY currency`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userId)
	if err != nil {
		return nil, fmt.Errorf("error loading funding balances: %w", err)
	}
	defer func() { _ = rows.Close() }()

	balances := make([]*investment.FundingBalance, 0)
	for rows.Next() {
		balance := &investment.FundingBalance{}
		if err := rows.Scan(&balance.Currency, &balance.Available); err != nil {
			return nil, fmt.Errorf("error scanning funding balance: %w", err)
		}
		balances = append(balances, balance)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating funding balances: %w", err)
	}

	return balances, nil
}

func (r *InvestmentRepository) AddFunding(ctx context.Context, movement *investment.FundingMovement) error {
	if movement == nil {
		return errors.New("funding movement is required")
	}

	currency := strings.ToUpper(strings.TrimSpace(movement.Currency))
	if currency == "" {
		return errors.New("currency is required")
	}

	amount := movement.Amount
	if amount.IsZero() {
		return errors.New("amount must be different from zero")
	}

	if movement.CreatedAt.IsZero() {
		movement.CreatedAt = time.Now()
	}

	// Both writes run in the request transaction (or a local one) so the
	// movement and the balance can never diverge. The balance is updated with
	// a single atomic upsert, never read-modify-write.
	return txhelper.InTx(ctx, r.db, func(tx txhelper.Querier) error {
		_, err := tx.ExecContext(
			ctx,
			`INSERT INTO investment_funding_movements (id, user_id, currency, amount, movement_type, description, reference_type, reference_id, counter_currency, counter_amount, exchange_rate, created_at)
			 VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),$10,NULLIF($11::numeric,0),$12)`,
			movement.ID,
			movement.UserID,
			currency,
			amount,
			movement.MovementType,
			movement.Description,
			movement.ReferenceType,
			movement.ReferenceID,
			strings.ToUpper(strings.TrimSpace(movement.CounterCurrency)),
			movement.CounterAmount,
			movement.ExchangeRate,
			movement.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("error inserting funding movement: %w", err)
		}

		_, err = tx.ExecContext(
			ctx,
			`INSERT INTO investment_funding_balances (user_id, currency, available_amount, updated_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (user_id, currency)
			 DO UPDATE SET
			   available_amount = investment_funding_balances.available_amount + EXCLUDED.available_amount,
			   updated_at = EXCLUDED.updated_at`,
			movement.UserID,
			currency,
			amount,
			time.Now(),
		)
		if err != nil {
			return fmt.Errorf("error updating funding balance: %w", err)
		}
		return nil
	})
}

// AdjustFundingForInvestment moves delta between userId's wallet in currency
// and investment investmentID: a positive delta is debited from the wallet
// (an atomic conditional decrement, so it fails with ErrInsufficientFunding
// instead of going negative), a negative one is credited back. The movement
// is recorded as an "adjustment" referencing the investment. A zero delta is
// a no-op.
func (r *InvestmentRepository) AdjustFundingForInvestment(ctx context.Context, userId, investmentID, currency string, delta money.Amount, description string) error {
	if delta.IsZero() {
		return nil
	}
	resolvedCurrency := strings.ToUpper(strings.TrimSpace(currency))
	if resolvedCurrency == "" {
		return errors.New("currency is required")
	}

	return txhelper.InTx(ctx, r.db, func(tx txhelper.Querier) error {
		now := time.Now()
		if delta.IsPositive() {
			var remaining money.Amount
			err := tx.QueryRowContext(ctx,
				`UPDATE investment_funding_balances
				 SET available_amount = available_amount - $1, updated_at = $2
				 WHERE user_id = $3 AND currency = $4 AND available_amount >= $1
				 RETURNING available_amount`,
				delta, now, userId, resolvedCurrency,
			).Scan(&remaining)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					return ErrInsufficientFunding
				}
				return fmt.Errorf("error updating funding balance: %w", err)
			}
		} else {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO investment_funding_balances (user_id, currency, available_amount, updated_at)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (user_id, currency)
				 DO UPDATE SET
				   available_amount = investment_funding_balances.available_amount + EXCLUDED.available_amount,
				   updated_at = EXCLUDED.updated_at`,
				userId, resolvedCurrency, delta.Neg(), now,
			); err != nil {
				return fmt.Errorf("error updating funding balance: %w", err)
			}
		}

		movementID := fmt.Sprintf("%s-adjustment-%d", investmentID, now.UnixNano())
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO investment_funding_movements (id, user_id, currency, amount, movement_type, description, reference_type, reference_id, created_at)
			 VALUES ($1,$2,$3,$4,'adjustment',$5,'investment',$6,$7)`,
			movementID, userId, resolvedCurrency, delta.Neg(), description, investmentID, now,
		); err != nil {
			return fmt.Errorf("error saving adjustment movement: %w", err)
		}
		return nil
	})
}

func (r *InvestmentRepository) ConsumeFundingForInvestment(ctx context.Context, inv *investment.Investment, currency string, requiredAmount money.Amount) error {
	if inv == nil {
		return errors.New("investment is required")
	}
	if !requiredAmount.IsPositive() {
		return errors.New("required amount must be greater than zero")
	}

	resolvedCurrency := strings.ToUpper(strings.TrimSpace(currency))
	if resolvedCurrency == "" {
		return errors.New("currency is required")
	}

	return txhelper.InTx(ctx, r.db, func(tx txhelper.Querier) error {
		// Atomic conditional decrement: the row lock taken by UPDATE serialises
		// concurrent purchases, and the WHERE clause re-checks the balance on
		// the locked row, so the wallet can never go negative.
		var remaining money.Amount
		err := tx.QueryRowContext(ctx,
			`UPDATE investment_funding_balances
			 SET available_amount = available_amount - $1,
			     updated_at = $2
			 WHERE user_id = $3 AND currency = $4 AND available_amount >= $1
			 RETURNING available_amount`,
			requiredAmount,
			time.Now(),
			inv.UserID,
			resolvedCurrency,
		).Scan(&remaining)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrInsufficientFunding
			}
			return fmt.Errorf("error updating funding balance: %w", err)
		}

		var existingID string
		var existingQuantity money.Amount
		var existingPurchasePrice money.Amount
		var existingSourceAmount money.Amount

		err = tx.QueryRowContext(
			ctx,
			`SELECT id, quantity, purchase_price, COALESCE(source_amount, 0)
			 FROM investments
			 WHERE user_id = $1
			   AND UPPER(symbol) = UPPER($2)
			   AND investment_type = $3
			   AND COALESCE(settlement_currency, '') = COALESCE($4, '')
			 LIMIT 1
			 FOR UPDATE`,
			inv.UserID,
			strings.TrimSpace(inv.Symbol),
			inv.Type,
			strings.TrimSpace(inv.SettlementCurrency),
		).Scan(&existingID, &existingQuantity, &existingPurchasePrice, &existingSourceAmount)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("error loading existing investment position: %w", err)
		}

		referenceInvestmentID := inv.ID
		if errors.Is(err, sql.ErrNoRows) {
			_, err = tx.ExecContext(
				ctx,
				`INSERT INTO investments (id, user_id, investment_type, name, symbol, quantity, purchase_price, current_price, source_account_id, source_amount, settlement_currency, exchange_rate, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), $10, NULLIF($11, ''), NULLIF($12::numeric, 0), $13, $14)`,
				inv.ID,
				inv.UserID,
				inv.Type,
				inv.Name,
				inv.Symbol,
				inv.Quantity,
				inv.PurchasePrice,
				inv.CurrentPrice,
				inv.SourceAccountID,
				inv.SourceAmount,
				inv.SettlementCurrency,
				inv.ExchangeRate,
				inv.CreatedAt,
				inv.UpdatedAt,
			)
			if err != nil {
				return fmt.Errorf("error saving investment with funding consumption: %w", err)
			}
		} else {
			referenceInvestmentID = existingID
			newQuantity := existingQuantity.Add(inv.Quantity)
			if !newQuantity.IsPositive() {
				return fmt.Errorf("invalid resulting quantity for investment position")
			}
			// Weighted average cost, computed exactly and rounded half-even to
			// the unit-price scale.
			newAveragePrice := existingQuantity.Mul(existingPurchasePrice).
				Add(inv.Quantity.Mul(inv.PurchasePrice)).
				Div(newQuantity).
				Round(money.PriceScale)
			newSourceAmount := existingSourceAmount.Add(inv.SourceAmount)

			_, err = tx.ExecContext(
				ctx,
				`UPDATE investments
				 SET name = $1,
				     symbol = $2,
				     quantity = $3,
				     purchase_price = $4,
				     current_price = $5,
				     source_amount = $6,
				     source_account_id = NULLIF($7, ''),
				     exchange_rate = NULLIF($8::numeric, 0),
				     updated_at = $9
				 WHERE id = $10 AND user_id = $11`,
				inv.Name,
				inv.Symbol,
				newQuantity,
				newAveragePrice,
				inv.CurrentPrice,
				newSourceAmount,
				inv.SourceAccountID,
				inv.ExchangeRate,
				time.Now(),
				existingID,
				inv.UserID,
			)
			if err != nil {
				return fmt.Errorf("error updating existing investment position: %w", err)
			}
		}

		movementID := fmt.Sprintf("%s-purchase-%d", referenceInvestmentID, time.Now().UnixNano())
		_, err = tx.ExecContext(
			ctx,
			`INSERT INTO investment_funding_movements (id, user_id, currency, amount, movement_type, description, reference_type, reference_id, created_at)
			 VALUES ($1,$2,$3,$4,'purchase',$5,'investment',$6,$7)`,
			movementID,
			inv.UserID,
			resolvedCurrency,
			requiredAmount.Neg(),
			"Investment purchase - "+strings.ToUpper(strings.TrimSpace(inv.Symbol)),
			referenceInvestmentID,
			time.Now(),
		)
		if err != nil {
			return fmt.Errorf("error saving purchase movement: %w", err)
		}
		return nil
	})
}
