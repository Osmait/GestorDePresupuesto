// Package i18n localizes the few strings the backend generates itself:
// names/descriptions of the transactions it creates (card payments, loan
// disbursements, broker funding, ...) and the names of the system categories
// it creates on demand.
//
// The locale comes from the request's Accept-Language header (the frontend
// proxy sends "es" or "en"); Middleware stores it in the request context and
// T resolves a message key for it. Spanish is the default.
package i18n

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// Locale is a supported UI language.
type Locale string

const (
	ES Locale = "es"
	EN Locale = "en"

	// Default is used when the request carries no supported language.
	Default = ES
)

// ginKey stores the locale in a *gin.Context (gin.Context.Value does not fall
// back to the request context unless ContextWithFallback is enabled).
const ginKey = "i18n.locale"

type localeKey struct{}

// WithLocale returns a copy of ctx carrying locale.
func WithLocale(ctx context.Context, locale Locale) context.Context {
	return context.WithValue(ctx, localeKey{}, locale)
}

// FromContext returns the locale stored by WithLocale/Middleware, or Default.
// It accepts plain contexts, a *gin.Context and contexts derived from one.
func FromContext(ctx context.Context) Locale {
	if ctx == nil {
		return Default
	}
	if loc, ok := ctx.Value(localeKey{}).(Locale); ok && loc != "" {
		return loc
	}
	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		ginCtx, _ = ctx.Value(gin.ContextKey).(*gin.Context)
	}
	if ginCtx != nil {
		if v, exists := ginCtx.Get(ginKey); exists {
			if loc, ok := v.(Locale); ok && loc != "" {
				return loc
			}
		}
		if ginCtx.Request != nil {
			if loc, ok := ginCtx.Request.Context().Value(localeKey{}).(Locale); ok && loc != "" {
				return loc
			}
		}
	}
	return Default
}

// Middleware resolves the locale from Accept-Language and stores it both in
// the gin context and in the request context.
func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		loc := ParseAcceptLanguage(c.GetHeader("Accept-Language"))
		c.Set(ginKey, loc)
		c.Request = c.Request.WithContext(WithLocale(c.Request.Context(), loc))
		c.Next()
	}
}

// ParseAcceptLanguage returns the supported locale with the highest quality
// in an Accept-Language header ("es", "en-US,en;q=0.9", "fr, en;q=0.5", ...).
// Unsupported, malformed or empty values yield Default.
func ParseAcceptLanguage(header string) Locale {
	type candidate struct {
		locale Locale
		q      float64
		order  int
	}
	var candidates []candidate
	for i, part := range strings.Split(header, ",") {
		fields := strings.Split(strings.TrimSpace(part), ";")
		tag := strings.ToLower(strings.TrimSpace(fields[0]))
		if tag == "" {
			continue
		}
		q := 1.0
		for _, param := range fields[1:] {
			param = strings.TrimSpace(param)
			if v, ok := strings.CutPrefix(param, "q="); ok {
				parsed, err := strconv.ParseFloat(v, 64)
				if err != nil {
					parsed = 0
				}
				q = parsed
			}
		}
		if q <= 0 {
			continue
		}
		base, _, _ := strings.Cut(tag, "-")
		base, _, _ = strings.Cut(base, "_")
		switch Locale(base) {
		case ES, EN:
			candidates = append(candidates, candidate{locale: Locale(base), q: q, order: i})
		}
	}
	if len(candidates) == 0 {
		return Default
	}
	sort.SliceStable(candidates, func(a, b int) bool {
		return candidates[a].q > candidates[b].q
	})
	return candidates[0].locale
}

// T returns the message `key` in the context's locale, formatted with args
// (fmt verbs). Unknown keys return the key itself.
func T(ctx context.Context, key Key, args ...any) string {
	return TL(FromContext(ctx), key, args...)
}

// TL is T for an explicit locale.
func TL(locale Locale, key Key, args ...any) string {
	translations, ok := messages[key]
	if !ok {
		return string(key)
	}
	format, ok := translations[locale]
	if !ok {
		format = translations[Default]
	}
	if len(args) == 0 {
		return format
	}
	return fmt.Sprintf(format, args...)
}

// Translations returns the message `key` in every supported locale (unformatted).
func Translations(key Key) []string {
	translations := messages[key]
	out := make([]string, 0, len(translations))
	for _, loc := range []Locale{ES, EN} {
		if s, ok := translations[loc]; ok {
			out = append(out, s)
		}
	}
	return out
}
