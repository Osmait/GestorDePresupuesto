package boostrap

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/server"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/account"
	"github.com/rs/zerolog/log"
)

func Run() error {
	var cfg Config
	cfg.Port = 8080
	cfg.Host = "localhost"
	cfg.DbName = "my_store"
	cfg.DbUser = "osmait"
	cfg.DbPass = "admin123"
	cfg.DbPort = 5432
	cfg.Dbhost = "localhost"

	postgresURI := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", cfg.DbUser, cfg.DbPass, cfg.Dbhost, cfg.DbPort, cfg.DbName)

	db, err := sql.Open("postgres", postgresURI)
	if err != nil {
		return err
	}
	runDBMigration("file:///home/osmait/Documents/WorkSpace/GestorDePresupuesto/BackEnd/src/cmd/api/db/migrations", postgresURI)
	accountRepository := postgress.NewCourseRepository(db)
	accountSerevice := account.NewAccountService(*accountRepository)

	ctx, srv := server.New(context.Background(), cfg.Host, cfg.Port, cfg.shutdownTimeout, accountSerevice)
	return srv.Run(ctx)

}

func runDBMigration(migrationURL string, dbSource string) {
	fmt.Println(migrationURL)
	migration, err := migrate.New(migrationURL, dbSource)
	if err != nil {
		log.Fatal().Err(err).Msg("cannot create new migrate instance")
	}

	if err = migration.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal().Err(err).Msg("failed to run migrate up")
	}

	log.Info().Msg("db migrated successfully")
}

type Config struct {
	//Server Configuration
	Host            string        `default:"localhost"`
	Port            uint          `default:"8080"`
	shutdownTimeout time.Duration `default:"10s"`

	// DataBase Configuration

	DbUser    string        `default:"osmait"`
	DbPass    string        `default:"admin123"`
	Dbhost    string        `default:"localhost"`
	DbPort    uint          `default:"5432"`
	DbName    string        `default:"my_store"`
	DbTimeout time.Duration `default:"5s"`
}
