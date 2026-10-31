package config

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMigrationPostgresUrl(t *testing.T) {
	c := &Config{Database: DatabaseConfig{
		User: "gestor_app", Password: "app-pw", Host: "db.example", Port: 5432, Name: "neondb", SSLMode: "require",
	}}
	assert.Equal(t, c.GetPostgresUrl(), c.GetMigrationPostgresUrl(), "without DB_MIGRATION_USER the app credentials")

	c.Database.MigrationUser = "neondb_owner"
	c.Database.MigrationPassword = "owner p@ss"
	assert.Equal(t, "postgres://neondb_owner:owner%20p%40ss@db.example:5432/neondb?sslmode=require&binary_parameters=yes",
		c.GetMigrationPostgresUrl())
	assert.Contains(t, c.GetPostgresUrl(), "gestor_app:app-pw@", "the application URL is unchanged")

	out, err := json.Marshal(c.Database)
	require.NoError(t, err)
	assert.NotContains(t, string(out), "owner p@ss", "the migration password is never serialized")
}
