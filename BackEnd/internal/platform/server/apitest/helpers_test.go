package apitest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-faker/faker/v4"
	"github.com/stretchr/testify/require"
)

// testUser holds credentials for a test user created during a test.
type testUser struct {
	ID       string
	Email    string
	Password string
	Token    string
}

// createUser registers a new user via POST /user and returns their credentials.
// The token field is empty; call loginUser or createAndLoginUser to populate it.
func createUser(t *testing.T) testUser {
	t.Helper()

	email := faker.Email()
	password := "TestPass1234"

	body := fmt.Sprintf(`{"name":"Test","last_name":"User","email":"%s","password":"%s"}`, email, password)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/user", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "createUser failed: %s", w.Body.String())

	var userID string
	err := testDB.QueryRow("SELECT id FROM users WHERE email = $1", email).Scan(&userID)
	require.NoError(t, err)

	return testUser{ID: userID, Email: email, Password: password}
}

// loginUser authenticates via POST /login and returns the JWT token.
func loginUser(t *testing.T, email, password string) string {
	t.Helper()

	body := fmt.Sprintf(`{"email":"%s","password":"%s"}`, email, password)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "loginUser failed: %s", w.Body.String())

	var token string
	err := json.Unmarshal(w.Body.Bytes(), &token)
	require.NoError(t, err)
	require.NotEmpty(t, token)

	return token
}

// createAndLoginUser creates a user and logs them in, returning credentials with token.
func createAndLoginUser(t *testing.T) testUser {
	t.Helper()

	user := createUser(t)
	user.Token = loginUser(t, user.Email, user.Password)
	return user
}

// promoteToAdmin sets a user's role to ADMIN directly in the database.
func promoteToAdmin(t *testing.T, userID string) {
	t.Helper()
	_, err := testDB.Exec("UPDATE users SET role = 'ADMIN' WHERE id = $1", userID)
	require.NoError(t, err)
}

// bearerToken returns the Authorization header value for a Bearer token.
func bearerToken(token string) string {
	return "Bearer " + token
}
