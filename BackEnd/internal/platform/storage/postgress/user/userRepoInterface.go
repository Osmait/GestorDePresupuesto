package postgress

import (
	"context"
	"time"

	domainUser "github.com/osmait/gestorDePresupuesto/internal/domain/user"
)

type UserRepositoryInterface interface {
	FindUserById(ctx context.Context, id string) (*domainUser.User, error)
	FindUserByEmail(ctx context.Context, email string) (*domainUser.User, error)
	// FindUserByIp returns a user by their registration IP
	FindUserByIp(ctx context.Context, ip string) (*domainUser.User, error)
	// DeleteDemoUsersOlderThan deletes all demo users created before the specified time
	DeleteDemoUsersOlderThan(ctx context.Context, olderThan time.Time) error
	Save(ctx context.Context, user *domainUser.User) error
	Delete(ctx context.Context, id string) error
	// FindAll returns all users in the system
	FindAll(ctx context.Context) ([]*domainUser.User, error)
}
