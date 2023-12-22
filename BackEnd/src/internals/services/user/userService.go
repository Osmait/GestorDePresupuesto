package user

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/errorhttp"
	"github.com/segmentio/ksuid"
	"golang.org/x/crypto/bcrypt"
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
	hashPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	id, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	user.Id = id.String()
	user.Password = string(hashPassword)

	err = u.userRepository.Save(ctx, user)
	return err
}

func (u *UserService) FindUserByEmail(ctx context.Context, email string) (*user.User, error) {
	user, err := u.userRepository.FindUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user.Id == "" {
		return nil, errorhttp.NotFound
	}

	return user, nil
}

func (u *UserService) FindUserById(ctx context.Context, id string) (*user.User, error) {
	user, err := u.userRepository.FindUserById(ctx, id)
	if err != nil {
		return nil, err
	}
	if user.Id == "" {
		return nil, errorhttp.NotFound
	}
	return user, nil
}

func (u *UserService) DeleteUser(ctx context.Context, id string) error {
	user, err := u.userRepository.FindUserById(ctx, id)
	if err != nil {
		return err
	}
	if user.Id == "" {
		return errorhttp.NotFound
	}
	err = u.userRepository.Delete(ctx, id)
	return err
}
