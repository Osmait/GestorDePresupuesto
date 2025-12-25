package postgress

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
)

type UserRepositoryInterface interface {
	FindUserById(ctx context.Context, id string) (*user.User, error)
	FindUserByEmail(ctx context.Context, email string) (*user.User, error)
	// FindUserByIp returns a user by their registration IP
	FindUserByIp(ctx context.Context, ip string) (*user.User, error)
	// DeleteDemoUsersOlderThan deletes all demo users created before the specified time
	DeleteDemoUsersOlderThan(ctx context.Context, olderThan time.Time) error
	Save(ctx context.Context, user *user.User) error
	Delete(ctx context.Context, id string) error
}
