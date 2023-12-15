package boostrap

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/server"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/user"
	"github.com/rs/zerolog/log"
)

func Run() error {
	err := godotenv.Load(".env")
	if err != nil {
		fmt.Println("Not env")
	}
	var cfg Config
	shutdown := 10 * time.Second

	port, _ := strconv.Atoi(os.Getenv("PORT"))
	cfg.shutdownTimeout = &shutdown
	dbPort, _ := strconv.Atoi(os.Getenv("DbPort"))
	cfg.Port = uint(port)
	cfg.Host = os.Getenv("HOST")

	cfg.DbName = os.Getenv("DbName")
	cfg.DbUser = os.Getenv("DbUser")
	cfg.DbPass = os.Getenv("DbPass")
	cfg.DbPort = uint(dbPort)
	cfg.Dbhost = os.Getenv("Dbhost")

	postgresURI := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", cfg.DbUser, cfg.DbPass, cfg.Dbhost, cfg.DbPort, cfg.DbName)

	db, err := sql.Open("postgres", postgresURI)
	if err != nil {
		return err
	}
	runDBMigration("file://src/cmd/api/db/migrations", postgresURI)

	accountRepository := postgress.NewCourseRepository(db)
	transactionRepository := postgress.NewTransactionRepository(db)
	userRepository := postgress.NewUserRespository(db)
	accountSerevice := account.NewAccountService(accountRepository)
	transactionServices := transaction.NewTransactionService(transactionRepository)
	userServices := user.NewUserService(userRepository)
	ctx, srv := server.New(context.Background(), cfg.Host, cfg.Port, cfg.shutdownTimeout, accountSerevice, transactionServices, userServices)
	return srv.Run(ctx)
}

func runDBMigration(migrationURL string, dbSource string) {
	fmt.Println(migrationURL)
	migration, err := migrate.New(migrationURL, dbSource)
	if err != nil {
		log.Fatal().Err(err).Msg("cannot create new migrate instance")
	}

	// if err = migration.Force(2); err != nil {
	// 	log.Fatal().Err(err)
	// }
	if err = migration.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal().Err(err).Msg("failed to run migrate up")
	}

	log.Info().Msg("db migrated successfully")
}

type Config struct {
	// Server Configuration
	Host            string
	Port            uint
	shutdownTimeout *time.Duration

	// DataBase Configuration

	DbUser string
	DbPass string
	Dbhost string
	DbPort uint
	DbName string
}
