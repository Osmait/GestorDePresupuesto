package mcp

import (
	"bytes"
	_ "embed"
	"encoding/base64"
	"fmt"
	"html/template"
	"math"
	"net/http"
	"net/url"
	"time"

	"github.com/plexusone/omniskill/mcp/oauth2"
	"github.com/rs/zerolog/log"

	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
)

// sbfinanceLogo is the "SB" mark the web app sidebar shows
// (FrontendNextjs/gestor/public/sbfinance-logo.webp).
//
//go:embed assets/sbfinance-logo.webp
var sbfinanceLogo []byte

// logoDataURI is inlined so the page needs no other request (CSP img-src data:).
var logoDataURI = template.URL("data:image/webp;base64," + base64.StdEncoding.EncodeToString(sbfinanceLogo)) //nolint:gosec // G203: constant embedded image

// pageError identifies the message shown on the login or error page. The
// copy is localized in pageCopy; nothing user-controlled or library-generated
// is ever shown verbatim.
type pageError int

const (
	pageErrNone pageError = iota
	pageErrInvalidCredentials
	pageErrMissingCredentials
	pageErrLocked
	pageErrServer
	pageErrInvalidRequest
	pageErrUnknownClient
	pageErrInvalidRedirect
)

// pageCopy is every string of the OAuth pages in one locale.
type pageCopy struct {
	Lang              string
	Tagline           string
	TitleSuffix       string
	HeadingFmt        string // %s = client name
	UnknownClient     string
	Lead              string
	ReturnTo          string // followed by the redirect host
	ReadTitle         string
	ReadItems         []string
	WriteTitle        string
	WriteItems        []string
	AccessTitle       string
	AccessFull        string
	AccessFullHint    string
	AccessRead        string
	AccessReadHint    string
	AccessReadOnly    string // the client itself asked for read-only access
	UntrustedTitle    string
	UntrustedFmt      string // %s = redirect host
	Email             string
	EmailPlaceholder  string
	Password          string
	ShowPassword      string
	Submit            string
	Cancel            string
	PasskeyNote       string
	PasskeyLink       string
	FooterFmt         string // %s = client name
	OpenApp           string
	ErrorPageTitle    string
	ErrorPageHint     string
	invalidCreds      string
	missingCreds      string
	lockedOne         string
	lockedManyFmt     string // %d = minutes
	serverError       string
	invalidRequest    string
	unknownClientMsg  string
	invalidRedirectMs string
}

