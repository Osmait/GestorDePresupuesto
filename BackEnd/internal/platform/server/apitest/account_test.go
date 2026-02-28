package apitest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// POST /account (requires auth)

func TestCreateAccount_Success(t *testing.T) {
	user := createAndLoginUser(t)

	body := `{"name":"My Bank Account","bank":"Test Bank","initial_balance":1000.0}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/account", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestCreateAccount_Unauthorized(t *testing.T) {
	body := `{"name":"My Bank Account","bank":"Test Bank","initial_balance":1000.0}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/account", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// No Authorization header
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestCreateAccount_InvalidJSON(t *testing.T) {
	user := createAndLoginUser(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/account", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusCreated, w.Code)
}

func TestCreateAccount_MissingRequiredFields(t *testing.T) {
	user := createAndLoginUser(t)

	// Missing bank and initial_balance
	body := `{"name":"Only Name"}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/account", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusCreated, w.Code)
}

// GET /account (requires auth)

func TestGetAccounts_EmptyForNewUser(t *testing.T) {
	user := createAndLoginUser(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/account", nil)
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var accounts []interface{}
	err := json.NewDecoder(w.Body).Decode(&accounts)
	require.NoError(t, err)
	assert.Empty(t, accounts)
}

func TestGetAccounts_AfterCreating(t *testing.T) {
	user := createAndLoginUser(t)

	for i := 0; i < 2; i++ {
		body := fmt.Sprintf(`{"name":"Account %d","bank":"Bank %d","initial_balance":%d}`, i, i, (i+1)*500)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/account", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", bearerToken(user.Token))
		testEngine.ServeHTTP(w, req)
		require.Equal(t, http.StatusCreated, w.Code)
	}

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/account", nil)
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var accounts []map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&accounts)
	require.NoError(t, err)
	assert.Len(t, accounts, 2)
}

func TestGetAccounts_Unauthorized(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/account", nil)
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// DELETE /account/:id (requires auth)

func TestDeleteAccount_Success(t *testing.T) {
	user := createAndLoginUser(t)

	// Create an account
	body := `{"name":"To Delete","bank":"Test Bank","initial_balance":500}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/account", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// Retrieve the account ID
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/account", nil)
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var accounts []map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&accounts)
	require.NoError(t, err)
	require.Len(t, accounts, 1)
	accountID := accounts[0]["account_info"].(map[string]interface{})["id"].(string)

	// Delete account
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/account/"+accountID, nil)
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify it's gone
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/account", nil)
	req.Header.Set("Authorization", bearerToken(user.Token))
	testEngine.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var remaining []map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&remaining)
	require.NoError(t, err)
	assert.Empty(t, remaining)
}

func TestDeleteAccount_Unauthorized(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/account/some-account-id", nil)
	testEngine.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// User isolation: accounts are not shared between users

func TestUserIsolation_AccountsArePrivate(t *testing.T) {
	user1 := createAndLoginUser(t)
	user2 := createAndLoginUser(t)

	// user1 creates an account
	body := `{"name":"User1 Account","bank":"Bank","initial_balance":1000}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/account", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", bearerToken(user1.Token))
	testEngine.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// user2 lists accounts — must see none
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/account", nil)
	req.Header.Set("Authorization", bearerToken(user2.Token))
	testEngine.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var accounts []interface{}
	err := json.NewDecoder(w.Body).Decode(&accounts)
	require.NoError(t, err)
	assert.Empty(t, accounts)
}
