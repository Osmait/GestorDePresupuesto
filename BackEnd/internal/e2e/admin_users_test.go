//go:build e2e
// +build e2e

package e2e

import (
	"encoding/json"
	"net/http"
)

// TestAdminUpdateUsers_RoleValidationAndEmailChange: PUT /users (admin)
// accepts only the known roles, and changing a user's email revokes their
// refresh tokens and MCP OAuth tokens (the old email was the OAuth subject).
func (suite *E2ETestSuite) TestAdminUpdateUsers_RoleValidationAndEmailChange() {
	adminToken, adminData := suite.helpers.RegisterAndLoginUser("adminupd")
	suite.helpers.ExecuteSQL(`UPDATE users SET role = 'ADMIN' WHERE email = $1`, adminData.Email)
	_, userData := suite.helpers.RegisterAndLoginUser("userupd")

	// A refresh token and an MCP OAuth token for the user.
	resp := suite.helpers.MakeRequest("POST", "/auth/login", map[string]string{
		"email": userData.Email, "password": userData.Password,
	}, "")
	suite.Require().Equal(http.StatusOK, resp.StatusCode, resp.AsString())
	var tokens struct {
		RefreshToken string `json:"refresh_token"`
	}
	suite.Require().NoError(json.Unmarshal(resp.Body, &tokens))
	suite.Require().NotEmpty(tokens.RefreshToken)

	var userID string
	suite.Require().NoError(suite.db.QueryRow(`SELECT id FROM users WHERE email = $1`, userData.Email).Scan(&userID))
	suite.helpers.ExecuteSQL(`INSERT INTO mcp_oauth_clients (client_id, redirect_uris) VALUES ('admin-upd-client', '["https://claude.ai/cb"]')`)
	suite.helpers.ExecuteSQL(`INSERT INTO mcp_oauth_tokens (access_token_hash, client_id, user_id, subject, expires_at, purge_after)
		VALUES (repeat('b', 64), 'admin-upd-client', $1, $2, now() + interval '1 hour', now() + interval '30 days')`, userID, userData.Email)

	user := map[string]any{"id": userID, "name": userData.Name, "last_name": userData.LastName, "email": userData.Email}

	// Unknown roles are rejected and nothing changes.
	for _, role := range []string{"ROOT", "admin", ""} {
		user["role"] = role
		resp = suite.helpers.MakeRequest("PUT", "/users", []map[string]any{user}, adminToken)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "role %q: %s", role, resp.AsString())
	}
	var storedRole string
	suite.Require().NoError(suite.db.QueryRow(`SELECT role FROM users WHERE id = $1`, userID).Scan(&storedRole))
	suite.Equal("USER", storedRole)

	// A role-only change keeps the sessions.
	user["role"] = "USER"
	resp = suite.helpers.MakeRequest("PUT", "/users", []map[string]any{user}, adminToken)
	suite.Require().Equal(http.StatusOK, resp.StatusCode, resp.AsString())
	suite.Equal(1, suite.countMCPTokens(userID))

	// The email change revokes the refresh token and the MCP token.
	user["email"] = "moved-userupd@e2etest.com"
	resp = suite.helpers.MakeRequest("PUT", "/users", []map[string]any{user}, adminToken)
	suite.Require().Equal(http.StatusOK, resp.StatusCode, resp.AsString())
	suite.Zero(suite.countMCPTokens(userID))
	resp = suite.helpers.MakeRequest("POST", "/auth/refresh", map[string]string{"refresh_token": tokens.RefreshToken}, "")
	suite.Equal(http.StatusUnauthorized, resp.StatusCode, resp.AsString())
}

func (suite *E2ETestSuite) countMCPTokens(userID string) int {
	var n int
	suite.Require().NoError(suite.db.QueryRow(`SELECT count(*) FROM mcp_oauth_tokens WHERE user_id = $1`, userID).Scan(&n))
	return n
}
