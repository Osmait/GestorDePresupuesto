package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	budgetDomain "github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	transactionDomain "github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	userDomain "github.com/osmait/gestorDePresupuesto/internal/domain/user"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	authRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/auth"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	ErrRefreshTokenExpired = errors.New("refresh token expired or revoked")
	ErrTokenReuse          = errors.New("refresh token reuse detected")
)

// AuthService handles authentication and authorization logic.
type AuthService struct {
	repo             userRepo.UserRepositoryInterface
	accountRepo      accountRepo.AccountRepositoryInterface
	categoryRepo     categoryRepo.CategoryRepoInterface
	budgetRepo       budgetRepo.BudgetRepoInterface
	transactionRepo  transactionRepo.TransactionRepositoryInterface
	refreshTokenRepo authRepo.RefreshTokenRepositoryInterface
	config           *config.Config
}

// NewAuthService creates a new instance of AuthService with necessary dependencies.
func NewAuthService(
	userRepository userRepo.UserRepositoryInterface,
	accountRepo accountRepo.AccountRepositoryInterface,
	categoryRepo categoryRepo.CategoryRepoInterface,
	budgetRepo budgetRepo.BudgetRepoInterface,
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	config *config.Config,
) *AuthService {
	return &AuthService{
		repo:            userRepository,
		accountRepo:     accountRepo,
		categoryRepo:    categoryRepo,
		budgetRepo:      budgetRepo,
		transactionRepo: transactionRepo,
		config:          config,
	}
}

// NewAuthServiceWithRefreshTokens creates AuthService with refresh token support
func NewAuthServiceWithRefreshTokens(
	userRepository userRepo.UserRepositoryInterface,
	accountRepo accountRepo.AccountRepositoryInterface,
	categoryRepo categoryRepo.CategoryRepoInterface,
	budgetRepo budgetRepo.BudgetRepoInterface,
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	refreshTokenRepo authRepo.RefreshTokenRepositoryInterface,
	config *config.Config,
) *AuthService {
	return &AuthService{
		repo:             userRepository,
		accountRepo:      accountRepo,
		categoryRepo:     categoryRepo,
		budgetRepo:       budgetRepo,
		transactionRepo:  transactionRepo,
		refreshTokenRepo: refreshTokenRepo,
		config:           config,
	}
}

