package dto

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func bindUserRequest(t *testing.T, body string) error {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/user", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	var req UserRequest
	return c.ShouldBindJSON(&req)
}

// Regression: only `binding` tags are enforced by gin, so registration used
// to accept malformed emails and 3-character passwords.
func TestUserRequestBinding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		body    string
		wantErr bool
	}{
		{name: "valid request", body: `{"name":"John","last_name":"Doe","email":"john@example.com","password":"Secure123"}`},
		{name: "invalid email", body: `{"name":"John","last_name":"Doe","email":"invalid-email","password":"Secure123"}`, wantErr: true},
		{name: "short password", body: `{"name":"John","last_name":"Doe","email":"john@example.com","password":"123"}`, wantErr: true},
		{name: "seven character password", body: `{"name":"John","last_name":"Doe","email":"john@example.com","password":"Abc1234"}`, wantErr: true},
		{name: "empty name", body: `{"name":"","last_name":"Doe","email":"john@example.com","password":"Secure123"}`, wantErr: true},
		{name: "missing password", body: `{"name":"John","last_name":"Doe","email":"john@example.com"}`, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := bindUserRequest(t, tc.body)
			if tc.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
