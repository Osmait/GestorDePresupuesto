package telemetry

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"os"
	"strings"
	"sync"
	"unicode"

	"github.com/XSAM/otelsql"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
	"go.opentelemetry.io/otel/trace"
)

// semconvOptInEnv is the OpenTelemetry semantic-convention opt-in variable.
const semconvOptInEnv = "OTEL_SEMCONV_STABILITY_OPT_IN"

// maxStatementLen bounds the db.query.text span attribute.
const maxStatementLen = 2048

// OpenDB opens the database. With telemetry off it is exactly sql.Open; with
// tracing on, every query/exec/tx inside a traced request becomes a child
// span named after its summary ("SELECT accounts") with the statement
// sanitized (literals replaced by "?"); with metrics on it records
// db.client.operation.duration (by db.query.summary) and connection-pool
// gauges (db.sql.connection.*).
func OpenDB(t *Telemetry, driverName, dsn string) (*sql.DB, error) {
	if !t.Enabled() {
		return sql.Open(driverName, dsn)
	}

	// otelsql only emits the stable db.client.operation.duration metric and
	// db.query.text attribute when opted in; default to the stable
	// conventions unless the operator chose otherwise.
	if os.Getenv(semconvOptInEnv) == "" {
		_ = os.Setenv(semconvOptInEnv, "database")
	}

	system := attribute.String("db.system.name", driverName)
	if driverName == "postgres" || driverName == "pgx" {
		system = semconv.DBSystemNamePostgreSQL
	}

	db, err := otelsql.Open(driverName, dsn,
		otelsql.WithTracerProvider(t.TracerProvider()),
		otelsql.WithMeterProvider(t.MeterProvider()),
		otelsql.WithAttributes(system),
		otelsql.WithSpanNameFormatter(func(_ context.Context, method otelsql.Method, query string) string {
			if query == "" {
				return string(method)
			}
			return QuerySummary(query)
		}),
		otelsql.WithSpanOptions(otelsql.SpanOptions{
			DisableQuery:         true, // replaced by the sanitized text below
			DisableErrSkip:       true,
			OmitConnResetSession: true,
			OmitConnPrepare:      true,
			OmitRows:             true,
			OmitConnectorConnect: false,
			// Only trace queries that belong to a trace (HTTP request or
			// worker run); pool housekeeping does not create root spans.
			SpanFilter: func(ctx context.Context, _ otelsql.Method, _ string, _ []driver.NamedValue) bool {
				return trace.SpanContextFromContext(ctx).IsValid()
			},
		}),
		otelsql.WithAttributesGetter(func(_ context.Context, _ otelsql.Method, query string, _ []driver.NamedValue) []attribute.KeyValue {
			if query == "" {
				return nil
			}
			return []attribute.KeyValue{
				semconv.DBQueryText(SanitizeSQL(query)),
				semconv.DBQuerySummary(QuerySummary(query)),
			}
		}),
		otelsql.WithInstrumentAttributesGetter(func(_ context.Context, _ otelsql.Method, query string, _ []driver.NamedValue) []attribute.KeyValue {
			if query == "" {
				return nil
			}
			return []attribute.KeyValue{semconv.DBQuerySummary(QuerySummary(query))}
		}),
	)
	if err != nil {
		return nil, err
	}

	if t.MetricsEnabled() {
		if _, err := otelsql.RegisterDBStatsMetrics(db,
			otelsql.WithMeterProvider(t.MeterProvider()),
			otelsql.WithAttributes(system),
		); err != nil {
			_ = db.Close()
			return nil, err
		}
	}
	return db, nil
}

// summaryCache memoizes QuerySummary for the (mostly static) query strings.
// Dynamic queries are bounded by maxSummaryCache to cap memory.
var (
	summaryCache    sync.Map
	summaryCacheLen int64
	summaryCacheMu  sync.Mutex
)

const maxSummaryCache = 4096

// QuerySummary returns a low-cardinality "<OPERATION> <table>" label for a
// statement, e.g. "SELECT transactions", "INSERT accounts", "BEGIN".
// Literals, ids and parameters never appear in it.
func QuerySummary(query string) string {
	if v, ok := summaryCache.Load(query); ok {
		return v.(string)
	}
	s := computeSummary(query)
	summaryCacheMu.Lock()
	if summaryCacheLen < maxSummaryCache {
		if _, loaded := summaryCache.LoadOrStore(query, s); !loaded {
			summaryCacheLen++
		}
	}
	summaryCacheMu.Unlock()
	return s
}

