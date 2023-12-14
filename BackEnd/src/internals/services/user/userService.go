package user

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
)

type UserService struct {
	userRepository postgress.UserRepositoryInterface
}

func NewUserService(userRepo postgress.UserRepositoryInterface) *UserService {
	return &UserService{
		userRepository: userRepo,
	}
}

func (u *UserService) CreateUser(ctx context.Context, user *user.User) error {
	err := u.userRepository.CreateUser(ctx, user)
	return err
}

func (u *UserService) FindUserById(ctx context.Context, id string) (*user.User, error) {
	user, err := u.userRepository.FindUser(ctx, id)
	if err != nil {
		return nil, err
	}
	return user, nil
}
