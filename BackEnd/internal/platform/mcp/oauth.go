package mcp

import (
	"context"

	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/plexusone/mcpkit/oauth2"
)

// NewOAuthServer creates and configures an OAuth 2.1 server that delegates
// credential validation to the application's existing AuthService.
func NewOAuthServer(issuer string, authService *auth.AuthService) (*oauth2.Server, error) {
	return oauth2.New(&oauth2.Config{
		Issuer: issuer,
		Authenticator: func(username, password string) bool {
			_, err := authService.Login(context.Background(), &authDomain.AuthRequest{
				Email:    username,
				Password: password,
			})
			return err == nil
		},
	})
}