func computeSummary(query string) string {
	tokens := sqlTokens(query, 64)
	if len(tokens) == 0 {
		return "UNKNOWN"
	}
	op := strings.ToUpper(tokens[0])
	switch op {
	case "SELECT", "INSERT", "UPDATE", "DELETE", "WITH", "MERGE":
	default:
		// BEGIN, COMMIT, SET, SHOW... are already low cardinality.
		if isWord(op) && len(op) <= 16 {
			return op
		}
		return "OTHER"
	}

	var target string
	if op == "UPDATE" {
		for _, tok := range tokens[1:] {
			if strings.EqualFold(tok, "ONLY") {
				continue
			}
			if isIdentifier(tok) {
				target = strings.ToLower(tok)
			}
			break
		}
	} else {
		for i := 1; i < len(tokens)-1; i++ {
			switch strings.ToUpper(tokens[i]) {
			case "FROM", "INTO", "JOIN":
				next := tokens[i+1]
				if isIdentifier(next) && !isKeyword(next) {
					target = strings.ToLower(next)
				}
			}
			if target != "" {
				break
			}
		}
	}
	if target == "" {
		return op
	}
	return op + " " + target
}

func isWord(s string) bool {
	for _, r := range s {
		if !unicode.IsLetter(r) {
			return false
		}
	}
	return s != ""
}

func isIdentifier(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '.' && r != '"' {
			return false
		}
	}
	return true
}

func isKeyword(s string) bool {
	switch strings.ToUpper(s) {
	case "SELECT", "LATERAL", "ONLY", "UNNEST", "GENERATE_SERIES":
		return true
	}
	return false
}

// sqlTokens splits a statement into at most max coarse tokens (words and
// single punctuation), skipping string literals and comments.
func sqlTokens(q string, max int) []string {
	var out []string
	i := 0
	for i < len(q) && len(out) < max {
		c := q[i]
		switch {
		case c == '-' && i+1 < len(q) && q[i+1] == '-':
			for i < len(q) && q[i] != '\n' {
				i++
			}
		case c == '/' && i+1 < len(q) && q[i+1] == '*':
			end := strings.Index(q[i+2:], "*/")
			if end < 0 {
				return out
			}
			i += end + 4
		case c == '\'':
			i = skipQuoted(q, i)
		case c == ' ' || c == '\n' || c == '\t' || c == '\r':
			i++
		case isIdentByte(c):
			start := i
			for i < len(q) && isIdentByte(q[i]) {
				i++
			}
			out = append(out, strings.Trim(q[start:i], `"`))
		default:
			out = append(out, string(c))
			i++
		}
	}
	return out
}

func isIdentByte(c byte) bool {
	return c == '_' || c == '.' || c == '"' || c == '$' ||
		(c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c >= 0x80
}

// skipQuoted returns the index just after the single-quoted literal at i
// (handles doubled ” escapes).
func skipQuoted(q string, i int) int {
	i++
	for i < len(q) {
		if q[i] == '\'' {
			if i+1 < len(q) && q[i+1] == '\'' {
				i += 2
				continue
			}
			return i + 1
		}
		i++
	}
	return i
}

// SanitizeSQL collapses whitespace, replaces string and numeric literals with
// "?" (bind parameters like $1 are kept) and truncates the statement, so the
// span attribute never carries user data even if a query inlines a value.
func SanitizeSQL(q string) string {
	var b strings.Builder
	b.Grow(min(len(q), maxStatementLen))
	space := false
	prev := byte(' ')
	for i := 0; i < len(q) && b.Len() < maxStatementLen; {
		c := q[i]
		switch {
		case c == '-' && i+1 < len(q) && q[i+1] == '-':
			for i < len(q) && q[i] != '\n' {
				i++
			}
			continue
		case c == '/' && i+1 < len(q) && q[i+1] == '*':
			end := strings.Index(q[i+2:], "*/")
			if end < 0 {
				i = len(q)
			} else {
				i += end + 4
			}
			continue
		case c == ' ' || c == '\n' || c == '\t' || c == '\r':
			space = true
			i++
			continue
		}
		if space && b.Len() > 0 {
			b.WriteByte(' ')
			prev = ' '
		}
		space = false
		switch {
		case c == '\'':
			b.WriteByte('?')
			prev = '?'
			i = skipQuoted(q, i)
		case c >= '0' && c <= '9' && !isIdentByte(prev):
			for i < len(q) && ((q[i] >= '0' && q[i] <= '9') || q[i] == '.') {
				i++
			}
			b.WriteByte('?')
			prev = '?'
		default:
			b.WriteByte(c)
			prev = c
			i++
		}
	}
	return b.String()
}