var pageCopies = map[i18n.Locale]*pageCopy{
	i18n.ES: {
		Lang:              "es",
		Tagline:           "Gestor Personal",
		TitleSuffix:       "Autorizar acceso",
		HeadingFmt:        "%s solicita acceso a tu cuenta de SBFinance",
		UnknownClient:     "Una aplicación",
		Lead:              "Inicia sesión para autorizar la conexión.",
		ReturnTo:          "Después volverás a",
		ReadTitle:         "Podrá ver",
		ReadItems:         []string{"Tus cuentas y saldos", "Tus transacciones y categorías", "Tus tarjetas de crédito y préstamos", "Resúmenes y análisis de tus gastos"},
		WriteTitle:        "Podrá hacer cambios",
		WriteItems:        []string{"Crear, editar y eliminar transacciones, cuentas y categorías", "Crear préstamos, registrar pagos y reiniciar saldos de tarjetas"},
		AccessTitle:       "Nivel de acceso",
		AccessFull:        "Acceso completo",
		AccessFullHint:    "Ver tus datos y hacer cambios.",
		AccessRead:        "Solo lectura",
		AccessReadHint:    "Ver tus datos, sin poder cambiar nada.",
		AccessReadOnly:    "Esta conexión pidió acceso de solo lectura: podrá ver tus datos, pero no cambiarlos.",
		UntrustedTitle:    "Dirección de retorno desconocida",
		UntrustedFmt:      "%s no es una dirección conocida de Claude. Autoriza solo si reconoces esta aplicación y tú iniciaste la conexión: quien controle esa dirección tendrá acceso a tu cuenta.",
		Email:             "Correo electrónico",
		EmailPlaceholder:  "tu@correo.com",      // ggignore: UI copy, not a credential
		Password:          "Contraseña",         // ggignore: UI copy, not a credential
		ShowPassword:      "Mostrar contraseña", // ggignore: UI copy, not a credential
		Submit:            "Autorizar acceso",
		Cancel:            "Cancelar",
		PasskeyNote:       "¿Entras solo con passkey? La conexión con Claude todavía no admite passkeys: crea una contraseña en",
		PasskeyLink:       "SBFinance",
		FooterFmt:         "Autoriza solo si iniciaste esta conexión desde %s.",
		OpenApp:           "Abrir SBFinance",
		ErrorPageTitle:    "No se puede completar la conexión",
		ErrorPageHint:     "Cierra esta ventana y vuelve a conectar SBFinance desde Claude (o la aplicación que estés usando).",
		invalidCreds:      "El correo o la contraseña no son correctos.",
		missingCreds:      "Escribe tu correo y tu contraseña.",
		lockedOne:         "Demasiados intentos fallidos. Espera 1 minuto e inténtalo de nuevo.",
		lockedManyFmt:     "Demasiados intentos fallidos. Espera %d minutos e inténtalo de nuevo.",
		serverError:       "No pudimos verificar tus datos por un problema del servidor. Inténtalo de nuevo en unos minutos.",
		invalidRequest:    "La solicitud de autorización no es válida o está incompleta.",
		unknownClientMsg:  "Esta conexión no está registrada o ha caducado.",
		invalidRedirectMs: "La dirección de retorno de esta conexión no es válida.",
	},
	i18n.EN: {
		Lang:              "en",
		Tagline:           "Personal finance manager",
		TitleSuffix:       "Authorize access",
		HeadingFmt:        "%s wants to access your SBFinance account",
		UnknownClient:     "An application",
		Lead:              "Sign in to authorize the connection.",
		ReturnTo:          "Afterwards you will return to",
		ReadTitle:         "It will be able to view",
		ReadItems:         []string{"Your accounts and balances", "Your transactions and categories", "Your credit cards and loans", "Summaries and analysis of your spending"},
		WriteTitle:        "It will be able to make changes",
		WriteItems:        []string{"Create, edit and delete transactions, accounts and categories", "Create loans, record payments and reset card balances"},
		AccessTitle:       "Access level",
		AccessFull:        "Full access",
		AccessFullHint:    "View your data and make changes.",
		AccessRead:        "Read-only",
		AccessReadHint:    "View your data without changing anything.",
		AccessReadOnly:    "This connection asked for read-only access: it can view your data but not change it.",
		UntrustedTitle:    "Unknown return address",
		UntrustedFmt:      "%s is not a known Claude address. Only authorize if you recognize this application and started the connection yourself: whoever controls that address will get access to your account.",
		Email:             "Email",
		EmailPlaceholder:  "you@example.com", // ggignore: UI copy, not a credential
		Password:          "Password",        // ggignore: UI copy, not a credential
		ShowPassword:      "Show password",   // ggignore: UI copy, not a credential
		Submit:            "Authorize access",
		Cancel:            "Cancel",
		PasskeyNote:       "Do you sign in with a passkey only? The Claude connection does not support passkeys yet: set a password in",
		PasskeyLink:       "SBFinance",
		FooterFmt:         "Only authorize if you started this connection from %s.",
		OpenApp:           "Open SBFinance",
		ErrorPageTitle:    "The connection can't be completed",
		ErrorPageHint:     "Close this window and connect SBFinance again from Claude (or the app you are using).",
		invalidCreds:      "The email or password is incorrect.",
		missingCreds:      "Enter your email and password.",
		lockedOne:         "Too many failed attempts. Wait 1 minute and try again.",
		lockedManyFmt:     "Too many failed attempts. Wait %d minutes and try again.",
		serverError:       "We couldn't check your details because of a server problem. Try again in a few minutes.",
		invalidRequest:    "The authorization request is invalid or incomplete.",
		unknownClientMsg:  "This connection isn't registered or has expired.",
		invalidRedirectMs: "This connection's return address is not valid.",
	},
}

func copyFor(locale i18n.Locale) *pageCopy {
	if c, ok := pageCopies[locale]; ok {
		return c
	}
	return pageCopies[i18n.Default]
}

