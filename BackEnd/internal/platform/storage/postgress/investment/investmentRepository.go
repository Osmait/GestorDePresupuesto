package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
)

type InvestmentRepository struct {
	db *sql.DB
}

func NewInvestmentRepository(db *sql.DB) *InvestmentRepository {
	return &InvestmentRepository{db: db}
}

func (r *InvestmentRepository) Save(ctx context.Context, investment *investment.Investment) error {
	query := `INSERT INTO investments (id, user_id, investment_type, name, symbol, quantity, purchase_price, current_price, created_at, updated_at) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err := r.db.ExecContext(ctx, query, investment.ID, investment.UserID, investment.Type, investment.Name, investment.Symbol, investment.Quantity, investment.PurchasePrice, investment.CurrentPrice, investment.CreatedAt, investment.UpdatedAt)
	if err != nil {
		return fmt.Errorf("error saving investment: %w", err)
	}
	return nil
}

func (r *InvestmentRepository) FindAll(ctx context.Context, userId string) ([]*investment.Investment, error) {
	query := `SELECT id, user_id, investment_type, name, symbol, quantity, purchase_price, current_price, created_at, updated_at FROM investments WHERE user_id = $1`
	rows, err := r.db.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, fmt.Errorf("error finding investments: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var investments []*investment.Investment
	for rows.Next() {
		var i investment.Investment
		if err := rows.Scan(&i.ID, &i.UserID, &i.Type, &i.Name, &i.Symbol, &i.Quantity, &i.PurchasePrice, &i.CurrentPrice, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, fmt.Errorf("error scanning investment: %w", err)
		}
		investments = append(investments, &i)
	}
	return investments, nil
}

func (r *InvestmentRepository) FindByID(ctx context.Context, id string) (*investment.Investment, error) {
	query := `SELECT id, user_id, investment_type, name, symbol, quantity, purchase_price, current_price, created_at, updated_at FROM investments WHERE id = $1`
	row := r.db.QueryRowContext(ctx, query, id)

	var i investment.Investment
	if err := row.Scan(&i.ID, &i.UserID, &i.Type, &i.Name, &i.Symbol, &i.Quantity, &i.PurchasePrice, &i.CurrentPrice, &i.CreatedAt, &i.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Or custom error
		}
		return nil, fmt.Errorf("error finding investment by id: %w", err)
	}
	return &i, nil
}

func (r *InvestmentRepository) Update(ctx context.Context, investment *investment.Investment) error {
	query := `UPDATE investments SET investment_type = $1, name = $2, symbol = $3, quantity = $4, purchase_price = $5, current_price = $6, updated_at = $7 WHERE id = $8`
	_, err := r.db.ExecContext(ctx, query, investment.Type, investment.Name, investment.Symbol, investment.Quantity, investment.PurchasePrice, investment.CurrentPrice, time.Now(), investment.ID)
	if err != nil {
		return fmt.Errorf("error updating investment: %w", err)
	}
	return nil
}

func (r *InvestmentRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM investments WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("error deleting investment: %w", err)
	}
	return nil
}
