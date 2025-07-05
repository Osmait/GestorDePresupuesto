package boostrap

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"time"

	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"

	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"

	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
)

func Run() error {
	// load .env
	err := godotenv.Load(".env")
	if err != nil {
		fmt.Println("Not env")
	}

	// Creating new config
	shutdown := 10 * time.Second
	port, _ := strconv.Atoi(os.Getenv("PORT"))
	dbPort, _ := strconv.Atoi(os.Getenv("DbPort"))

	cfg := config.NewConfig(os.Getenv("HOST"), uint(port), uint(dbPort), &shutdown, os.Getenv("DbUser"), os.Getenv("DbPass"), os.Getenv("Dbhost"), os.Getenv("DbName"))
	postgresURI := cfg.GetPostgresUrl()

	// Conecting database
	db, err := sql.Open("postgres", postgresURI)
	if err != nil {
		return err
	}
	// Run migrate
	utils.RunDBMigration("file://src/cmd/api/db/migrations", postgresURI)

	// Instance Repositorys
	accountRepository := accountRepo.NewAccountRepository(db)
	transactionRepository := transactionRepo.NewTransactionRepository(db)
	userRepository := userRepo.NewUserRespository(db)
	budgetRepository := budgetRepo.NewBudgetRepository(db)
	categoryRepository := categoryRepo.NewCategoryRepository(db)

	// Instance Services
	accountSerevice := account.NewAccountService(accountRepository)
	transactionServices := transaction.NewTransactionService(transactionRepository)
	userServices := user.NewUserService(userRepository)
	authServices := auth.NewAuthService(userRepository)
	budgetServices := budget.NewBudgetServices(budgetRepository, transactionRepository)
	categoryServices := category.NewCategoryServices(categoryRepository)

	// Instance Server
	ctx, srv := server.New(context.Background(), cfg.Host, cfg.Port, cfg.ShutdownTimeout, accountSerevice, transactionServices, userServices, authServices, budgetServices, categoryServices, db, cfg)

	// Run Server
	return srv.Run(ctx)
}
