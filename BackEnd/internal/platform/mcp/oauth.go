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
		LoginPageTemplate: oauthLoginTemplate,
	})
}

// oauthLoginTemplate is a custom HTML template for the OAuth login/consent page.
// It matches the visual style of the frontend login (dark theme, SBFinance branding).
// Template data: .ClientName, .Error, .ClientID, .RedirectURI, .State, .Scope,
// .CodeChallenge, .CodeChallengeMethod
const oauthLoginTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autorizar — SBFinance</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: hsl(240 10% 3.9%);
            color: hsl(0 0% 98%);
        }

        .container {
            width: 100%;
            max-width: 420px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        /* Header / Branding */
        .header {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
        }

        .logo-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-box {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, hsl(221.2 83.2% 53.3%), hsl(262.1 83.3% 57.8%));
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
        }

        .brand-text h1 {
            font-size: 22px;
            font-weight: 700;
            text-align: left;
            line-height: 1.2;
        }

        .brand-text p {
            font-size: 13px;
            color: hsl(240 5% 64.9%);
            text-align: left;
        }

        /* Consent card */
        .consent-card {
            background: hsl(240 3.7% 15.9%);
            border: 1px solid hsl(240 3.7% 15.9%);
            border-radius: 12px;
            padding: 20px;
        }

        .consent-title {
            font-size: 14px;
            font-weight: 500;
            color: hsl(0 0% 98%);
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .consent-title .app-badge {
            background: hsl(221.2 83.2% 53.3% / 0.15);
            color: hsl(217.2 91.2% 59.8%);
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 600;
        }

        .permissions {
            list-style: none;
            padding: 0;
        }

        .permissions li {
            padding: 6px 0;
            font-size: 13px;
            color: hsl(240 5% 64.9%);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .check {
            color: hsl(142.1 76.2% 36.3%);
            font-weight: bold;
            font-size: 14px;
            flex-shrink: 0;
        }

        /* Divider */
        .divider {
            display: flex;
            align-items: center;
            gap: 14px;
            color: hsl(240 3.8% 46.1%);
            font-size: 12px;
        }

        .divider::before,
        .divider::after {
            content: "";
            flex: 1;
            height: 1px;
            background: hsl(240 3.7% 15.9%);
        }

        /* Login card */
        .login-card {
            background: hsl(240 3.7% 15.9%);
            border: 1px solid hsl(240 3.7% 15.9%);
            border-radius: 12px;
            padding: 24px;
        }

        .login-card h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .login-card .subtitle {
            font-size: 13px;
            color: hsl(240 5% 64.9%);
            margin-bottom: 20px;
        }

        label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: hsl(0 0% 98%);
            margin-bottom: 6px;
        }

        .input-group {
            position: relative;
            margin-bottom: 16px;
        }

        .input-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: hsl(240 5% 64.9%);
            font-size: 15px;
        }

        input[type="email"],
        input[type="password"] {
            width: 100%;
            padding: 10px 12px 10px 38px;
            background: hsl(240 10% 3.9%);
            border: 1px solid hsl(240 3.7% 15.9%);
            border-radius: 8px;
            color: hsl(0 0% 98%);
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        input:focus {
            border-color: hsl(221.2 83.2% 53.3%);
            box-shadow: 0 0 0 2px hsl(221.2 83.2% 53.3% / 0.2);
        }

        input::placeholder {
            color: hsl(240 3.8% 46.1%);
        }

        .btn-authorize {
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            background: hsl(221.2 83.2% 53.3%);
            color: hsl(210 40% 98%);
            transition: opacity 0.2s, transform 0.1s;
            margin-top: 4px;
        }

        .btn-authorize:hover {
            opacity: 0.9;
        }

        .btn-authorize:active {
            transform: scale(0.98);
        }

        /* Error */
        .error-box {
            background: hsl(0 62.8% 30.6% / 0.15);
            border: 1px solid hsl(0 62.8% 30.6% / 0.4);
            color: hsl(0 85.7% 97.3%);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Footer */
        .footer {
            text-align: center;
            font-size: 11px;
            color: hsl(240 3.8% 46.1%);
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Branding -->
        <div class="header">
            <div class="logo-row">
                <div class="logo-box">💰</div>
                <div class="brand-text">
                    <h1>SBFinance</h1>
                    <p>Gestor de Presupuesto</p>
                </div>
            </div>
        </div>

        <!-- Consent / Permissions -->
        <div class="consent-card">
            <div class="consent-title">
                <span>{{.ClientName}}</span>
                <span class="app-badge">MCP</span>
                <span>solicita acceso</span>
            </div>
            <ul class="permissions">
                <li><span class="check">✓</span> Ver tus cuentas y balances</li>
                <li><span class="check">✓</span> Ver y crear transacciones</li>
                <li><span class="check">✓</span> Ver categorías y presupuestos</li>
                <li><span class="check">✓</span> Analizar tus patrones de gasto</li>
            </ul>
        </div>

        <div class="divider">Inicia sesión para autorizar</div>

        <!-- Login form -->
        <div class="login-card">
            <h2>Iniciar sesión</h2>
            <p class="subtitle">Ingresa tus credenciales para autorizar el acceso</p>

            {{if .Error}}
            <div class="error-box">
                <span>⚠</span> {{.Error}}
            </div>
            {{end}}

            <form method="POST">
                <label for="username">Correo electrónico</label>
                <div class="input-group">
                    <span class="input-icon">✉</span>
                    <input type="email" id="username" name="username"
                           placeholder="tu@correo.com" required autofocus>
                </div>

                <label for="password">Contraseña</label>
                <div class="input-group">
                    <span class="input-icon">🔒</span>
                    <input type="password" id="password" name="password"
                           placeholder="••••••••" required>
                </div>

                <button type="submit" class="btn-authorize">Autorizar acceso</button>
            </form>
        </div>

        <div class="footer">
            Al autorizar, permites que <strong>{{.ClientName}}</strong> acceda
            a tu información financiera de forma segura a través del protocolo MCP.
        </div>
    </div>
</body>
</html>`