// message returns the localized text for e ("" for pageErrNone).
func (c *pageCopy) message(e pageError, retryAfter time.Duration) string {
	switch e {
	case pageErrInvalidCredentials:
		return c.invalidCreds
	case pageErrMissingCredentials:
		return c.missingCreds
	case pageErrLocked:
		minutes := int(math.Ceil(retryAfter.Minutes()))
		if minutes <= 1 {
			return c.lockedOne
		}
		return fmt.Sprintf(c.lockedManyFmt, minutes)
	case pageErrServer:
		return c.serverError
	case pageErrInvalidRequest:
		return c.invalidRequest
	case pageErrUnknownClient:
		return c.unknownClientMsg
	case pageErrInvalidRedirect:
		return c.invalidRedirectMs
	default:
		return ""
	}
}

// loginPageData is the template data of the login page. Every field is
// escaped by html/template in its context (text, attribute, URL).
type loginPageData struct {
	T            *pageCopy
	Nonce        string
	Logo         template.URL
	AppURL       string
	ClientName   string
	RedirectHost string
	// RedirectTrusted is false when the redirect host is not a known one
	// (the page shows a warning naming RedirectTarget).
	RedirectTrusted bool
	RedirectTarget  string
	// ReadOnlyRequested is true when the client asked for read-only access
	// (no access level choice is offered then).
	ReadOnlyRequested bool
	// ReadSelected preselects read-only access (the user picked it before a
	// failed attempt).
	ReadSelected bool
	Error        string
	// Field the error refers to ("" = form level).
	ErrorOnFields bool
	Username      string
	Request       authorizeRequest
}

// errorPageData is the template data of the error page.
type errorPageData struct {
	T       *pageCopy
	Nonce   string
	Logo    template.URL
	AppURL  string
	Message string
}

// redirectHost is the host shown as "you will return to" (the scheme for
// native-app callbacks).
func redirectHost(redirectURI string) string {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return ""
	}
	if u.Host != "" {
		return u.Hostname()
	}
	return u.Scheme
}

// redirectTarget names the redirect destination in the unknown-host warning:
// the host for web callbacks, scheme://host for native-app callbacks (a
// custom scheme says more than its host).
func redirectTarget(redirectURI string) string {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return ""
	}
	if u.Scheme == "http" || u.Scheme == "https" || u.Host == "" {
		return redirectHost(redirectURI)
	}
	return u.Scheme + "://" + u.Host
}

func (h *authorizeHandler) renderLogin(w http.ResponseWriter, locale i18n.Locale, status int, client *oauth2.Client, req authorizeRequest, username string, perr pageError, retryAfter time.Duration) {
	nonce, err := newNonce()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	c := copyFor(locale)
	name := client.ClientName
	if name == "" {
		name = c.UnknownClient
	}
	data := loginPageData{
		T:                 c,
		Nonce:             nonce,
		Logo:              logoDataURI,
		AppURL:            h.appURL,
		ClientName:        name,
		RedirectHost:      redirectHost(req.RedirectURI),
		RedirectTrusted:   h.redirectTrusted(req.RedirectURI),
		RedirectTarget:    redirectTarget(req.RedirectURI),
		ReadOnlyRequested: isReadOnlyScope(req.Scope),
		ReadSelected:      req.Access == accessRead,
		Error:             c.message(perr, retryAfter),
		ErrorOnFields:     perr == pageErrInvalidCredentials || perr == pageErrMissingCredentials,
		Username:          username,
		Request:           req,
	}
	formAction := "'self'"
	if src := formActionSource(req.RedirectURI); src != "" {
		formAction += " " + src
	}
	writePage(w, locale, status, nonce, formAction, loginTemplate, data)
}

func (h *authorizeHandler) renderError(w http.ResponseWriter, locale i18n.Locale, status int, perr pageError) {
	nonce, err := newNonce()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	c := copyFor(locale)
	writePage(w, locale, status, nonce, "", errorTemplate, errorPageData{
		T:       c,
		Nonce:   nonce,
		Logo:    logoDataURI,
		AppURL:  h.appURL,
		Message: c.message(perr, 0),
	})
}

func writePage(w http.ResponseWriter, locale i18n.Locale, status int, nonce, formAction string, tmpl *template.Template, data any) {
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		log.Error().Err(err).Msg("oauth authorize: render page failed")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	setPageHeaders(w, locale, nonce, formAction)
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}

var (
	loginTemplate = template.Must(template.New("login").Parse(pageBaseTemplate + loginBodyTemplate))
	errorTemplate = template.Must(template.New("error").Parse(pageBaseTemplate + errorBodyTemplate))
)

