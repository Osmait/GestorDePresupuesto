package auth

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	budgetDomain "github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
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
	// ErrRefreshTokenRotated is returned when a token that was rotated within
	// the reuse grace window is presented again (typically two clients
	// refreshing in parallel). It wraps ErrInvalidRefreshToken so callers map
	// it to 401, but — unlike ErrTokenReuse — it does NOT revoke the user's
	// other sessions.
	ErrRefreshTokenRotated = fmt.Errorf("%w: token was already rotated", ErrInvalidRefreshToken)

	// ErrInvalidCredentials is the single error returned for an unknown email
	// or a wrong password, so callers cannot enumerate accounts. It wraps
	// errorhttp.ErrBadRequest for backward compatibility with handlers.
	ErrInvalidCredentials = fmt.Errorf("invalid email or password: %w", errorhttp.ErrBadRequest)

	// ErrTooManyLoginAttempts is matched (errors.Is) by *LoginLockedError.
	ErrTooManyLoginAttempts = errors.New("too many failed login attempts")
)

// LoginLockedError is returned while an (email, IP) pair is locked out after
// too many failed password attempts.
type LoginLockedError struct {
	RetryAfter time.Duration
}

func (e *LoginLockedError) Error() string {
	return fmt.Sprintf("%s, retry in %s", ErrTooManyLoginAttempts.Error(), e.RetryAfter.Round(time.Second))
}

// Is makes errors.Is(err, ErrTooManyLoginAttempts) true.
func (e *LoginLockedError) Is(target error) bool { return target == ErrTooManyLoginAttempts }

// Colors of the seeded demo categories: the green, orange and blue of the
// frontend category palette (FrontendNextjs/gestor/lib/category-color.ts).
// CSS names such as "blue" (#0000FF) are nearly invisible on the dark theme.
const (
	seedColorGreen  = "#22C55E"
	seedColorOrange = "#F97316"
	seedColorBlue   = "#3B82F6"
)

// defaultRefreshReuseGrace is used when the config does not set one.
const defaultRefreshReuseGrace = 30 * time.Second

var (
	dummyHashOnce sync.Once
	dummyHash     []byte
)

// dummyPasswordHash returns a bcrypt hash (same cost as real user hashes)
// compared against when the email is unknown, so both paths cost one bcrypt
// comparison and take the same time.
func dummyPasswordHash() []byte {
	dummyHashOnce.Do(func() {
		h, err := bcrypt.GenerateFromPassword([]byte("timing-equalizer-not-a-real-password"), bcrypt.DefaultCost)
		if err != nil {
			panic(fmt.Sprintf("auth: cannot build dummy bcrypt hash: %v", err))
		}
		dummyHash = h
	})
	return dummyHash
}

// AuthService handles authentication and authorization logic.
type AuthService struct {
	repo             userRepo.UserRepositoryInterface
	accountRepo      accountRepo.AccountRepositoryInterface
	categoryRepo     categoryRepo.CategoryRepoInterface
	budgetRepo       budgetRepo.BudgetRepoInterface
	transactionRepo  transactionRepo.TransactionRepositoryInterface
	refreshTokenRepo authRepo.RefreshTokenRepositoryInterface
	config           *config.Config
	loginLimiter     *loginAttemptLimiter
}

func newLoginLimiterFromConfig(cfg *config.Config) *loginAttemptLimiter {
	if cfg == nil {
		return newLoginAttemptLimiter(0, 0)
	}
	return newLoginAttemptLimiter(cfg.Security.MaxLoginAttempts, cfg.Security.AccountLockTime)
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
		loginLimiter:    newLoginLimiterFromConfig(config),
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
		loginLimiter:     newLoginLimiterFromConfig(config),
	}
}

