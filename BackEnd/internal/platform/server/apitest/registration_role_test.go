package apitest

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/go-faker/faker/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func roleOf(t *testing.T, email string) string {
	t.Helper()
	var role string
	require.NoError(t, testDB.QueryRow("SELECT role FROM users WHERE email = $1", email).Scan(&role))
	return role
}

// Regression: the public registration copied "role" from the body, so anyone
// could sign up as ADMIN and reach every admin endpoint.
func TestRegister_IgnoresRequestedRole(t *testing.T) {
	for _, role := range []string{"ADMIN", "admin", "SUPERUSER"} {
		t.Run(role, func(t *testing.T) {
			email := faker.Email()
			body := fmt.Sprintf(`{"name":"Eve","last_name":"Smith","email":"%s","password":"TestPass1234","role":"%s"}`, email, role)
			w := doRequest(t, http.MethodPost, "/user", "", body)
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			assert.Equal(t, "USER", roleOf(t, email))

			token := loginUser(t, email, "TestPass1234")
			w = doRequest(t, http.MethodGet, "/users", token, "")
			assert.Equal(t, http.StatusForbidden, w.Code, "a self-registered user must not reach admin routes")
		})
	}
}

func TestAdminCreateUser_SetsRole(t *testing.T) {
	admin := createAndLoginUser(t)
	promoteToAdmin(t, admin.ID)
	admin.Token = loginUser(t, admin.Email, admin.Password)

	email := faker.Email()
	body := fmt.Sprintf(`{"name":"Ann","last_name":"Admin","email":"%s","password":"TestPass1234","role":"ADMIN"}`, email)
	w := doRequest(t, http.MethodPost, "/users", admin.Token, body)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	assert.Equal(t, "ADMIN", roleOf(t, email))

	w = doRequest(t, http.MethodPost, "/users", admin.Token,
		fmt.Sprintf(`{"name":"Bob","last_name":"Bad","email":"%s","password":"TestPass1234","role":"ROOT"}`, faker.Email()))
	assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
}
