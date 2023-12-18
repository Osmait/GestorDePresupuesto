package auth

import (
	"context"
	"errors"
	"fmt"

	authRequest "github.com/osmait/gestorDePresupuesto/src/internals/domain/auth"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	repo postgress.UserRepositoryInterface
}

func NewAuthService(userRepository postgress.UserRepositoryInterface) *AuthService {
	return &AuthService{
		repo: userRepository,
	}
}

func (a *AuthService) Login(ctx context.Context, authRequest *authRequest.AuthRequest) (*string, error) {
	user, err := a.repo.FindUserByEmail(ctx, authRequest.Email)
	if err != nil {
		return nil, err
	}

	if user.Email != authRequest.Email {
		return nil, errors.New("error email")
	}
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(authRequest.Password))
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	fmt.Println(user.Id)
	token, err := utils.JwtCreate(user.Id)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	return token, nil
}
