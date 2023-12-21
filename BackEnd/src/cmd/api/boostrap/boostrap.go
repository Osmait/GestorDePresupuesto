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
	"github.com/osmait/gestorDePresupuesto/src/config"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/server"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/auth"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/user"
)

func Run() error {
	err := godotenv.Load(".env")
	if err != nil {
		fmt.Println("Not env")
	}
	shutdown := 10 * time.Second
	port, _ := strconv.Atoi(os.Getenv("PORT"))
	dbPort, _ := strconv.Atoi(os.Getenv("DbPort"))
	cfg := config.NewConfig(os.Getenv("HOST"), uint(port), uint(dbPort), &shutdown, os.Getenv("DbUser"), os.Getenv("DbPass"), os.Getenv("Dbhost"), os.Getenv("DbName"))

	postgresURI := cfg.GetPostgresUrl()

	db, err := sql.Open("postgres", postgresURI)
	if err != nil {
		return err
	}
	utils.RunDBMigration("file://src/cmd/api/db/migrations", postgresURI)

	accountRepository := postgress.NewAccountRepository(db)
	transactionRepository := postgress.NewTransactionRepository(db)
	userRepository := postgress.NewUserRespository(db)
	accountSerevice := account.NewAccountService(accountRepository)
	transactionServices := transaction.NewTransactionService(transactionRepository)
	userServices := user.NewUserService(userRepository)
	authServices := auth.NewAuthService(userRepository)

	ctx, srv := server.New(context.Background(), cfg.Host, cfg.Port, cfg.ShutdownTimeout, accountSerevice, transactionServices, userServices, authServices)

	return srv.Run(ctx)
}
