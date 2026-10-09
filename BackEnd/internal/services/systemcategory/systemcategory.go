// Package systemcategory resolves the categories the backend creates on
// demand (domain/category.System) for services that only hold a generic
// category repository.
package systemcategory

import (
	"context"
	"strings"

	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
)

// Store is the minimal category repository needed by Ensure.
type Store interface {
	FindAll(ctx context.Context, userId string) ([]*category.Category, error)
	Save(ctx context.Context, category *category.Category) error
}

// Ensurer is implemented by repositories that find-or-create a system
// category atomically (the Postgres category repository).
type Ensurer interface {
	EnsureSystemCategory(ctx context.Context, userId string, sys category.System) (string, error)
}

// Name is the name of sys in the context's locale.
func Name(ctx context.Context, sys category.System) string {
	return i18n.T(ctx, i18n.CategoryKey(sys.Key))
}

// Ensure returns the id of userId's system category sys, creating it when
// missing. The category is identified by sys.ID(userId) (or, for rows created
// before deterministic ids, by one of sys.KnownNames), never by the localized
// name, so the result does not depend on the request language.
func Ensure(ctx context.Context, store Store, userId string, sys category.System) (string, error) {
	if e, ok := store.(Ensurer); ok {
		return e.EnsureSystemCategory(ctx, userId, sys)
	}

	id := sys.ID(userId)
	categories, err := store.FindAll(ctx, userId)
	if err != nil {
		return "", err
	}
	for _, c := range categories {
		if c.Id == id {
			return c.Id, nil
		}
	}
	for _, c := range categories {
		for _, known := range sys.KnownNames {
			if strings.EqualFold(strings.TrimSpace(c.Name), strings.TrimSpace(known)) {
				return c.Id, nil
			}
		}
	}

	created := category.NewCategory(id, Name(ctx, sys), sys.Icon, sys.Color)
	created.UserId = userId
	if err := store.Save(ctx, created); err != nil {
		return "", err
	}
	return created.Id, nil
}
