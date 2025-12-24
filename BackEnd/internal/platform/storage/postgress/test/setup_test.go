package postgress

import (
	"database/sql"

	"github.com/rs/zerolog/log"

	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

func SetUpTest() *sql.DB {
	// Create in-memory SQLite database
	db := utils.CreateInMemorySQLiteDB()

	// Setup SQLite schema
	err := utils.SetupSQLiteSchema(db)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to setup SQLite schema")
	}

	return db
}

// SetUpTestWithCleanup creates a test database and returns a cleanup function
func SetUpTestWithCleanup() (*sql.DB, func()) {
	db := SetUpTest()

	cleanup := func() {
		if db != nil {
			_ = db.Close()
		}
	}

	return db, cleanup
}
