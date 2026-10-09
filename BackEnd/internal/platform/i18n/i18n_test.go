package i18n

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
)

func TestParseAcceptLanguage(t *testing.T) {
	cases := map[string]Locale{
		"":                           ES,
		"es":                         ES,
		"en":                         EN,
		"EN":                         EN,
		"en-US":                      EN,
		"es-DO,es;q=0.9":             ES,
		"en-US,en;q=0.9,es;q=0.8":    EN,
		"es;q=0.5, en;q=0.9":         EN,
		"fr-FR, fr;q=0.9, en;q=0.5":  EN,
		"fr":                         ES,
		"de, *;q=0.1":                ES,
		"en;q=0, es":                 ES,
		"en;q=abc":                   ES,
		" , ;q=1":                    ES,
		"pt-BR,pt;q=0.9,en-GB;q=0.8": EN,
	}
	for header, want := range cases {
		if got := ParseAcceptLanguage(header); got != want {
			t.Errorf("ParseAcceptLanguage(%q) = %q, want %q", header, got, want)
		}
	}
}

func TestT_SpanishEnglishAndDefault(t *testing.T) {
	es := WithLocale(context.Background(), ES)
	en := WithLocale(context.Background(), EN)
	def := context.Background()

	cases := []struct {
		key        Key
		args       []any
		es, en     string
		defaultOut string
	}{
		{LoanDisbursementName, []any{"Ana"}, "Préstamo a Ana", "Loan to Ana", "Préstamo a Ana"},
		{LoanDisbursementDescription, nil, "Desembolso de préstamo", "Loan disbursement", "Desembolso de préstamo"},
		{CardPaymentDescription, []any{"tarjeta BHD"}, "Pago a tarjeta BHD", "Payment to tarjeta BHD", "Pago a tarjeta BHD"},
		{BrokerFundingName, nil, "Transferencia al bróker", "Transfer to broker", "Transferencia al bróker"},
		{CategoryKey("loans_granted"), nil, "Préstamos otorgados", "Loans granted", "Préstamos otorgados"},
		{CategoryKey("card_payment"), nil, "Pago de tarjeta", "Card payment", "Pago de tarjeta"},
	}
	for _, tc := range cases {
		if got := T(es, tc.key, tc.args...); got != tc.es {
			t.Errorf("es %s = %q, want %q", tc.key, got, tc.es)
		}
		if got := T(en, tc.key, tc.args...); got != tc.en {
			t.Errorf("en %s = %q, want %q", tc.key, got, tc.en)
		}
		if got := T(def, tc.key, tc.args...); got != tc.defaultOut {
			t.Errorf("default %s = %q, want %q", tc.key, got, tc.defaultOut)
		}
	}
	if got := T(def, Key("does.not.exist")); got != "does.not.exist" {
		t.Errorf("unknown key = %q", got)
	}
	if got := TL(Locale("fr"), LoanDisbursementDescription); got != "Desembolso de préstamo" {
		t.Errorf("unsupported locale must fall back to Spanish, got %q", got)
	}
}

func TestEveryMessageHasBothLocales(t *testing.T) {
	for key, translations := range messages {
		for _, loc := range []Locale{ES, EN} {
			if strings.TrimSpace(translations[loc]) == "" {
				t.Errorf("message %s has no %s translation", key, loc)
			}
		}
	}
}

// Every name a system category can be created with must be in its
// KnownNames, so a category created in one language is never duplicated
// when looked up from the other (and every system category is translated).
func TestSystemCategoryNamesAreKnown(t *testing.T) {
	for _, sys := range category.Systems() {
		translations := Translations(CategoryKey(sys.Key))
		if len(translations) != 2 {
			t.Fatalf("system category %s is not translated: %v", sys.Key, translations)
		}
		for _, name := range translations {
			found := false
			for _, known := range sys.KnownNames {
				if strings.EqualFold(known, name) {
					found = true
				}
			}
			if !found {
				t.Errorf("system category %s: %q missing from KnownNames %v", sys.Key, name, sys.KnownNames)
			}
		}
	}
}

func TestMiddlewareStoresLocaleForGinAndRequestContexts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := map[string]Locale{"en-US,en;q=0.9": EN, "es": ES, "": ES}
	for header, want := range cases {
		var fromGin, fromRequest, fromDerived Locale
		r := gin.New()
		r.Use(Middleware())
		r.GET("/", func(c *gin.Context) {
			fromGin = FromContext(c)
			fromRequest = FromContext(c.Request.Context())
			derived, cancel := context.WithCancel(c)
			defer cancel()
			fromDerived = FromContext(derived)
		})
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		if header != "" {
			req.Header.Set("Accept-Language", header)
		}
		r.ServeHTTP(httptest.NewRecorder(), req)
		if fromGin != want || fromRequest != want || fromDerived != want {
			t.Errorf("Accept-Language %q: gin=%q request=%q derived=%q, want %q", header, fromGin, fromRequest, fromDerived, want)
		}
	}
}
