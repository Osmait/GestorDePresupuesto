package utils

import (
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"github.com/rs/zerolog/log"
)

func RunDBMigration(migrationURL string, dbSource string) {
	migration, err := migrate.New(migrationURL, dbSource)
	if err != nil {
		log.Fatal().Err(err).Msg("cannot create new migrate instance")
	}

	version, dirty, err := migration.Version()
	if err != nil && err != migrate.ErrNilVersion {
		log.Error().Err(err).Msg("failed to get migration version")
	}

	if dirty {
		log.Warn().Int("version", int(version)).Msg("Database is dirty. Forcing previous version to retry.")
		forceVersion := int(version) - 1
		if forceVersion < 0 {
			forceVersion = 0
		}
		if err := migration.Force(forceVersion); err != nil {
			log.Fatal().Err(err).Msg("failed to force migration version")
		}
	}

	if err = migration.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal().Err(err).Msg("failed to run migrate up")
	}

	log.Info().Int("version", int(version)).Msg("db migrated successfully")
}

func DownDBMigration(migrationURL string, dbSource string) {
	migration, err := migrate.New(migrationURL, dbSource)
	if err != nil {
		log.Fatal().Err(err).Msg("cannot create new migrate instance")
	}

	if err = migration.Down(); err != nil && err != migrate.ErrNoChange {
		log.Fatal().Err(err).Msg("failed to run migrate up")
	}

	log.Info().Msg("db migrated successfully")
}
