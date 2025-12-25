package utils

import (
	"database/sql"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
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

// RunSQLiteMigration runs SQLite migrations using the appropriate migration files
func RunSQLiteMigration(migrationURL string, dbSource string) {
	migration, err := migrate.New(migrationURL, dbSource)
	if err != nil {
		log.Fatal().Err(err).Msg("cannot create new migrate instance for SQLite")
	}

	if err = migration.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal().Err(err).Msg("failed to run SQLite migrate up")
	}

	log.Info().Msg("SQLite db migrated successfully")
}

// CreateInMemorySQLiteDB creates an in-memory SQLite database with schema
func CreateInMemorySQLiteDB() *sql.DB {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		log.Fatal().Err(err).Msg("cannot create in-memory SQLite database")
	}

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatal().Err(err).Msg("cannot ping in-memory SQLite database")
	}

	return db
}

// SetupPostgreSQLSchema sets up the PostgreSQL schema directly without migrations
func SetupPostgreSQLSchema(db *sql.DB) error {
	schema := `
	-- PostgreSQL schema for E2E testing
	DROP TABLE IF EXISTS transactions CASCADE;
	DROP TABLE IF EXISTS budgets CASCADE;
	DROP TABLE IF EXISTS categorys CASCADE;
	DROP TABLE IF EXISTS account CASCADE;
	DROP TABLE IF EXISTS users CASCADE;
	DROP TABLE IF EXISTS cryptos CASCADE;
	DROP TABLE IF EXISTS listings CASCADE;
	DROP TABLE IF EXISTS notifications CASCADE;
	DROP TABLE IF EXISTS recurring_transactions CASCADE;
	DROP TABLE IF EXISTS investments CASCADE;
	DROP TYPE IF EXISTS TypeTransaction CASCADE;

	CREATE TYPE TypeTransaction AS ENUM (
		'bill',
		'income'
	);

	CREATE TABLE users(
		id VARCHAR PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		last_name VARCHAR(255) NOT NULL,
		email VARCHAR(255) UNIQUE NOT NULL,
		password VARCHAR(255) NOT NULL,
		token VARCHAR(32),
		confirmed BOOLEAN DEFAULT false,
		ip_address VARCHAR(45),
		role VARCHAR(20) DEFAULT 'USER',
		created_at timestamptz NOT NULL DEFAULT (now())
	);

	CREATE TABLE account (
		id VARCHAR(32) PRIMARY KEY,
		name_account VARCHAR(255),
		bank VARCHAR(255),
		balance float,
		user_id VARCHAR NOT NULL,
		created_at timestamptz NOT NULL DEFAULT (now()),
		FOREIGN KEY (user_id) REFERENCES users (id)
	);

	CREATE TABLE categorys(
		id VARCHAR PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		icon VARCHAR(255) NOT NULL,
		color VARCHAR(255) NOT NULL,
		created_at timestamptz NOT NULL DEFAULT (now()),
		user_id VARCHAR NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users (id)
	);

	CREATE TABLE budgets (
		id VARCHAR PRIMARY KEY,
		category_id VARCHAR NOT NULL,
		amount float NOT NULL,
		created_at timestamptz NOT NULL DEFAULT (now()),
		user_id VARCHAR NOT NULL,
		FOREIGN KEY (category_id) REFERENCES categorys (id),
		FOREIGN KEY (user_id) REFERENCES users (id)
	);

	CREATE TABLE transactions (
		id VARCHAR PRIMARY KEY,
		transaction_name VARCHAR NOT NULL,
		transaction_description TEXT,
		amount float NOT NULL,
		type_transation TypeTransaction NOT NULL,
		account_id VARCHAR NOT NULL,
		user_id VARCHAR NOT NULL,
		category_id VARCHAR NOT NULL,
		budget_id VARCHAR,
		created_at timestamptz NOT NULL DEFAULT (now()),
		FOREIGN KEY (account_id) REFERENCES account (id),
		FOREIGN KEY (user_id) REFERENCES users (id),
		FOREIGN KEY (category_id) REFERENCES categorys (id),
		FOREIGN KEY (budget_id) REFERENCES budgets (id)
	);

	CREATE TABLE cryptos(
		id VARCHAR PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		price float NOT NULL,
		current_price float NOT NULL,
		quantity float NOT NULL,
		created_at timestamptz NOT NULL DEFAULT (now()),
		user_id VARCHAR NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users (id)
	);

	-- Additional table for investment repository compatibility
	CREATE TABLE investments(
		id VARCHAR PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		price float NOT NULL,
		current_price float NOT NULL,
		quantity float NOT NULL,
		created_at timestamptz NOT NULL DEFAULT (now()),
		user_id VARCHAR NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users (id)
	);
	`

	// Split the schema into individual statements
	statements := strings.Split(schema, ";")

	for _, statement := range statements {
		trimmed := strings.TrimSpace(statement)
		if trimmed != "" {
			_, err := db.Exec(trimmed)
			if err != nil {
				log.Error().Err(err).Str("statement", trimmed).Msg("failed to execute PostgreSQL schema statement")
				return err
			}
		}
	}

	log.Info().Msg("PostgreSQL schema setup successfully")
	return nil
}

