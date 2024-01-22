package user

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
	dto "github.com/osmait/gestorDePresupuesto/src/internals/platform/dto/user"
	userRepo "github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/errorhttp"
	"github.com/segmentio/ksuid"
	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	userRepository userRepo.UserRepositoryInterface
}

func NewUserService(userRepo userRepo.UserRepositoryInterface) *UserService {
	return &UserService{
		userRepository: userRepo,
	}
}

func (u *UserService) CreateUser(ctx context.Context, userRequest *dto.UserRequest) error {
	userDuplicate, err := u.userRepository.FindUserByEmail(ctx, userRequest.Email)
	if !errorhttp.IsErrNotFound(err) && err != nil {
		return err
	}

	if userDuplicate != nil {
		return errorhttp.ErrNotDuplicate
	}
	hashPassword, err := bcrypt.GenerateFromPassword([]byte(userRequest.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	id, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	userToSave := user.NewUser(id.String(), userRequest.Name, userRequest.LastName, userRequest.Email, string(hashPassword))

	err = u.userRepository.Save(ctx, userToSave)
	return err
}

func (u *UserService) FindByEmail(ctx context.Context, email string) (*dto.UserResponse, error) {
	user, err := u.userRepository.FindUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user.Id == "" {
		return nil, errorhttp.ErrNotFound
	}
	if user.Email != email {
		return nil, errorhttp.ErrNotFound
	}

	userResponse := dto.NewUserResponse(user.Id, user.Name, user.LastName, user.Email, user.CreatedAt)
	return userResponse, nil
}

func (u *UserService) FindUserById(ctx context.Context, id string) (*dto.UserResponse, error) {
	user, err := u.userRepository.FindUserById(ctx, id)
	if err != nil {
		return nil, err
	}
	if user.Id == "" {
		return nil, errorhttp.ErrNotFound
	}
	if id != user.Id {
		return nil, errorhttp.ErrNotFound
	}
	userResponse := dto.NewUserResponse(user.Id, user.Name, user.LastName, user.Email, user.CreatedAt)
	return userResponse, nil
}

func (u *UserService) DeleteUser(ctx context.Context, id string) error {
	user, err := u.userRepository.FindUserById(ctx, id)
	if err != nil {
		return err
	}
	if user.Id == "" {
		return errorhttp.ErrNotFound
	}
	err = u.userRepository.Delete(ctx, id)
	return err
}