// Login authenticates a user by email and password, returning a JWT token if successful.
// Legacy method - returns only access token for backward compatibility
func (a *AuthService) Login(ctx context.Context, authRequest *authDomain.AuthRequest) (*string, error) {
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

// LoginWithTokens authenticates a user and returns both access and refresh tokens
func (a *AuthService) LoginWithTokens(ctx context.Context, authRequest *authDomain.AuthRequest, userAgent, ipAddress string) (*authDomain.AuthResponse, error) {
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

	// Create token pair
	tokenPair, err := utils.CreateTokenPair(user.Id, a.config.JWT)
	if err != nil {
		return nil, err
	}

	// Store refresh token in database
	if a.refreshTokenRepo != nil {
		refreshToken := authDomain.NewRefreshToken(
			ksuid.New().String(),
			user.Id,
			authDomain.HashToken(tokenPair.RefreshToken),
			userAgent,
			ipAddress,
			time.Now().Add(a.config.JWT.RefreshExpiration),
		)
		if err := a.refreshTokenRepo.Save(ctx, refreshToken); err != nil {
			log.Error().Err(err).Msg("failed to save refresh token")
			return nil, err
		}
	}

	return authDomain.NewAuthResponse(
		tokenPair.AccessToken,
		tokenPair.RefreshToken,
		tokenPair.ExpiresIn,
	), nil
}

// RefreshTokens validates a refresh token and returns new access and refresh tokens
func (a *AuthService) RefreshTokens(ctx context.Context, refreshToken, userAgent, ipAddress string) (*authDomain.AuthResponse, error) {
	if a.refreshTokenRepo == nil {
		return nil, errors.New("refresh token repository not configured")
	}

	tokenHash := authDomain.HashToken(refreshToken)

	// Find token in database
	storedToken, err := a.refreshTokenRepo.FindByHash(ctx, tokenHash)
	if err != nil {
		log.Error().Err(err).Msg("error finding refresh token")
		return nil, ErrInvalidRefreshToken
	}
	if storedToken == nil {
		return nil, ErrInvalidRefreshToken
	}

	// Check if token was already used (reuse detection)
	if storedToken.IsRevoked() {
		// Potential token theft! Revoke all tokens for this user
		log.Warn().
			Str("user_id", storedToken.UserId).
			Str("token_id", storedToken.Id).
			Msg("refresh token reuse detected - revoking all user tokens")
		_ = a.refreshTokenRepo.RevokeAllForUser(ctx, storedToken.UserId)
		return nil, ErrTokenReuse
	}

	// Check if token is expired
	if storedToken.IsExpired() {
		return nil, ErrRefreshTokenExpired
	}

	// Create new token pair
	tokenPair, err := utils.CreateTokenPair(storedToken.UserId, a.config.JWT)
	if err != nil {
		return nil, err
	}

	// Create new refresh token record
	newTokenId := ksuid.New().String()
	newRefreshToken := authDomain.NewRefreshToken(
		newTokenId,
		storedToken.UserId,
		authDomain.HashToken(tokenPair.RefreshToken),
		userAgent,
		ipAddress,
		time.Now().Add(a.config.JWT.RefreshExpiration),
	)

	// Revoke old token (rotation) and save new one
	if err := a.refreshTokenRepo.Revoke(ctx, storedToken.Id, &newTokenId); err != nil {
		log.Error().Err(err).Msg("failed to revoke old refresh token")
		return nil, err
	}

	if err := a.refreshTokenRepo.Save(ctx, newRefreshToken); err != nil {
		log.Error().Err(err).Msg("failed to save new refresh token")
		return nil, err
	}

	log.Debug().
		Str("user_id", storedToken.UserId).
		Str("old_token_id", storedToken.Id).
		Str("new_token_id", newTokenId).
		Msg("tokens refreshed successfully")

	return authDomain.NewAuthResponse(
		tokenPair.AccessToken,
		tokenPair.RefreshToken,
		tokenPair.ExpiresIn,
	), nil
}

// Logout revokes a specific refresh token
func (a *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if a.refreshTokenRepo == nil {
		return nil // No-op if refresh tokens not configured
	}

	tokenHash := authDomain.HashToken(refreshToken)
	return a.refreshTokenRepo.RevokeByHash(ctx, tokenHash)
}

// LogoutAll revokes all refresh tokens for a user
func (a *AuthService) LogoutAll(ctx context.Context, userId string) error {
	if a.refreshTokenRepo == nil {
		return nil
	}
	return a.refreshTokenRepo.RevokeAllForUser(ctx, userId)
}

// CleanupExpiredTokens removes expired refresh tokens from the database
func (a *AuthService) CleanupExpiredTokens(ctx context.Context) (int64, error) {
	if a.refreshTokenRepo == nil {
		return 0, nil
	}
	return a.refreshTokenRepo.DeleteExpired(ctx)
}

// CreateDemoUser creates a temporary demo user with pre-seeded data (accounts, categories, transactions) for trial purposes.
func (a *AuthService) CreateDemoUser(ctx context.Context, ip string) (*string, error) {
	// 0. Check if demo user exists for this IP
	if ip != "" {
		existingUser, err := a.repo.FindUserByIp(ctx, ip)
		if err == nil && existingUser != nil && existingUser.IsDemo {
			log.Info().Str("ip", ip).Msg("returning existing demo user for IP")
			return utils.JwtCreate(existingUser.Id, a.config.JWT.Secret)
		}
	}

	// 1. Create Demo User
	userID := uuid.New().String()
	password := "demo123" // Temporary password
	hashPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	user := userDomain.NewUser(userID, "Demo User", "Minimizado", "demo+"+userID+"@example.com", string(hashPassword))
	user.IsDemo = true
	user.Confirmed = true
	user.IpAddress = ip

	if err := a.repo.Save(ctx, user); err != nil {
		log.Error().Err(err).Msg("failed to save demo user")
		return nil, err
	}

	// 2. Create Account
	accountID := uuid.New().String()
	account := accountDomain.NewAccount(1000.0, accountID, "Cuenta Demo", "Banco Demo")
	account.UserId = userID
	if err := a.accountRepo.Save(ctx, account); err != nil {
		log.Error().Err(err).Msg("failed to save demo account")
		return nil, err
	}

	// 3. Create Categories
	// Income
	salaryCatID := uuid.New().String()
	salaryCat := categoryDomain.NewCategory(salaryCatID, "Salario", "💰", "green")
	salaryCat.UserId = userID
	if err := a.categoryRepo.Save(ctx, salaryCat); err != nil {
		log.Error().Err(err).Msg("failed to save salary category")
		return nil, err
	}

	// Expense
	foodCatID := uuid.New().String()
	foodCat := categoryDomain.NewCategory(foodCatID, "Comida", "🍔", "orange")
	foodCat.UserId = userID
	if err := a.categoryRepo.Save(ctx, foodCat); err != nil {
		log.Error().Err(err).Msg("failed to save food category")
		return nil, err
	}

	transportCatID := uuid.New().String()
	transportCat := categoryDomain.NewCategory(transportCatID, "Transporte", "🚌", "blue")
	transportCat.UserId = userID
	if err := a.categoryRepo.Save(ctx, transportCat); err != nil {
		log.Error().Err(err).Msg("failed to save transport category")
		return nil, err
	}

	// 4. Create Budget (Optional)
	budgetID := uuid.New().String()
	budget := budgetDomain.NewBudget(budgetID, foodCatID, userID, 500.0)
	if err := a.budgetRepo.Save(ctx, budget); err != nil {
		log.Error().Err(err).Msg("failed to save demo budget")
	}

	// 5. Create Transactions (Dynamic Dates)
	now := time.Now()

	// Income: Salary (Today)
	tx1 := transactionDomain.NewTransaction(uuid.New().String(), "Nómina Mensual", "Ingreso del mes", "income", accountID, salaryCatID, 3000.0)
	tx1.UserId = userID
	tx1.CreatedAt = now
	if err := a.transactionRepo.Save(ctx, tx1); err != nil {
		log.Error().Err(err).Msg("failed to save tx1")
	}

	// Expense: Supermarket (2 days ago)
	tx2 := transactionDomain.NewTransaction(uuid.New().String(), "Supermercado Semanal", "Compra grande", "bill", accountID, foodCatID, 150.0)
	tx2.UserId = userID
	tx2.CreatedAt = now.AddDate(0, 0, -2)
	tx2.BudgetId = budgetID
	if err := a.transactionRepo.Save(ctx, tx2); err != nil {
		log.Error().Err(err).Msg("failed to save tx2")
	}

	// Expense: Transport (5 days ago)
	tx3 := transactionDomain.NewTransaction(uuid.New().String(), "Uber a casa", "Salida tarde", "bill", accountID, transportCatID, 25.50)
	tx3.UserId = userID
	tx3.CreatedAt = now.AddDate(0, 0, -5)
	_ = a.transactionRepo.Save(ctx, tx3)

	// Logic for Token
	token, err := utils.JwtCreate(user.Id, a.config.JWT.Secret)
	if err != nil {
		return nil, err
	}

	return token, nil
}

// CreateDemoUserWithTokens creates a demo user and returns both tokens
func (a *AuthService) CreateDemoUserWithTokens(ctx context.Context, ip, userAgent string) (*authDomain.AuthResponse, error) {
	// Check if demo user exists for this IP
	if ip != "" {
		existingUser, err := a.repo.FindUserByIp(ctx, ip)
		if err == nil && existingUser != nil && existingUser.IsDemo {
			log.Info().Str("ip", ip).Msg("returning existing demo user for IP")
			return a.createTokensForUser(ctx, existingUser.Id, userAgent, ip)
		}
	}

	// Create demo user (reuse existing logic)
	token, err := a.CreateDemoUser(ctx, ip)
	if err != nil {
		return nil, err
	}

	// For demo users, we just return the legacy token wrapped
	// If refresh tokens are needed for demo, uncomment below
	return &authDomain.AuthResponse{
		AccessToken:  *token,
		RefreshToken: "", // Demo users don't get refresh tokens by default
		TokenType:    "Bearer",
		ExpiresIn:    int64((72 * time.Hour).Seconds()),
	}, nil
}

// IssueTokensForUser issues a new access + refresh token pair for a user that
// has already been authenticated by an alternative flow (e.g. WebAuthn/passkey).
// Delegates to createTokensForUser so the storage side effects (refresh token
// persistence) are identical to the email/password login path.
func (a *AuthService) IssueTokensForUser(ctx context.Context, userId, userAgent, ipAddress string) (*authDomain.AuthResponse, error) {
	return a.createTokensForUser(ctx, userId, userAgent, ipAddress)
}

// createTokensForUser is a helper to create token pair for a user
func (a *AuthService) createTokensForUser(ctx context.Context, userId, userAgent, ipAddress string) (*authDomain.AuthResponse, error) {
	tokenPair, err := utils.CreateTokenPair(userId, a.config.JWT)
	if err != nil {
		return nil, err
	}

	if a.refreshTokenRepo != nil {
		refreshToken := authDomain.NewRefreshToken(
			ksuid.New().String(),
			userId,
			authDomain.HashToken(tokenPair.RefreshToken),
			userAgent,
			ipAddress,
			time.Now().Add(a.config.JWT.RefreshExpiration),
		)
		if err := a.refreshTokenRepo.Save(ctx, refreshToken); err != nil {
			log.Error().Err(err).Msg("failed to save refresh token")
			return nil, err
		}
	}

	return authDomain.NewAuthResponse(
		tokenPair.AccessToken,
		tokenPair.RefreshToken,
		tokenPair.ExpiresIn,
	), nil
}