// SetupSQLiteSchema sets up the SQLite schema directly without migrations
func SetupSQLiteSchema(db *sql.DB) error {
	schema := `
	-- SQLite compatible schema for testing
	CREATE TABLE IF NOT EXISTS users(
		id VARCHAR PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		last_name VARCHAR(255) NOT NULL,
		email VARCHAR(255) UNIQUE NOT NULL,
		password VARCHAR(255) NOT NULL,
		token VARCHAR(32),
		is_demo BOOLEAN DEFAULT 0,
		confirmed BOOLEAN DEFAULT 0,
		ip_address VARCHAR(45),
		role VARCHAR(20) DEFAULT 'USER',
		created_at DATETIME NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS account (
		id VARCHAR(32) PRIMARY KEY,
		name_account VARCHAR(255),
		bank VARCHAR(255),
		balance REAL,
		user_id VARCHAR NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (user_id) REFERENCES users (id)
	);

	CREATE TABLE IF NOT EXISTS categorys(
		id VARCHAR PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		icon VARCHAR(255) NOT NULL,
		color VARCHAR(255) NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now')),
		user_id VARCHAR NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users (id)
	);

	CREATE TABLE IF NOT EXISTS budgets (
		id VARCHAR PRIMARY KEY,
		category_id VARCHAR NOT NULL,
		amount REAL NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now')),
		user_id VARCHAR NOT NULL,
		FOREIGN KEY (category_id) REFERENCES categorys (id),
		FOREIGN KEY (user_id) REFERENCES users (id)
	);

	CREATE TABLE IF NOT EXISTS transactions (
		id VARCHAR PRIMARY KEY,
		transaction_name VARCHAR NOT NULL,
		transaction_description TEXT,
		amount REAL NOT NULL,
		type_transation VARCHAR NOT NULL CHECK (type_transation IN ('bill', 'income')),
		account_id VARCHAR NOT NULL,
		user_id VARCHAR NOT NULL,
		category_id VARCHAR NOT NULL,
		budget_id VARCHAR,
		created_at DATETIME NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (account_id) REFERENCES account (id),
		FOREIGN KEY (user_id) REFERENCES users (id),
		FOREIGN KEY (category_id) REFERENCES categorys (id),
		FOREIGN KEY (budget_id) REFERENCES budgets (id)
	);

	CREATE TABLE IF NOT EXISTS cryptos(
		id VARCHAR PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		price REAL NOT NULL,
		current_price REAL NOT NULL,
		quantity REAL NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now')),
		user_id VARCHAR NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users (id)
	);

	-- Additional table for investment repository compatibility
	CREATE TABLE IF NOT EXISTS investments(
		id VARCHAR PRIMARY KEY,
		investment_type VARCHAR NOT NULL CHECK (investment_type IN ('stock', 'crypto', 'fixed_income')),
		name VARCHAR(255) NOT NULL,
		symbol VARCHAR(10) NOT NULL,
		quantity REAL NOT NULL,
		purchase_price REAL NOT NULL,
		current_price REAL NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now')),
		updated_at DATETIME,
		user_id VARCHAR NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users (id)
	);
	CREATE TABLE IF NOT EXISTS recurring_transactions (
		id VARCHAR PRIMARY KEY,
		user_id VARCHAR NOT NULL,
		name VARCHAR(255) NOT NULL,
		description TEXT,
		amount DECIMAL(15, 2) NOT NULL,
		type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'bill')),
		account_id VARCHAR,
		category_id VARCHAR,
		budget_id VARCHAR,
		day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
		last_execution_date DATETIME,
		created_at DATETIME NOT NULL DEFAULT (datetime('now')),
		updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (account_id) REFERENCES account(id) ON DELETE SET NULL,
		FOREIGN KEY (category_id) REFERENCES categorys(id) ON DELETE SET NULL,
		FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS notifications (
		id VARCHAR PRIMARY KEY,
		user_id VARCHAR(255) NOT NULL,
		type VARCHAR(50) NOT NULL,
		message TEXT NOT NULL,
		amount REAL,
		is_read BOOLEAN DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT (datetime('now'))
	);
	`

	// Split the schema into individual statements
	statements := strings.Split(schema, ";")

	for _, statement := range statements {
		trimmed := strings.TrimSpace(statement)
		if trimmed != "" {
			_, err := db.Exec(trimmed)
			if err != nil {
				log.Error().Err(err).Str("statement", trimmed).Msg("failed to execute schema statement")
				return err
			}
		}
	}

	log.Info().Msg("SQLite schema setup successfully")
	return nil
}