// pageBaseTemplate holds the document shell and the design tokens of the web
// app (FrontendNextjs/gestor/styles/globals.css, DESIGN.md "The Quiet
// Ledger"): zinc ink on white / blue-gray ink on near-black, 8px card radius,
// 6px controls, Inter with the system UI fallback (no web font is loaded).
const pageBaseTemplate = `<!DOCTYPE html>
<html lang="{{.T.Lang}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex, nofollow">
<title>{{template "title" .}} · SBFinance</title>
<style nonce="{{.Nonce}}">
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(240 10% 3.9%);
  --card: hsl(0 0% 100%);
  --primary: hsl(240 5.9% 10%);
  --primary-foreground: hsl(0 0% 98%);
  --muted: hsl(240 4.8% 95.9%);
  --muted-foreground: hsl(240 3.8% 46.1%);
  --border: hsl(240 5.9% 90%);
  --input: hsl(240 5.9% 90%);
  --ring: hsl(240 10% 3.9%);
  --destructive: hsl(0 74% 45%);
  --success: hsl(142 72% 29%);
  --warning: hsl(26 90% 37%);
  --radius: 8px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: hsl(224 7% 11%);
    --foreground: hsl(210 20% 98%);
    --card: hsl(224 7% 11%);
    --primary: hsl(210 20% 98%);
    --primary-foreground: hsl(224 9% 11%);
    --muted: hsl(226 10% 17%);
    --muted-foreground: hsl(220 9% 56%);
    --border: hsl(226 10% 17%);
    --input: hsl(226 10% 21%);
    --ring: hsl(224 76% 48%);
    --destructive: hsl(0 91% 71%);
    --success: hsl(142 69% 45%);
    --warning: hsl(32 95% 44%);
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
    color-scheme: dark;
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body {
  margin: 0;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--background);
  color: var(--foreground);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  font-size: 0.875rem;
  line-height: 1.43;
  -webkit-font-smoothing: antialiased;
}
h1, h2, p, ul { margin: 0; }
a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
a:hover { color: var(--foreground); }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.shell {
  width: 100%;
  max-width: 448px;
  margin: 0 auto;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.brand { display: flex; align-items: center; gap: 8px; }
.brand-logo {
  width: 32px; height: 32px; flex: none;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--background);
  object-fit: cover;
}
.brand-name { font-size: 1.125rem; font-weight: 600; line-height: 1.33; }
.brand-tag { font-size: 0.75rem; line-height: 1.33; color: var(--muted-foreground); }
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
h1 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.lead { margin-top: 6px; color: var(--muted-foreground); }
.lead strong { color: var(--foreground); font-weight: 500; overflow-wrap: anywhere; }
.perms {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.perms h2 {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.33;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.perms ul { list-style: none; padding: 0; margin-top: 6px; display: grid; gap: 6px; }
.perms li { display: flex; align-items: flex-start; gap: 8px; }
.perms svg { flex: none; width: 16px; height: 16px; margin-top: 2px; }
.perms .read svg { color: var(--muted-foreground); }
.perms .write svg { color: var(--warning); }
.alert {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--destructive) 45%, transparent);
  background: color-mix(in srgb, var(--destructive) 8%, transparent);
  color: var(--destructive);
  font-weight: 500;
}
.alert svg { flex: none; width: 16px; height: 16px; margin-top: 2px; }
.warn {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--warning) 50%, transparent);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}
.warn svg { flex: none; width: 16px; height: 16px; margin-top: 2px; color: var(--warning); }
.warn strong { display: block; color: var(--warning); font-weight: 600; }
.warn p { overflow-wrap: anywhere; }
.access { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; margin: 0; display: grid; gap: 8px; }
.access legend { padding: 0 4px; font-weight: 500; }
.opt { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; padding: 6px 0; cursor: pointer; font-weight: 400; }
.opt input { flex: none; width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--primary); }
.opt strong { display: block; font-weight: 500; }
.opt .hint { display: block; color: var(--muted-foreground); }
.readonly-note { color: var(--muted-foreground); }
.perms .write.is-off { opacity: 0.45; }
.perms .write.is-off li span { text-decoration: line-through; }
form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { font-weight: 500; }
input[type="email"], input[type="password"], input[type="text"] {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--input);
  border-radius: 6px;
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 1rem;
  line-height: 1.5;
}
input::placeholder { color: var(--muted-foreground); opacity: 1; }
input:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; border-color: var(--ring); }
input[aria-invalid="true"] { border-color: var(--destructive); }
.pw { position: relative; }
.pw input { padding-right: 52px; }
.pw-toggle {
  position: absolute; top: 0; right: 0;
  width: 44px; height: 44px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 0; background: transparent; color: var(--muted-foreground);
  border-radius: 6px; cursor: pointer;
}
.pw-toggle:hover { color: var(--foreground); }
.pw-toggle[hidden] { display: none; }
.pw-toggle svg { width: 18px; height: 18px; }
.pw-toggle .icon-hide { display: none; }
.pw-toggle[aria-pressed="true"] .icon-show { display: none; }
.pw-toggle[aria-pressed="true"] .icon-hide { display: block; }
.actions { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 8px 16px;
  border-radius: 6px;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
}
.btn-primary { background: var(--primary); color: var(--primary-foreground); border: 1px solid var(--primary); }
.btn-primary:hover { opacity: 0.9; }
.btn-outline { background: var(--background); color: var(--foreground); border: 1px solid var(--input); }
.btn-outline:hover { background: var(--muted); }
.btn:disabled { cursor: not-allowed; opacity: 0.6; }
.btn-primary:disabled { opacity: 0.8; }
.spinner { display: none; width: 16px; height: 16px; flex: none; }
.btn.is-busy .spinner { display: inline-block; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .btn.is-busy .spinner { animation-duration: 2.4s; }
}
.note {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--muted-foreground);
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.note a { color: var(--foreground); font-weight: 500; }
.footer {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--muted-foreground);
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.footer a {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 8px;
  color: var(--foreground); font-weight: 500;
}
.error-msg { color: var(--muted-foreground); margin-top: 6px; }
@media (min-width: 640px) {
  .shell { padding-top: 64px; }
  .card { padding: 28px 24px; }
}
</style>
</head>
<body>
<main class="shell">
  <div class="brand">
    <img class="brand-logo" src="{{.Logo}}" alt="" width="32" height="32">
    <div>
      <p class="brand-name">SBFinance</p>
      <p class="brand-tag">{{.T.Tagline}}</p>
    </div>
  </div>
{{template "content" .}}
</main>
{{template "script" .}}
</body>
</html>
`