// authenticate verifies email + password with constant work (one bcrypt
// comparison whether or not the user exists), enforces the per (email, IP)
// failed-attempt lockout, and returns ErrInvalidCredentials for both an
// unknown email and a wrong password.
func (a *AuthService) authenticate(ctx context.Context, authRequest *authDomain.AuthRequest, ipAddress string) (*userDomain.User, error) {
	key := loginAttemptKey(authRequest.Email, ipAddress)
	if wait := a.loginLimiter.retryAfter(key); wait > 0 {
		return nil, &LoginLockedError{RetryAfter: wait}
	}

	user, lookupErr := a.repo.FindUserByEmail(ctx, authRequest.Email)
	found := lookupErr == nil && user != nil && user.Email == authRequest.Email

	hash := dummyPasswordHash()
	if found {
		hash = []byte(user.Password)
	}
	cmpErr := bcrypt.CompareHashAndPassword(hash, []byte(authRequest.Password))

	if lookupErr != nil && !errors.Is(lookupErr, errorhttp.ErrNotFound) {
		// Infrastructure failure (DB down...): not a credential problem.
		return nil, fmt.Errorf("login lookup failed: %w", lookupErr)
	}

	if !found || cmpErr != nil {
		if lock := a.loginLimiter.recordFailure(key); lock > 0 {
			log.Warn().Str("ip", ipAddress).Msg("login locked out after too many failed attempts")
		}
		return nil, ErrInvalidCredentials
	}

	a.loginLimiter.recordSuccess(key)
	log.Debug().Str("user_id", user.Id).Msg("user authenticated successfully")
	return user, nil
}

// Login authenticates a user by email and password, returning a JWT token if successful.
// Legacy method - returns only access token for backward compatibility.
// Callers without a client IP (e.g. the MCP OAuth login page) share one
// lockout budget per email.
func (a *AuthService) Login(ctx context.Context, authRequest *authDomain.AuthRequest) (*string, error) {
	return a.LoginFromIP(ctx, authRequest, "")
}

// LoginFromIP is Login with the client IP used for the attempt lockout.
func (a *AuthService) LoginFromIP(ctx context.Context, authRequest *authDomain.AuthRequest, ipAddress string) (*string, error) {
	user, err := a.authenticate(ctx, authRequest, ipAddress)
	if err != nil {
		return nil, err
	}

	return utils.CreateAccessToken(user.Id, a.config.JWT)
}

// LoginWithTokens authenticates a user and returns both access and refresh tokens
func (a *AuthService) LoginWithTokens(ctx context.Context, authRequest *authDomain.AuthRequest, userAgent, ipAddress string) (*authDomain.AuthResponse, error) {
	user, err := a.authenticate(ctx, authRequest, ipAddress)
	if err != nil {
		return nil, err
	}

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
	now := time.Now()

	newRaw, err := utils.GenerateRefreshToken()
	if err != nil {
		return nil, err
	}
	newTokenId := ksuid.New().String()
	newRefreshToken := authDomain.NewRefreshToken(
		newTokenId,
		"", // filled in by Rotate from the old token's owner
		authDomain.HashToken(newRaw),
		userAgent,
		ipAddress,
		now.Add(a.config.JWT.RefreshExpiration),
	)

	// Atomic rotation: revoke-old + insert-new in one transaction, guarded by
	// a conditional UPDATE so concurrent refreshes of the same token cannot
	// both succeed.
	userId, err := a.refreshTokenRepo.Rotate(ctx, tokenHash, newRefreshToken, now)
	if errors.Is(err, authRepo.ErrTokenNotActive) {
		return nil, a.rejectInactiveRefreshToken(ctx, tokenHash, now)
	}
	if err != nil {
		log.Error().Err(err).Msg("failed to rotate refresh token")
		return nil, err
	}

	accessToken, err := utils.CreateAccessToken(userId, a.config.JWT)
	if err != nil {
		return nil, err
	}

	log.Debug().
		Str("user_id", userId).
		Str("new_token_id", newTokenId).
		Msg("tokens refreshed successfully")

	return authDomain.NewAuthResponse(
		*accessToken,
		newRaw,
		int64(utils.AccessTokenTTL(a.config.JWT).Seconds()),
	), nil
}

func (a *AuthService) refreshReuseGrace() time.Duration {
	if a.config.JWT.RefreshReuseGrace > 0 {
		return a.config.JWT.RefreshReuseGrace
	}
	return defaultRefreshReuseGrace
}

