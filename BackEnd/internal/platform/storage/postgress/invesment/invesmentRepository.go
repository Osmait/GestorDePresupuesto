package postgress

import (
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/domain/invesment"
	"github.com/rs/zerolog/log"
	"golang.org/x/net/context"
)

type InvesmentRepository struct {
	db *sql.DB
}

func NewInvesmentRepository(db *sql.DB) *InvesmentRepository {
	return &InvesmentRepository{
		db: db,
	}
}

func (i *InvesmentRepository) Save(ctx context.Context, invesment *invesment.Invesment) error {
	_, err := i.db.ExecContext(ctx, "INSERT INTO invesments (id, name, price, current_price, quantity, user_id) VALUES ($1,$2,$3,$4,$5,$6)",
		invesment.Id, invesment.Name, invesment.Price, invesment.CurrentPrice, invesment.Quantity, invesment.UserId)
	return err
}

func (i *InvesmentRepository) FindAll(ctx context.Context, userId string) ([]*invesment.Invesment, error) {
	rows, err := i.db.QueryContext(ctx, "SELECT id, name, price, current_price, quantity, user_id, created_at FROM invesments WHERE user_id = $1 ", userId)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var invesments []*invesment.Invesment
	for rows.Next() {
		var invesment invesment.Invesment
		if err = rows.Scan(&invesment.Id, &invesment.Name, &invesment.Price, &invesment.CurrentPrice, &invesment.Quantity, &invesment.UserId, &invesment.CreatedAt); err == nil {
			invesments = append(invesments, &invesment)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return invesments, nil
}

func (i *InvesmentRepository) FindOne(ctx context.Context, id string) (*invesment.Invesment, error) {
	rows, err := i.db.QueryContext(ctx, "SELECT id, name, price, current_price, quantity, user_id, created_at FROM invesments WHERE id = $1 ", id)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var invesment invesment.Invesment
	for rows.Next() {
		if err = rows.Scan(&invesment.Id, &invesment.Name, &invesment.Price, &invesment.CurrentPrice, &invesment.Quantity, &invesment.UserId, &invesment.CreatedAt); err != nil {
			return nil, err
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return &invesment, nil
}

func (i *InvesmentRepository) Delete(ctx context.Context, id string) error {
	_, err := i.db.ExecContext(ctx, "DELETE FROM invesments WHERE id = $1", id)
	return err
}
