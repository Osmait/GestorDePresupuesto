package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	authRequest "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	budgetDomain "github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	transactionDomain "github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	userDomain "github.com/osmait/gestorDePresupuesto/internal/domain/user"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

// AuthService handles authentication and authorization logic.
type AuthService struct {
	repo            userRepo.UserRepositoryInterface
	accountRepo     accountRepo.AccountRepositoryInterface
	categoryRepo    categoryRepo.CategoryRepoInterface
	budgetRepo      budgetRepo.BudgetRepoInterface
	transactionRepo transactionRepo.TransactionRepositoryInterface
	config          *config.Config
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

// Login authenticates a user by email and password, returning a JWT token if successful.
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

// CreateDemoUser creates a temporary demo user with pre-seeded data (accounts, categories, transactions) for trial purposes.
func (a *AuthService) CreateDemoUser(ctx context.Context) (*string, error) {
	// 1. Create Demo User
	userID := uuid.New().String()
	password := "demo123" // Temporary password
	hashPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	user := userDomain.NewUser(userID, "Demo User", "Minimizado", "demo+"+userID+"@example.com", string(hashPassword))
	user.IsDemo = true
	user.Confirmed = "true"

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
