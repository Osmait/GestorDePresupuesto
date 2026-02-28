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

// POST /user

func TestCreateUser_Success(t *testing.T) {
	email := faker.Email()
	body := fmt.Sprintf(`{"name":"Test","last_name":"User","email":"%s","password":"TestPass1234"}`, email)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/user", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCreateUser_DuplicateEmail(t *testing.T) {
	user := createUser(t)

	body := fmt.Sprintf(`{"name":"Other","last_name":"User","email":"%s","password":"TestPass1234"}`, user.Email)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/user", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestCreateUser_MissingRequiredFields(t *testing.T) {
	// Missing name, last_name, password — gin binding requires them
	body := fmt.Sprintf(`{"email":"%s"}`, faker.Email())
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/user", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	testEngine.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

// GET /user/:id

func TestGetUserByID_Success(t *testing.T) {
	user := createUser(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/user/"+user.ID, nil)
	testEngine.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, user.ID, resp["id"])
	assert.Equal(t, user.Email, resp["email"])
}

func TestGetUserByID_NotFound(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/user/non-existent-id-xyz", nil)
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// GET /profile (requires auth)

func TestGetProfile_Success(t *testing.T) {
	user := createAndLoginUser(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/profile", nil)
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, user.ID, resp["id"])
	assert.Equal(t, user.Email, resp["email"])
}

func TestGetProfile_Unauthorized_NoToken(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/profile", nil)
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestGetProfile_Unauthorized_InvalidToken(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/profile", nil)
	req.Header.Set("Authorization", "Bearer invalid.token.here")
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// DELETE /users/:id (requires ADMIN)

func TestSoftDeleteUser_Success(t *testing.T) {
	admin := createAndLoginUser(t)
	promoteToAdmin(t, admin.ID)
	adminToken := loginUser(t, admin.Email, admin.Password)

	target := createUser(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/users/"+target.ID, nil)
	req.Header.Set("Authorization", bearerToken(adminToken))
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify soft-delete: deleted_at must be set
	var deletedAt interface{}
	err := testDB.QueryRow("SELECT deleted_at FROM users WHERE id = $1", target.ID).Scan(&deletedAt)
	require.NoError(t, err)
	assert.NotNil(t, deletedAt)
}

func TestSoftDeleteUser_SelfDelete_Rejected(t *testing.T) {
	admin := createAndLoginUser(t)
	promoteToAdmin(t, admin.ID)
	adminToken := loginUser(t, admin.Email, admin.Password)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/users/"+admin.ID, nil)
	req.Header.Set("Authorization", bearerToken(adminToken))
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSoftDeleteUser_Forbidden_NonAdmin(t *testing.T) {
	regularUser := createAndLoginUser(t)
	target := createUser(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/users/"+target.ID, nil)
	req.Header.Set("Authorization", bearerToken(regularUser.Token))
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestSoftDeleteUser_Unauthorized_NoToken(t *testing.T) {
	target := createUser(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/users/"+target.ID, nil)
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestSoftDeleteUser_NotFound(t *testing.T) {
	admin := createAndLoginUser(t)
	promoteToAdmin(t, admin.ID)
	adminToken := loginUser(t, admin.Email, admin.Password)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/users/non-existent-id-xyz", nil)
	req.Header.Set("Authorization", bearerToken(adminToken))
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
