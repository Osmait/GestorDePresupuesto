package apitest

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	cors "github.com/rs/cors/wrapper/gin"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/routes"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	accountSvc "github.com/osmait/gestorDePresupuesto/internal/services/account"
	authSvc "github.com/osmait/gestorDePresupuesto/internal/services/auth"
	userSvc "github.com/osmait/gestorDePresupuesto/internal/services/user"
)

var (
	testDB     *sql.DB
	testEngine *gin.Engine
	testCfg    *config.Config
)

const testJWTSecret = "api-integration-test-secret-key-long-enough-32chars"

func TestMain(m *testing.M) {
	ctx := context.Background()

	req := testcontainers.ContainerRequest{
		Image:        "postgres:17-alpine",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_DB":       "apitestdb",
			"POSTGRES_USER":     "apitest",
			"POSTGRES_PASSWORD": "apitest",
		},
		WaitingFor: wait.ForLog("database system is ready to accept connections").
			WithOccurrence(2).
			WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		log.Fatalf("failed to start postgres container: %v", err)
	}
	defer func() {
		if err := container.Terminate(ctx); err != nil {
			log.Printf("failed to terminate container: %v", err)
		}
	}()

	host, err := container.Host(ctx)
	if err != nil {
		log.Fatalf("failed to get container host: %v", err)
	}

	mappedPort, err := container.MappedPort(ctx, "5432/tcp")
	if err != nil {
		log.Fatalf("failed to get mapped port: %v", err)
	}

	connStr := fmt.Sprintf("postgres://apitest:apitest@%s:%s/apitestdb?sslmode=disable", host, mappedPort.Port())

	testDB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("failed to open test database: %v", err)
	}

	_, filename, _, _ := runtime.Caller(0)
	migrationsDir, _ := filepath.Abs(filepath.Join(filepath.Dir(filename), "../../../../cmd/api/db/migrations"))
	utils.RunDBMigration("file://"+filepath.ToSlash(migrationsDir), connStr)

	testCfg = newTestConfig()

	gin.SetMode(gin.TestMode)
	testEngine = buildRouter(testDB, testCfg)

	os.Exit(m.Run())
}

func newTestConfig() *config.Config {
	return &config.Config{
		Server: config.ServerConfig{
			Host:            "localhost",
			Port:            8080,
			Environment:     "test",
			ShutdownTimeout: 30 * time.Second,
		},
		JWT: config.JWTConfig{
			Secret:            testJWTSecret,
			Expiration:        24 * time.Hour,
			RefreshExpiration: 7 * 24 * time.Hour,
		},
		RateLimit: config.RateLimitConfig{
			Enabled: false,
		},
		Security: config.SecurityConfig{
			PasswordMinLength:     8,
			PasswordRequireUpper:  false,
			PasswordRequireLower:  false,
			PasswordRequireDigit:  false,
			PasswordRequireSymbol: false,
			MaxLoginAttempts:      100,
			AccountLockTime:       15 * time.Minute,
		},
	}
}

func buildRouter(db *sql.DB, cfg *config.Config) *gin.Engine {
	userRepository := userRepo.NewUserRepository(db)
	accountRepository := accountRepo.NewAccountRepository(db)
	categoryRepository := categoryRepo.NewCategoryRepository(db)
	budgetRepository := budgetRepo.NewBudgetRepository(db)
	transactionRepository := transactionRepo.NewTransactionRepository(db)

	userService := userSvc.NewUserService(userRepository)
	authService := authSvc.NewAuthService(
		userRepository,
		accountRepository,
		categoryRepository,
		budgetRepository,
		transactionRepository,
		cfg,
	)
	accountService := accountSvc.NewAccountService(accountRepository)

	r := gin.New()
	r.Use(cors.AllowAll())
	r.Use(middleware.ErrorHandler(middleware.DefaultErrorHandlerConfig()))
	r.Use(middleware.RateLimitMiddleware(cfg))
	r.Use(middleware.AuthMiddleware(userService, cfg))

	routes.AuhtRoutes(r, authService)
	routes.UserRoute(r, userService)
	routes.AccountRotes(r, accountService)

	return r
}
