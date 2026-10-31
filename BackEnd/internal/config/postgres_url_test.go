package config

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A password with URL metacharacters must reach the driver unchanged instead
// of breaking (or redirecting) the connection string.
func TestGetPostgresUrl_EscapesCredentials(t *testing.T) {
	t.Parallel()
	c := &Config{Database: DatabaseConfig{
		User: "app", Password: "p@ss:w/rd%41?x", Host: "db.example.com", Port: 5432, Name: "budget", SSLMode: "require",
	}}
	u, err := url.Parse(c.GetPostgresUrl())
	require.NoError(t, err)
	pass, _ := u.User.Password()
	assert.Equal(t, "p@ss:w/rd%41?x", pass)
	assert.Equal(t, "db.example.com:5432", u.Host)
	assert.Equal(t, "/budget", u.Path)
	assert.Equal(t, "require", u.Query().Get("sslmode"))
	assert.Equal(t, "yes", u.Query().Get("binary_parameters"))

	plain := &Config{Database: DatabaseConfig{User: "osmait", Password: "admin123", Host: "localhost", Port: 5432, Name: "my_store", SSLMode: "disable"}}
	assert.Equal(t, "postgres://osmait:admin123@localhost:5432/my_store?sslmode=disable&binary_parameters=yes", plain.GetPostgresUrl())
}
