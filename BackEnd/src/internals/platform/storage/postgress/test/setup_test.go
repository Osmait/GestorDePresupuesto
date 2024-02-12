package postgress

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"

	"github.com/rs/zerolog/log"

	"github.com/joho/godotenv"
	"github.com/osmait/gestorDePresupuesto/src/config"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
)

func SetUpTest() *sql.DB {
	err := godotenv.Load("../../../../../../.env.test")
	if err != nil {
		fmt.Println("Not env")
	}
	dbPort, _ := strconv.Atoi(os.Getenv("DbPort"))
	cfg := config.NewConfigDb(uint(dbPort), os.Getenv("DbUser"), os.Getenv("DbPass"), os.Getenv("Dbhost"), os.Getenv("DbName"))

	postgresURI := cfg.GetPostgresUrl()

	db, err := sql.Open("postgres", postgresURI)
	if err != nil {
		log.Fatal().Err(err)
	}
	utils.RunDBMigration("file:../../../../../cmd/api/db/migrations/", postgresURI)

	return db
}
