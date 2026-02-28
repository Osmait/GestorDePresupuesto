package apitest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-faker/faker/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// POST /login (legacy endpoint - returns raw JWT string)

func TestLogin_Success(t *testing.T) {
	user := createUser(t)
	token := loginUser(t, user.Email, user.Password)
	assert.NotEmpty(t, token)
}

func TestLogin_WrongPassword(t *testing.T) {
	user := createUser(t)

	body := fmt.Sprintf(`{"email":"%s","password":"WrongPassword1234"}`, user.Email)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestLogin_UnknownEmail(t *testing.T) {
	body := `{"email":"nobody@notexist.example.com","password":"AnyPass1234"}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestLogin_EmptyCredentials(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// POST /auth/login (modern endpoint - returns access_token + refresh_token)

func TestAuthLogin_Success(t *testing.T) {
	user := createUser(t)

	body := fmt.Sprintf(`{"email":"%s","password":"%s"}`, user.Email, user.Password)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.NotEmpty(t, resp["access_token"])
	assert.NotEmpty(t, resp["refresh_token"])
	assert.Equal(t, "Bearer", resp["token_type"])
}

func TestAuthLogin_WrongPassword(t *testing.T) {
	user := createUser(t)

	body := fmt.Sprintf(`{"email":"%s","password":"WrongPass1234"}`, user.Email)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthLogin_UnknownEmail(t *testing.T) {
	body := fmt.Sprintf(`{"email":"%s","password":"AnyPass1234"}`, faker.Email())
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestAuthLogin_InvalidJSON(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
