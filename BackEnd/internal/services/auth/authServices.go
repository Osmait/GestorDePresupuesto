package auth

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	authRequest "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	repo   userRepo.UserRepositoryInterface
	config *config.Config
}

func NewAuthService(userRepository userRepo.UserRepositoryInterface, config *config.Config) *AuthService {
	return &AuthService{
		repo:   userRepository,
		config: config,
	}
}

func (a *AuthService) Login(ctx context.Context, authRequest *authRequest.AuthRequest) (*string, error) {
	user, err := a.repo.FindUserByEmail(ctx, authRequest.Email)
	if err != nil {
		return nil, err
	}

	if user.Email != authRequest.Email {
		return nil, errorhttp.ErrBadRequest
	}
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(authRequest.Password))
	if err != nil {
		return nil, errorhttp.ErrBadRequest
	}

	log.Debug().Str("user_id", user.Id).Msg("user authenticated successfully")
	token, err := utils.JwtCreate(user.Id, a.config.JWT.Secret)
	if err != nil {
		return nil, err
	}

	return token, nil
}
