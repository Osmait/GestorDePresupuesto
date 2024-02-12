package postgress

import (
	"database/sql"
	"log"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/invesment"
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
	_, err := i.db.ExecContext(ctx, "INSERT INTO invesments (id , name ,price, current_price,quantity) VALUES ($1,$2,$3,$4,$5)", invesment.Id, invesment.Name, invesment.Price, invesment.CurrentPrice, invesment.Quantity)
	return err
}

func (i *InvesmentRepository) FindAll(ctx context.Context, userId string) ([]*invesment.Invesment, error) {
	rows, err := i.db.QueryContext(ctx, "SELECT id,name,price,current_price,quantity FROM invesments WHERE id = $1 ", userId)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Fatal(err)
		}
	}()

	var invesments []*invesment.Invesment
	for rows.Next() {
		var invesment invesment.Invesment
		if err = rows.Scan(&invesment.Id, &invesment.Name, &invesment.Price, &invesment.CurrentPrice, &invesment.Quantity); err == nil {
			invesments = append(invesments, &invesment)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return invesments, nil
}

func (i *InvesmentRepository) FindOne(ctx context.Context, id string) (*invesment.Invesment, error) {
	rows, err := i.db.QueryContext(ctx, "SELECT id,name,price,current_price,quantity FROM invesments WHERE id = $1 ", id)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Fatal(err)
		}
	}()

	var invesment invesment.Invesment
	for rows.Next() {
		if err = rows.Scan(&invesment.Id, &invesment.Name, &invesment.Price, &invesment.CurrentPrice, &invesment.Quantity); err != nil {
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