// rejectInactiveRefreshToken explains why a token could not be rotated and
// applies reuse detection:
//   - unknown token                         → ErrInvalidRefreshToken
//   - rotated less than the grace ago       → ErrRefreshTokenRotated (no side effects)
//   - revoked otherwise (stale reuse/theft) → revoke all user sessions, ErrTokenReuse
//   - expired                               → ErrRefreshTokenExpired
func (a *AuthService) rejectInactiveRefreshToken(ctx context.Context, tokenHash string, now time.Time) error {
	storedToken, err := a.refreshTokenRepo.FindByHash(ctx, tokenHash)
	if err != nil {
		log.Error().Err(err).Msg("error finding refresh token")
		return ErrInvalidRefreshToken
	}
	if storedToken == nil {
		return ErrInvalidRefreshToken
	}

	if storedToken.IsRevoked() {
		if storedToken.ReplacedBy != nil && now.Sub(*storedToken.RevokedAt) <= a.refreshReuseGrace() {
			log.Info().
				Str("user_id", storedToken.UserId).
				Str("token_id", storedToken.Id).
				Msg("refresh token presented again within grace window (parallel refresh)")
			return ErrRefreshTokenRotated
		}
		// Potential token theft! Revoke all tokens for this user
		log.Warn().
			Str("user_id", storedToken.UserId).
			Str("token_id", storedToken.Id).
			Msg("refresh token reuse detected - revoking all user tokens")
		if err := a.refreshTokenRepo.RevokeAllForUser(ctx, storedToken.UserId); err != nil {
			log.Error().Err(err).Str("user_id", storedToken.UserId).Msg("failed to revoke user tokens after reuse")
		}
		return ErrTokenReuse
	}

	if storedToken.IsExpired() {
		return ErrRefreshTokenExpired
	}
	return ErrInvalidRefreshToken
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
			return utils.CreateAccessToken(existingUser.Id, a.config.JWT)
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
	account := accountDomain.NewAccount(money.FromInt(1000), accountID, "Cuenta Demo", "Banco Demo")
	account.UserId = userID
	if err := a.accountRepo.Save(ctx, account); err != nil {
		log.Error().Err(err).Msg("failed to save demo account")
		return nil, err
	}

	// 3. Create Categories
	// Income
	salaryCatID := uuid.New().String()
	salaryCat := categoryDomain.NewCategory(salaryCatID, "Salario", "💰", seedColorGreen)
	salaryCat.UserId = userID
	if err := a.categoryRepo.Save(ctx, salaryCat); err != nil {
		log.Error().Err(err).Msg("failed to save salary category")
		return nil, err
	}

	// Expense
	foodCatID := uuid.New().String()
	foodCat := categoryDomain.NewCategory(foodCatID, "Comida", "🍔", seedColorOrange)
	foodCat.UserId = userID
	if err := a.categoryRepo.Save(ctx, foodCat); err != nil {
		log.Error().Err(err).Msg("failed to save food category")
		return nil, err
	}

	transportCatID := uuid.New().String()
	transportCat := categoryDomain.NewCategory(transportCatID, "Transporte", "🚌", seedColorBlue)
	transportCat.UserId = userID
	if err := a.categoryRepo.Save(ctx, transportCat); err != nil {
		log.Error().Err(err).Msg("failed to save transport category")
		return nil, err
	}

	// 4. Create Budget (Optional)
	budgetID := uuid.New().String()
	budget := budgetDomain.NewBudget(budgetID, foodCatID, userID, money.FromInt(500))
	if err := a.budgetRepo.Save(ctx, budget); err != nil {
		log.Error().Err(err).Msg("failed to save demo budget")
	}

	// 5. Create Transactions (Dynamic Dates)
	now := time.Now()

	// Income: Salary (Today)
	tx1 := transactionDomain.NewTransaction(uuid.New().String(), "Nómina Mensual", "Ingreso del mes", "income", accountID, salaryCatID, money.FromInt(3000))
	tx1.UserId = userID
	tx1.CreatedAt = now
	if err := a.transactionRepo.Save(ctx, tx1); err != nil {
		log.Error().Err(err).Msg("failed to save tx1")
	}

	// Expense: Supermarket (2 days ago)
	tx2 := transactionDomain.NewTransaction(uuid.New().String(), "Supermercado Semanal", "Compra grande", "bill", accountID, foodCatID, money.FromInt(150))
	tx2.UserId = userID
	tx2.CreatedAt = now.AddDate(0, 0, -2)
	tx2.BudgetId = budgetID
	if err := a.transactionRepo.Save(ctx, tx2); err != nil {
		log.Error().Err(err).Msg("failed to save tx2")
	}

	// Expense: Transport (5 days ago)
	tx3 := transactionDomain.NewTransaction(uuid.New().String(), "Uber a casa", "Salida tarde", "bill", accountID, transportCatID, money.MustParse("25.50"))
	tx3.UserId = userID
	tx3.CreatedAt = now.AddDate(0, 0, -5)
	_ = a.transactionRepo.Save(ctx, tx3)

	// Logic for Token
	token, err := utils.CreateAccessToken(user.Id, a.config.JWT)
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
		ExpiresIn:    int64(utils.AccessTokenTTL(a.config.JWT).Seconds()),
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
