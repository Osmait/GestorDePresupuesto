package monthly_plan

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/osmait/gestorDePresupuesto/internal/domain/monthly_plan"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

const selectColumns = `id, user_id, name, description, amount, currency, type,
	category_id, account_id, day_of_month, is_active, created_at, updated_at`

type MonthlyPlanRepository struct {
	db *sql.DB
}

func NewMonthlyPlanRepository(db *sql.DB) *MonthlyPlanRepository {
	return &MonthlyPlanRepository{db: db}
}

func (r *MonthlyPlanRepository) Save(ctx context.Context, item *monthly_plan.MonthlyPlanItem) error {
	query := `INSERT INTO monthly_plan_items
		(id, user_id, name, description, amount, currency, type, category_id, account_id, day_of_month, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`

	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query,
		item.ID, item.UserID, item.Name, item.Description, item.Amount, item.Currency,
		item.Type, item.CategoryID, item.AccountID, item.DayOfMonth, item.IsActive,
		item.CreatedAt, item.UpdatedAt,
	)
	return err
}

// Update rewrites the editable fields of an item. It returns the number of
// affected rows so the service can tell "not found" from "nothing changed".
func (r *MonthlyPlanRepository) Update(ctx context.Context, item *monthly_plan.MonthlyPlanItem) (int64, error) {
	query := `UPDATE monthly_plan_items
		SET name = $1, description = $2, amount = $3, currency = $4, type = $5,
		    category_id = $6, account_id = $7, day_of_month = $8, is_active = $9, updated_at = $10
		WHERE id = $11 AND user_id = $12`

	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query,
		item.Name, item.Description, item.Amount, item.Currency, item.Type,
		item.CategoryID, item.AccountID, item.DayOfMonth, item.IsActive,
		time.Now().UTC(), item.ID, item.UserID,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// SetActive toggles an item without touching the rest of its fields, so the user
// can pause a commitment (a cancelled subscription) without losing it.
func (r *MonthlyPlanRepository) SetActive(ctx context.Context, id string, userID string, isActive bool) (int64, error) {
	query := `UPDATE monthly_plan_items SET is_active = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`

	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, isActive, time.Now().UTC(), id, userID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (r *MonthlyPlanRepository) Delete(ctx context.Context, id string, userID string) (int64, error) {
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx,
		`DELETE FROM monthly_plan_items WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (r *MonthlyPlanRepository) FindOne(ctx context.Context, id string, userID string) (*monthly_plan.MonthlyPlanItem, error) {
	query := `SELECT ` + selectColumns + ` FROM monthly_plan_items WHERE id = $1 AND user_id = $2`

	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, id, userID)

	item, err := scanItem(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return item, nil
}

// FindAllByUser returns every item of the plan, active and paused. Incomes come
// first, then expenses, each ordered by the day of the month they fall on so the
// caller can render a timeline without sorting again.
func (r *MonthlyPlanRepository) FindAllByUser(ctx context.Context, userID string) ([]*monthly_plan.MonthlyPlanItem, error) {
	query := `SELECT ` + selectColumns + ` FROM monthly_plan_items
		WHERE user_id = $1
		ORDER BY type DESC, COALESCE(day_of_month, 32), name`

	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			log.Error().Err(closeErr).Msg("failed to close monthly plan rows")
		}
	}()

	items := make([]*monthly_plan.MonthlyPlanItem, 0)
	for rows.Next() {
		item, scanErr := scanItem(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

// Totals aggregates active items in the database, converting USD rows with the
// supplied rate so the sums come back in DOP already.
func (r *MonthlyPlanRepository) Totals(ctx context.Context, userID string, usdToDop float64) (*monthly_plan.Totals, error) {
	if usdToDop <= 0 {
		usdToDop = 1
	}

	query := `SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN
				CASE WHEN currency = 'USD' THEN amount * $2 ELSE amount END
			ELSE 0 END), 0) AS total_income,
			COALESCE(SUM(CASE WHEN type = 'bill' THEN
				CASE WHEN currency = 'USD' THEN amount * $2 ELSE amount END
			ELSE 0 END), 0) AS total_expenses,
			COUNT(CASE WHEN type = 'income' THEN 1 END) AS income_count,
			COUNT(CASE WHEN type = 'bill' THEN 1 END) AS expenses_count
		FROM monthly_plan_items
		WHERE user_id = $1 AND is_active`

	var totals monthly_plan.Totals
	err := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, userID, usdToDop).Scan(
		&totals.TotalIncome, &totals.TotalExpenses, &totals.IncomeCount, &totals.ExpensesCount,
	)
	if err != nil {
		return nil, err
	}

	return &totals, nil
}

// rowScanner lets FindOne and FindAllByUser share the same scanning code.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanItem(scanner rowScanner) (*monthly_plan.MonthlyPlanItem, error) {
	var item monthly_plan.MonthlyPlanItem
	var categoryID, accountID sql.NullString
	var dayOfMonth sql.NullInt64

	err := scanner.Scan(
		&item.ID, &item.UserID, &item.Name, &item.Description, &item.Amount,
		&item.Currency, &item.Type, &categoryID, &accountID, &dayOfMonth,
		&item.IsActive, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if categoryID.Valid {
		value := categoryID.String
		item.CategoryID = &value
	}
	if accountID.Valid {
		value := accountID.String
		item.AccountID = &value
	}
	if dayOfMonth.Valid {
		value := int(dayOfMonth.Int64)
		item.DayOfMonth = &value
	}

	return &item, nil
}
