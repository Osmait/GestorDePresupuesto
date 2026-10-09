package utils

import (
	"errors"
	"fmt"
	"io/fs"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/lib/pq"
	"github.com/rs/zerolog/log"
)

// ErrDirtyDatabase is returned when the schema_migrations table is marked
// dirty, i.e. a previous migration failed half-way. The runner never tries to
// repair this automatically: an operator must inspect the database, fix the
// partial migration and run `migrate force <version>` before the app can start.
var ErrDirtyDatabase = errors.New("database migration state is dirty")

// RunMigrationsFromFS applies all pending up-migrations found in dir inside
// fsys (typically an embed.FS compiled into the binary).
func RunMigrationsFromFS(fsys fs.FS, dir string, dbSource string) error {
	src, err := iofs.New(fsys, dir)
	if err != nil {
		return fmt.Errorf("open embedded migrations: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dbSource)
	if err != nil {
		return fmt.Errorf("create migrate instance: %w", err)
	}
	return runUp(m)
}

// RunDBMigration applies all pending up-migrations from a golang-migrate
// source URL (e.g. "file:///abs/path/to/migrations").
func RunDBMigration(migrationURL string, dbSource string) error {
	m, err := migrate.New(migrationURL, dbSource)
	if err != nil {
		return fmt.Errorf("create migrate instance: %w", err)
	}
	return runUp(m)
}

func runUp(m *migrate.Migrate) (err error) {
	defer func() {
		srcErr, dbErr := m.Close()
		if err == nil {
			if srcErr != nil {
				err = fmt.Errorf("close migration source: %w", srcErr)
			} else if dbErr != nil {
				err = fmt.Errorf("close migration database: %w", dbErr)
			}
		}
	}()

	version, dirty, err := m.Version()
	if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
		return fmt.Errorf("read migration version: %w", err)
	}
	if dirty {
		return fmt.Errorf("%w at version %d: fix the partially applied migration manually, then run `migrate force <last-good-version>`; refusing to start", ErrDirtyDatabase, version)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations (starting from version %d): %w", version, err)
	}

	newVersion, _, err := m.Version()
	if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
		return fmt.Errorf("read migration version: %w", err)
	}
	log.Info().Uint("from_version", version).Uint("version", newVersion).Msg("db migrated successfully")
	return nil
}

// DownDBMigration rolls back every migration from a golang-migrate source URL.
func DownDBMigration(migrationURL string, dbSource string) (err error) {
	m, err := migrate.New(migrationURL, dbSource)
	if err != nil {
		return fmt.Errorf("create migrate instance: %w", err)
	}
	defer func() {
		if srcErr, dbErr := m.Close(); err == nil && (srcErr != nil || dbErr != nil) {
			err = fmt.Errorf("close migrate instance: %v / %v", srcErr, dbErr)
		}
	}()

	if err := m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("run migrate down: %w", err)
	}
	log.Info().Msg("db migrated down successfully")
	return nil
}
