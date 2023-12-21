package config

import (
	"fmt"
	"time"
)

type Config struct {
	// Server Configuration
	Host            string
	Port            uint
	ShutdownTimeout *time.Duration

	// DataBase Configuration

	DbUser string
	DbPass string
	Dbhost string
	DbPort uint
	DbName string
}

func NewConfig(host string, Port, Dbport uint, shutdownTimeout *time.Duration, DbUser, DbPass, Dbhost, DbName string) *Config {
	return &Config{
		Host:            host,
		Port:            Port,
		ShutdownTimeout: shutdownTimeout,
		DbUser:          DbUser,
		DbPass:          DbPass,
		DbPort:          Dbport,
		DbName:          DbName,
	}
}

func NewConfigDb(Dbport uint, DbUser, DbPass, Dbhost, DbName string) *Config {
	return &Config{
		DbUser: DbUser,
		DbPass: DbPass,
		DbPort: Dbport,
		DbName: DbName,
	}
}

func (c *Config) GetPostgresUrl() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", c.DbUser, c.DbPass, c.Dbhost, c.DbPort, c.DbName)
}
