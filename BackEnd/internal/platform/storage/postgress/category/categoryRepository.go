package postgress

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/rs/zerolog/log"
)

type CategoryRespository struct {
	db *sql.DB
}

func NewCategoryRepository(db *sql.DB) *CategoryRespository {
	return &CategoryRespository{
		db: db,
	}
}

func (c *CategoryRespository) Save(ctx context.Context, category *category.Category) error {
	_, err := c.db.ExecContext(ctx, "INSERT INTO categorys (id,name,icon,color,user_id) VALUES($1,$2,$3,$4,$5)  ", category.Id, category.Name, category.Icon, category.Color, category.UserId)
	return err
}

func (c *CategoryRespository) FindAll(ctx context.Context, userId string) ([]*category.Category, error) {
	rows, err := c.db.QueryContext(ctx, "SELECT id, name ,icon ,color ,user_id,created_at FROM categorys WHERE user_id = $1 ", userId)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var categorys []*category.Category
	for rows.Next() {
		var category category.Category
		if err = rows.Scan(&category.Id, &category.Name, &category.Icon, &category.Color, &category.UserId, &category.CreatedAt); err == nil {
			categorys = append(categorys, &category)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return categorys, nil
}

func (c *CategoryRespository) FindOne(ctx context.Context, id string) (*category.Category, error) {
	rows, err := c.db.QueryContext(ctx, "SELECT id, name ,icon ,color,user_id,created_at FROM categorys  WHERE id = $1 ", id)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var category category.Category
	for rows.Next() {
		if err = rows.Scan(&category.Id, &category.Name, &category.Icon, &category.Color, &category.UserId, &category.CreatedAt); err != nil {
			return nil, err
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return &category, nil
}

func (c *CategoryRespository) Delete(ctx context.Context, id string) error {
	_, err := c.db.ExecContext(ctx, "DELETE FROM categorys WHERE id = $1", id)
	return err
}
