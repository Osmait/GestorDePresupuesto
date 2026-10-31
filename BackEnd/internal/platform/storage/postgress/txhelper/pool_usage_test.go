package txhelper

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

// directPoolCall matches a query or transaction started directly on a
// *sql.DB held in a variable or field named db (db.QueryContext(...),
// r.db.ExecContext(...), s.db.BeginTx(...), ...).
var directPoolCall = regexp.MustCompile(`\b(?:db|[A-Za-z_]+\.db)\.(ExecContext|QueryContext|QueryRowContext|BeginTx|Exec|Query|QueryRow|Begin|Conn|PrepareContext|Prepare)\(`)

// allowedPoolCalls are the only places that may use the pool directly. Each
// one runs where no request transaction is held by the same goroutine.
var allowedPoolCalls = map[string]string{
	"internal/platform/storage/postgress/txhelper/txhelper.go":                "InTx opens a transaction only when ctx carries none",
	"internal/platform/storage/postgress/txhelper/rls.go":                     "WithUserTx opens a transaction only when ctx carries none",
	"internal/platform/server/middleware/rls.go":                              "acquires the request's own (single) connection",
	"internal/platform/storage/postgress/recurring_transaction/repository.go": "scheduler transactions; the HTTP trigger is registered before RLSMiddleware",
	"internal/platform/mcp/tools.go":                                          "MCP tools open their only transaction (routes are outside RLSMiddleware)",
	"internal/platform/storage/postgress/mcpoauth/storage.go":                 "OAuth endpoints and the /mcp token check run outside RLSMiddleware, before any tool transaction",
	"internal/platform/server/routes/health.routes.go":                        "health checks run before AuthMiddleware/RLSMiddleware",
	"internal/e2e/helpers/test_helpers.go":                                    "test fixture",
}

// TestNoDirectPoolUsageInRequestCode guards the connection-pool deadlock fix:
// RLSMiddleware pins every authenticated request to ONE pooled connection, so
// any query issued on the plain *sql.DB from request code needs a second
// connection, and once concurrent requests hold the whole pool they all wait
// for each other forever. Use txhelper.FromContext / txhelper.InTx instead.
// (The e2e pool tests prove the same at runtime with DB_MAX_OPEN_CONNS=1.)
func TestNoDirectPoolUsageInRequestCode(t *testing.T) {
	root, err := filepath.Abs("../../../../..")
	if err != nil {
		t.Fatal(err)
	}
	var violations []string
	for _, dir := range []string{"internal", "cmd"} {
		err := filepath.WalkDir(filepath.Join(root, dir), func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			rel, _ := filepath.Rel(root, path)
			rel = filepath.ToSlash(rel)
			if _, ok := allowedPoolCalls[rel]; ok {
				return nil
			}
			f, err := os.Open(path)
			if err != nil {
				return err
			}
			defer func() { _ = f.Close() }()
			scanner := bufio.NewScanner(f)
			scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
			line := 0
			for scanner.Scan() {
				line++
				text := strings.TrimSpace(scanner.Text())
				if strings.HasPrefix(text, "//") {
					continue
				}
				if directPoolCall.MatchString(text) {
					violations = append(violations, rel+":"+strconv.Itoa(line)+": "+text)
				}
			}
			return scanner.Err()
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	if len(violations) > 0 {
		t.Fatalf("direct *sql.DB usage outside the allow-list (use txhelper.FromContext/InTx so request code never needs a second pooled connection):\n%s",
			strings.Join(violations, "\n"))
	}
}
