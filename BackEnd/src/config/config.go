package config

import (
	"fmt"
	"time"
)

type DatabaseType string

const (
	DatabaseTypePostgres DatabaseType = "postgres"
	DatabaseTypeSQLite   DatabaseType = "sqlite"
)

type Config struct {
	ShutdownTimeout *time.Duration
	Host            string
	DbUser          string
	DbPass          string
	Dbhost          string
	DbName          string
	Port            uint
	DbPort          uint
	DbType          DatabaseType
}

func NewConfig(host string, Port, Dbport uint, shutdownTimeout *time.Duration, DbUser, DbPass, Dbhost, DbName string) *Config {
	return &Config{
		Host:            host,
		Port:            Port,
		ShutdownTimeout: shutdownTimeout,
		DbUser:          DbUser,
		Dbhost:          Dbhost,
		DbPass:          DbPass,
		DbPort:          Dbport,
		DbName:          DbName,
		DbType:          DatabaseTypePostgres, // default to postgres
	}
}

func NewConfigDb(Dbport uint, DbUser, DbPass, Dbhost, DbName string) *Config {
	return &Config{
		DbUser: DbUser,
		DbPass: DbPass,
		DbPort: Dbport,
		DbName: DbName,
		DbType: DatabaseTypePostgres, // default to postgres
	}
}

// NewConfigSQLite creates a new config for SQLite (typically for testing)
func NewConfigSQLite(dbName string) *Config {
	return &Config{
		DbName: dbName,
		DbType: DatabaseTypeSQLite,
	}
}

func (c *Config) GetPostgresUrl() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", c.DbUser, c.DbPass, c.Dbhost, c.DbPort, c.DbName)
}

func (c *Config) GetSQLiteUrl() string {
	// For in-memory SQLite
	if c.DbName == ":memory:" {
		return "sqlite3://:memory:"
	}
	return fmt.Sprintf("sqlite3://%s", c.DbName)
}

func (c *Config) GetDatabaseUrl() string {
	switch c.DbType {
	case DatabaseTypeSQLite:
		return c.GetSQLiteUrl()
	case DatabaseTypePostgres:
		return c.GetPostgresUrl()
	default:
		return c.GetPostgresUrl()
	}
}

func (c *Config) GetServerUrl() string {
	return fmt.Sprintf("http:%s:%d", c.Host, c.Port)
}
