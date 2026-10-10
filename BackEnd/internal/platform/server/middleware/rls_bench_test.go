package middleware

// Benchmarks for the per-request cost of RLSMiddleware.
//
// In-memory (always run):
//
//	go test ./internal/platform/server/middleware -run '^$' -bench 'BufferedWriter' -benchmem
//
// DB-backed (skipped unless PERF_PG_DSN points at a seeded perf database,
// e.g. postgres://perf:<password>@127.0.0.1:15441/perf?sslmode=disable):
//
//	PERF_PG_DSN=... go test ./internal/platform/server/middleware -run '^$' -bench 'RLS' -benchmem
//
// The DB benchmarks compare one authenticated GET that runs a single
// user-scoped query (a) straight on the pool, (b) through RLSMiddleware
// (BEGIN + set_config + query + COMMIT + response buffering), each with
// lib/pq's default protocol and with binary_parameters=yes (which turns every
// parameterized query from two round trips into one).

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

type benchTx struct {
	Id          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Amount      string    `json:"amount"`
	Type        string    `json:"type_transation"`
	AccountId   string    `json:"account_id"`
	CategoryId  string    `json:"category_id"`
	Currency    string    `json:"currency"`
	CreatedAt   time.Time `json:"created_at"`
}

func benchPage(n int) gin.H {
	rows := make([]benchTx, n)
	for i := range rows {
		rows[i] = benchTx{Id: fmt.Sprintf("pt%025d", i), Name: "Supermercado Nacional", Description: "seed tx",
			Amount: "1234.56", Type: "bill", AccountId: "pa0000000000000000000000001",
			CategoryId: "pc0000000000000000000000004", Currency: "DOP", CreatedAt: time.Now()}
	}
	return gin.H{"data": rows}
}

// bufferOnly reproduces exactly the response-buffering part of RLSMiddleware
// (no database), to isolate its cost.
func bufferOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		original := c.Writer
		bw := newBufferedResponseWriter(original)
		c.Writer = bw
		c.Next()
		c.Writer = original
		bw.flushTo(original)
	}
}

func serveBench(b *testing.B, r *gin.Engine, path string) {
	b.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			b.Fatalf("status %d: %s", w.Code, w.Body.String())
		}
	}
}

func BenchmarkBufferedWriter(b *testing.B) {
	gin.SetMode(gin.ReleaseMode)
	for _, n := range []int{1, 20, 100} {
		page := benchPage(n)
		h := func(c *gin.Context) { c.JSON(http.StatusOK, page) }
		b.Run(fmt.Sprintf("direct/rows=%d", n), func(b *testing.B) {
			r := gin.New()
			r.GET("/x", h)
			serveBench(b, r, "/x")
		})
		b.Run(fmt.Sprintf("buffered/rows=%d", n), func(b *testing.B) {
			r := gin.New()
			r.Use(bufferOnly())
			r.GET("/x", h)
			serveBench(b, r, "/x")
		})
	}
}

const benchUser = "pu0000000000000000000000000"

func openBenchDB(b *testing.B, binaryParams bool) *sql.DB {
	b.Helper()
	dsn := os.Getenv("PERF_PG_DSN")
	if dsn == "" {
		b.Skip("PERF_PG_DSN not set")
	}
	if binaryParams {
		sep := "?"
		if strings.Contains(dsn, "?") {
			sep = "&"
		}
		dsn += sep + "binary_parameters=yes"
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		b.Fatal(err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	if err := db.Ping(); err != nil {
		b.Skipf("db not reachable: %v", err)
	}
	b.Cleanup(func() { _ = db.Close() })
	return db
}

// one cheap, user-scoped, index-backed query (same shape as category listing)
const benchQuery = "SELECT id, name, icon, color, created_at FROM categorys WHERE user_id = $1"

func categoriesHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := txhelper.FromContext(c.Request.Context(), db).QueryContext(c.Request.Context(), benchQuery, c.GetString("X-User-Id"))
		if err != nil {
			_ = c.Error(err)
			c.Status(http.StatusInternalServerError)
			return
		}
		defer func() { _ = rows.Close() }()
		type cat struct {
			Id, Name, Icon, Color string
			CreatedAt             time.Time
		}
		out := make([]cat, 0, 32)
		for rows.Next() {
			var k cat
			if err := rows.Scan(&k.Id, &k.Name, &k.Icon, &k.Color, &k.CreatedAt); err != nil {
				_ = c.Error(err)
				c.Status(http.StatusInternalServerError)
				return
			}
			out = append(out, k)
		}
		c.JSON(http.StatusOK, out)
	}
}

func BenchmarkRLS(b *testing.B) {
	gin.SetMode(gin.ReleaseMode)
	for _, bp := range []bool{false, true} {
		proto := "pq-default"
		if bp {
			proto = "pq-binary_parameters"
		}
		b.Run(proto+"/pool-only", func(b *testing.B) {
			db := openBenchDB(b, bp)
			r := gin.New()
			r.Use(injectUserContext(benchUser, nil))
			r.GET("/category", categoriesHandler(db))
			serveBench(b, r, "/category")
		})
		b.Run(proto+"/rls-middleware", func(b *testing.B) {
			db := openBenchDB(b, bp)
			r := gin.New()
			r.Use(injectUserContext(benchUser, nil))
			r.Use(RLSMiddleware(db))
			r.GET("/category", categoriesHandler(db))
			serveBench(b, r, "/category")
		})
		b.Run(proto+"/rls-middleware-parallel", func(b *testing.B) {
			db := openBenchDB(b, bp)
			r := gin.New()
			r.Use(injectUserContext(benchUser, nil))
			r.Use(RLSMiddleware(db))
			r.GET("/category", categoriesHandler(db))
			b.ReportAllocs()
			b.SetParallelism(2)
			b.RunParallel(func(pb *testing.PB) {
				req := httptest.NewRequest(http.MethodGet, "/category", nil)
				for pb.Next() {
					w := httptest.NewRecorder()
					r.ServeHTTP(w, req)
					if w.Code != http.StatusOK {
						b.Errorf("status %d", w.Code)
						return
					}
				}
			})
		})
	}
}