const loginBodyTemplate = `{{define "title"}}{{.T.TitleSuffix}}{{end}}
{{define "content"}}
  <section class="card" aria-labelledby="title">
    <div>
      <h1 id="title">{{printf .T.HeadingFmt .ClientName}}</h1>
      <p class="lead">{{.T.Lead}}{{if .RedirectHost}} {{.T.ReturnTo}} <strong>{{.RedirectHost}}</strong>.{{end}}</p>
    </div>

    {{if not .RedirectTrusted}}
    <div class="warn" id="redirect-warning">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <p><strong>{{.T.UntrustedTitle}}</strong>{{printf .T.UntrustedFmt .RedirectTarget}}</p>
    </div>
    {{end}}

    <div class="perms">
      <div class="read">
        <h2 id="perm-read">{{.T.ReadTitle}}</h2>
        <ul aria-labelledby="perm-read">
          {{range .T.ReadItems}}<li><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>{{.}}</span></li>
          {{end}}
        </ul>
      </div>
      {{if .ReadOnlyRequested}}
      <p class="readonly-note" id="access-level">{{.T.AccessReadOnly}}</p>
      {{else}}
      <div class="write{{if .ReadSelected}} is-off{{end}}" id="perm-write-block">
        <h2 id="perm-write">{{.T.WriteTitle}}</h2>
        <ul aria-labelledby="perm-write">
          {{range .T.WriteItems}}<li><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>{{.}}</span></li>
          {{end}}
        </ul>
      </div>
      {{end}}
    </div>

    {{if .Error}}
    <div class="alert" id="form-error" role="alert">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <p>{{.Error}}</p>
    </div>
    {{end}}

    <form method="post" id="authorize-form">
      <input type="hidden" name="client_id" value="{{.Request.ClientID}}">
      <input type="hidden" name="redirect_uri" value="{{.Request.RedirectURI}}">
      <input type="hidden" name="state" value="{{.Request.State}}">
      <input type="hidden" name="scope" value="{{.Request.Scope}}">
      <input type="hidden" name="code_challenge" value="{{.Request.CodeChallenge}}">
      <input type="hidden" name="code_challenge_method" value="{{.Request.CodeChallengeMethod}}">

      {{if not .ReadOnlyRequested}}
      <fieldset class="access" id="access-level">
        <legend>{{.T.AccessTitle}}</legend>
        <label class="opt">
          <input type="radio" name="access" value="full"{{if not .ReadSelected}} checked{{end}}>
          <span><strong>{{.T.AccessFull}}</strong><span class="hint">{{.T.AccessFullHint}}</span></span>
        </label>
        <label class="opt">
          <input type="radio" name="access" value="read"{{if .ReadSelected}} checked{{end}}>
          <span><strong>{{.T.AccessRead}}</strong><span class="hint">{{.T.AccessReadHint}}</span></span>
        </label>
      </fieldset>
      {{end}}

      <div class="field">
        <label for="username">{{.T.Email}}</label>
        <input id="username" name="username" type="email" inputmode="email" autocomplete="username"
          autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" required
          placeholder="{{.T.EmailPlaceholder}}" value="{{.Username}}"
          {{if .ErrorOnFields}}aria-invalid="true" aria-describedby="form-error"{{end}}>
      </div>

      <div class="field">
        <label for="password">{{.T.Password}}</label>
        <div class="pw">
          <input id="password" name="password" type="password" autocomplete="current-password" maxlength="1024" required
            {{if .ErrorOnFields}}aria-invalid="true" aria-describedby="form-error" autofocus{{end}}>
          <button type="button" class="pw-toggle" id="pw-toggle" aria-controls="password" aria-pressed="false" aria-label="{{.T.ShowPassword}}" hidden>
            <svg class="icon-show" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg class="icon-hide" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/></svg>
          </button>
        </div>
      </div>

      <div class="actions">
        <button type="submit" class="btn btn-primary" name="action" value="approve">
          <svg class="spinner" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
          <span>{{.T.Submit}}</span>
        </button>
        <button type="submit" class="btn btn-outline" name="action" value="deny" formnovalidate>
          <svg class="spinner" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
          <span>{{.T.Cancel}}</span>
        </button>
      </div>
    </form>

    <p class="note">{{.T.PasskeyNote}} <a href="{{.AppURL}}" target="_blank" rel="noopener noreferrer">{{.T.PasskeyLink}}</a>.</p>
  </section>

  <div class="footer">
    <p>{{printf .T.FooterFmt .ClientName}}</p>
    <a href="{{.AppURL}}" target="_blank" rel="noopener noreferrer">{{.T.OpenApp}}</a>
  </div>
{{end}}
{{define "script"}}
<script nonce="{{.Nonce}}">
(function () {
  var form = document.getElementById("authorize-form");
  if (!form) return;
  var pw = document.getElementById("password");
  var toggle = document.getElementById("pw-toggle");
  if (pw && toggle) {
    toggle.hidden = false;
    toggle.addEventListener("click", function () {
      var show = pw.type === "password";
      pw.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", show ? "true" : "false");
    });
  }
  var writeBlock = document.getElementById("perm-write-block");
  var levels = form.querySelectorAll("input[name=access]");
  for (var j = 0; j < levels.length; j++) {
    levels[j].addEventListener("change", function (e) {
      if (writeBlock) writeBlock.classList.toggle("is-off", e.target.value === "read");
    });
  }
  var buttons = form.querySelectorAll("button[type=submit]");
  var busy = false;
  form.addEventListener("submit", function (e) {
    if (busy) { e.preventDefault(); return; }
    busy = true;
    if (pw) pw.type = "password";
    var btn = e.submitter || buttons[0];
    if (btn) { btn.classList.add("is-busy"); btn.setAttribute("aria-busy", "true"); }
    // Disable after the form data (including the clicked button's value)
    // has been collected.
    setTimeout(function () {
      for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;
    }, 0);
  });
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    busy = false;
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = false;
      buttons[i].classList.remove("is-busy");
      buttons[i].removeAttribute("aria-busy");
    }
  });
})();
</script>
{{end}}`

const errorBodyTemplate = `{{define "title"}}{{.T.ErrorPageTitle}}{{end}}
{{define "content"}}
  <section class="card" aria-labelledby="title">
    <div role="alert">
      <h1 id="title">{{.T.ErrorPageTitle}}</h1>
      <p class="error-msg">{{.Message}}</p>
      <p class="error-msg">{{.T.ErrorPageHint}}</p>
    </div>
    <a class="btn btn-outline" href="{{.AppURL}}" rel="noopener noreferrer">{{.T.OpenApp}}</a>
  </section>
{{end}}
{{define "script"}}{{end}}`
