package postgress

import (
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/rs/zerolog/log"
	"golang.org/x/net/context"
)

type InvestmentRepository struct {
	db *sql.DB
}

func NewInvestmentRepository(db *sql.DB) *InvestmentRepository {
	return &InvestmentRepository{
		db: db,
	}
}

func (i *InvestmentRepository) Save(ctx context.Context, investment *investment.Investment) error {
	_, err := i.db.ExecContext(ctx, "INSERT INTO investments (id, name, price, current_price, quantity, user_id) VALUES ($1,$2,$3,$4,$5,$6)",
		investment.Id, investment.Name, investment.Price, investment.CurrentPrice, investment.Quantity, investment.UserId)
	return err
}

func (i *InvestmentRepository) FindAll(ctx context.Context, userId string) ([]*investment.Investment, error) {
	rows, err := i.db.QueryContext(ctx, "SELECT id, name, price, current_price, quantity, user_id, created_at FROM investments WHERE user_id = $1 ", userId)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var investments []*investment.Investment
	for rows.Next() {
		var investment investment.Investment
		if err = rows.Scan(&investment.Id, &investment.Name, &investment.Price, &investment.CurrentPrice, &investment.Quantity, &investment.UserId, &investment.CreatedAt); err == nil {
			investments = append(investments, &investment)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return investments, nil
}

func (i *InvestmentRepository) FindOne(ctx context.Context, id string) (*investment.Investment, error) {
	rows, err := i.db.QueryContext(ctx, "SELECT id, name, price, current_price, quantity, user_id, created_at FROM investments WHERE id = $1 ", id)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var investment investment.Investment
	for rows.Next() {
		if err = rows.Scan(&investment.Id, &investment.Name, &investment.Price, &investment.CurrentPrice, &investment.Quantity, &investment.UserId, &investment.CreatedAt); err != nil {
			return nil, err
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return &investment, nil
}

func (i *InvestmentRepository) Delete(ctx context.Context, id string) error {
	_, err := i.db.ExecContext(ctx, "DELETE FROM investments WHERE id = $1", id)
	return err
}
