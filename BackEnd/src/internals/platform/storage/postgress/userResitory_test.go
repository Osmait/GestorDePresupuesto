package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"testing"

	"github.com/go-faker/faker/v4"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/assert"
)

type Config struct {
	// DataBase Configuration
	DbUser string
	DbPass string
	Dbhost string
	DbPort uint
	DbName string
}

func GetNewUser() *user.User {
	user1 := user.NewUser(faker.ID, faker.Name(), faker.LastName(), faker.Email(), faker.Password())
	return user1
}

func setUp() *sql.DB {
	err := godotenv.Load("../../../../../.env.test")
	if err != nil {
		fmt.Println("Not env")
	}
	var cfg Config
	dbPort, _ := strconv.Atoi(os.Getenv("DbPort"))
	cfg.DbName = os.Getenv("DbName")
	cfg.DbUser = os.Getenv("DbUser")
	cfg.DbPass = os.Getenv("DbPass")
	cfg.DbPort = uint(dbPort)
	cfg.Dbhost = "localhost"

	postgresURI := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", cfg.DbUser, cfg.DbPass, cfg.Dbhost, cfg.DbPort, cfg.DbName)
	db, err := sql.Open("postgres", postgresURI)
	if err != nil {
		log.Fatal().Err(err)
	}
	runDBMigration("file:../../../../cmd/api/db/migrations/", postgresURI)
	return db
}

func runDBMigration(migrationURL string, dbSource string) {
	migration, err := migrate.New(migrationURL, dbSource)
	if err != nil {
		log.Fatal().Err(err).Msg("cannot create new migrate instance")
	}

	if err = migration.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal().Err(err).Msg("failed to run migrate up")
	}

	log.Info().Msg("db migrated successfully")
}

func TestUserRespo(t *testing.T) {
	db := setUp()
	repo := NewUserRespository(db)
	ctx := context.Background()
	user := GetNewUser()
	err := repo.CreateUser(ctx, user)
	assert.NoError(t, err)

	userDb, err := repo.FindUser(ctx, user.Id)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, userDb.Id, user.Id)
	assert.NoError(t, err)
	err = repo.Delete(ctx, user.Id)
	assert.NoError(t, err)
}
