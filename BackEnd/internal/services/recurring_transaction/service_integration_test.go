package recurring_transaction_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	domain "github.com/osmait/gestorDePresupuesto/internal/domain/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/recurring_transaction"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	notificationRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/notification"
	recurringRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/recurring_transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	service "github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

var testDB *sql.DB

func TestMain(m *testing.M) {
	ctx := context.Background()
	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "postgres:17-alpine",
			ExposedPorts: []string{"5432/tcp"},
			Env: map[string]string{
				"POSTGRES_DB":       "testdb",
				"POSTGRES_USER":     "test",
				"POSTGRES_PASSWORD": "test",
			},
			WaitingFor: wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		log.Fatalf("failed to start postgres container: %v", err)
	}
	host, err := container.Host(ctx)
	if err != nil {
		log.Fatalf("container host: %v", err)
	}
	port, err := container.MappedPort(ctx, "5432/tcp")
	if err != nil {
		log.Fatalf("container port: %v", err)
	}
	connStr := fmt.Sprintf("postgres://test:test@%s:%s/testdb?sslmode=disable", host, port.Port())

	if err := utils.RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, connStr); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	testDB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}

	code := m.Run()
	_ = testDB.Close()
	_ = container.Terminate(ctx)
	os.Exit(code)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

type clock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *clock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *clock) Set(t time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = t
}

func santoDomingo(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		t.Skipf("tzdata not available: %v", err)
	}
	return loc
}

func newService(t *testing.T, clk *clock) *service.RecurringTransactionService {
	t.Helper()
	notifSvc := notification.NewNotificationService(notificationRepo.NewNotificationRepository(testDB))
	txSvc := transaction.NewTransactionService(
		transactionRepo.NewTransactionRepository(testDB),
		budgetRepo.NewBudgetRepository(testDB),
		notifSvc,
		cache.NewInMemoryCache(time.Minute, time.Minute),
		nil,
		nil,
	)
	return service.NewRecurringTransactionService(
		recurringRepo.NewRecurringTransactionRepository(testDB),
		txSvc,
		notifSvc,
		service.WithLocation(santoDomingo(t)),
		service.WithClock(clk.Now),
	)
}

type fixture struct {
	userID, accountID, categoryID string
}

var idSeq atomic.Int64

// uniq returns a short unique id (account.id is VARCHAR(32)).
func uniq(prefix string) string {
	return fmt.Sprintf("%s%d_%d", prefix, idSeq.Add(1), time.Now().UnixNano())
}

func newFixture(t *testing.T, currency string) fixture {
	t.Helper()
	f := fixture{userID: uniq("u"), accountID: uniq("a"), categoryID: uniq("c")}
	mustExec(t, `INSERT INTO users (id, name, last_name, email, password) VALUES ($1,'Test','User',$2,'x')`, f.userID, f.userID+"@example.com")
	mustExec(t, `INSERT INTO account (id, name_account, bank, balance, user_id, account_type, currency) VALUES ($1,'Main','Bank',0,$2,'bank',$3)`, f.accountID, f.userID, currency)
	mustExec(t, `INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1,'Bills','tag','#fff',$2)`, f.categoryID, f.userID)
	// Remove this fixture's rules afterwards so global processing runs in
	// other tests never see them.
	t.Cleanup(func() {
		_, _ = testDB.Exec(`DELETE FROM recurring_transactions WHERE user_id=$1`, f.userID)
	})
	return f
}

func mustExec(t *testing.T, q string, args ...any) {
	t.Helper()
	if _, err := testDB.Exec(q, args...); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
}

func (f fixture) rule(day int) *domain.RecurringTransaction {
	return domain.NewRecurringTransaction("", f.userID, "Rent", "monthly rent", money.FromInt(1000), "bill", f.accountID, f.categoryID, nil, day)
}

type txnRow struct {
	ID        string
	Currency  string
	CreatedAt time.Time
}

func transactionsFor(t *testing.T, accountID string) []txnRow {
	t.Helper()
	rows, err := testDB.Query(`SELECT id, currency, created_at FROM transactions WHERE account_id=$1 ORDER BY created_at`, accountID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	var out []txnRow
	for rows.Next() {
		var r txnRow
		if err := rows.Scan(&r.ID, &r.Currency, &r.CreatedAt); err != nil {
			t.Fatal(err)
		}
		out = append(out, r)
	}
	return out
}

func nextExecution(t *testing.T, id string) string {
	t.Helper()
	var d time.Time
	if err := testDB.QueryRow(`SELECT next_execution_date FROM recurring_transactions WHERE id=$1`, id).Scan(&d); err != nil {
		t.Fatal(err)
	}
	return d.Format(time.DateOnly)
}

func executionCount(t *testing.T, id string) int {
	t.Helper()
	var n int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM recurring_transaction_executions WHERE recurring_transaction_id=$1 AND transaction_id IS NOT NULL`, id).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

func TestProcess_ConcurrentRunsCreateExactlyOneTransaction(t *testing.T) {
	clk := &clock{now: time.Date(2026, time.October, 8, 15, 0, 0, 0, time.UTC)}
	f := newFixture(t, "DOP")
	creator := newService(t, clk)
	rt := f.rule(8)
	if err := creator.Create(context.Background(), rt); err != nil {
		t.Fatal(err)
	}

	const workers = 12
	var wg sync.WaitGroup
	start := make(chan struct{})
	errs := make(chan error, workers)
	for i := 0; i < workers; i++ {
		svc := newService(t, clk) // independent instances, like separate replicas
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			errs <- svc.ProcessDueTransactions(context.Background())
		}()
	}
	close(start)
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("process: %v", err)
		}
	}

	if got := transactionsFor(t, f.accountID); len(got) != 1 {
		t.Fatalf("expected exactly 1 transaction, got %d", len(got))
	}
	if n := executionCount(t, rt.ID); n != 1 {
		t.Fatalf("expected 1 execution row, got %d", n)
	}
	if got := nextExecution(t, rt.ID); got != "2026-11-08" {
		t.Fatalf("next_execution_date = %s, want 2026-11-08", got)
	}

	// A further run on the same day is a no-op.
	if err := creator.ProcessDueTransactions(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := transactionsFor(t, f.accountID); len(got) != 1 {
		t.Fatalf("second run created duplicates: %d transactions", len(got))
	}
}

func TestRepository_RecordExecutionIsIdempotent(t *testing.T) {
	clk := &clock{now: time.Date(2026, time.October, 8, 15, 0, 0, 0, time.UTC)}
	f := newFixture(t, "DOP")
	rt := f.rule(20)
	if err := newService(t, clk).Create(context.Background(), rt); err != nil {
		t.Fatal(err)
	}
	repo := recurringRepo.NewRecurringTransactionRepository(testDB)
	date := time.Date(2026, time.October, 20, 0, 0, 0, 0, time.UTC)
	for i, want := range []bool{true, false} {
		tx, err := testDB.Begin()
		if err != nil {
			t.Fatal(err)
		}
		got, err := repo.RecordExecution(context.Background(), tx, rt.ID, f.userID, date)
		if err != nil {
			t.Fatal(err)
		}
		if err := tx.Commit(); err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("attempt %d: inserted=%v, want %v", i, got, want)
		}
	}
}

func TestProcess_DayClampingJan31ToFeb28AndBack(t *testing.T) {
	clk := &clock{now: time.Date(2026, time.January, 31, 14, 0, 0, 0, time.UTC)}
	f := newFixture(t, "DOP")
	svc := newService(t, clk)
	rt := f.rule(31)
	ctx := context.Background()
	if err := svc.Create(ctx, rt); err != nil {
		t.Fatal(err)
	}
	if got := nextExecution(t, rt.ID); got != "2026-01-31" {
		t.Fatalf("initial next = %s", got)
	}

	if err := svc.ProcessDueTransactionsForUser(ctx, f.userID); err != nil {
		t.Fatal(err)
	}
	if got := nextExecution(t, rt.ID); got != "2026-02-28" {
		t.Fatalf("after Jan 31 next = %s, want 2026-02-28", got)
	}

	clk.Set(time.Date(2026, time.February, 27, 14, 0, 0, 0, time.UTC))
	if err := svc.ProcessDueTransactionsForUser(ctx, f.userID); err != nil {
		t.Fatal(err)
	}
	if got := transactionsFor(t, f.accountID); len(got) != 1 {
		t.Fatalf("Feb 27 must not execute; got %d transactions", len(got))
	}

	clk.Set(time.Date(2026, time.February, 28, 14, 0, 0, 0, time.UTC))
	if err := svc.ProcessDueTransactionsForUser(ctx, f.userID); err != nil {
		t.Fatal(err)
	}
	txns := transactionsFor(t, f.accountID)
	if len(txns) != 2 {
		t.Fatalf("expected Feb 28 execution, got %d transactions", len(txns))
	}
	if got := nextExecution(t, rt.ID); got != "2026-03-31" {
		t.Fatalf("after Feb 28 next = %s, want 2026-03-31", got)
	}
}

func TestProcess_LeapYearJan31ToFeb29(t *testing.T) {
	clk := &clock{now: time.Date(2028, time.January, 31, 14, 0, 0, 0, time.UTC)}
	f := newFixture(t, "DOP")
	svc := newService(t, clk)
	rt := f.rule(31)
	ctx := context.Background()
	if err := svc.Create(ctx, rt); err != nil {
		t.Fatal(err)
	}
	if err := svc.ProcessDueTransactionsForUser(ctx, f.userID); err != nil {
		t.Fatal(err)
	}
	if got := nextExecution(t, rt.ID); got != "2028-02-29" {
		t.Fatalf("next = %s, want 2028-02-29", got)
	}
}

func TestProcess_TimeZoneBoundary(t *testing.T) {
	loc := santoDomingo(t)
	// 03:30 UTC on Mar 1 is still Feb 28 (23:30) in America/Santo_Domingo.
	clk := &clock{now: time.Date(2026, time.March, 1, 3, 30, 0, 0, time.UTC)}
	f := newFixture(t, "DOP")
	svc := newService(t, clk)
	rt := f.rule(1)
	ctx := context.Background()
	if err := svc.Create(ctx, rt); err != nil {
		t.Fatal(err)
	}
	if got := nextExecution(t, rt.ID); got != "2026-03-01" {
		t.Fatalf("next = %s, want 2026-03-01", got)
	}

	if err := svc.ProcessDueTransactionsForUser(ctx, f.userID); err != nil {
		t.Fatal(err)
	}
	if got := transactionsFor(t, f.accountID); len(got) != 0 {
		t.Fatalf("must not execute before local midnight, got %d transactions", len(got))
	}

	// 04:30 UTC is 00:30 on Mar 1 local time.
	clk.Set(time.Date(2026, time.March, 1, 4, 30, 0, 0, time.UTC))
	if err := svc.ProcessDueTransactionsForUser(ctx, f.userID); err != nil {
		t.Fatal(err)
	}
	txns := transactionsFor(t, f.accountID)
	if len(txns) != 1 {
		t.Fatalf("expected 1 transaction after local midnight, got %d", len(txns))
	}
	if y, m, d := txns[0].CreatedAt.In(loc).Date(); y != 2026 || m != time.March || d != 1 {
		t.Fatalf("transaction local date = %d-%02d-%02d, want 2026-03-01", y, m, d)
	}
}

func TestProcess_CatchUpCreatesEachMissedOccurrenceOnce(t *testing.T) {
	loc := santoDomingo(t)
	clk := &clock{now: time.Date(2026, time.June, 10, 14, 0, 0, 0, time.UTC)}
	f := newFixture(t, "DOP")
	svc := newService(t, clk)
	rt := f.rule(10)
	ctx := context.Background()
	if err := svc.Create(ctx, rt); err != nil {
		t.Fatal(err)
	}

	// Server "down" from Jun 10 until Sep 15.
	clk.Set(time.Date(2026, time.September, 15, 14, 0, 0, 0, time.UTC))
	for i := 0; i < 2; i++ {
		if err := svc.ProcessDueTransactionsForUser(ctx, f.userID); err != nil {
			t.Fatal(err)
		}
	}

	txns := transactionsFor(t, f.accountID)
	want := []string{"2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10"}
	if len(txns) != len(want) {
		t.Fatalf("expected %d catch-up transactions, got %d", len(want), len(txns))
	}
	for i, txn := range txns {
		if got := txn.CreatedAt.In(loc).Format(time.DateOnly); got != want[i] {
			t.Errorf("transaction %d dated %s, want %s", i, got, want[i])
		}
	}
	if got := nextExecution(t, rt.ID); got != "2026-10-10" {
		t.Fatalf("next = %s, want 2026-10-10", got)
	}
}

func TestProcess_UsesAccountCurrency(t *testing.T) {
	clk := &clock{now: time.Date(2026, time.October, 8, 15, 0, 0, 0, time.UTC)}
	f := newFixture(t, "USD")
	svc := newService(t, clk)
	rt := f.rule(8)
	ctx := context.Background()
	if err := svc.Create(ctx, rt); err != nil {
		t.Fatal(err)
	}
	if err := svc.ProcessDueTransactionsForUser(ctx, f.userID); err != nil {
		t.Fatal(err)
	}
	txns := transactionsFor(t, f.accountID)
	if len(txns) != 1 || txns[0].Currency != "USD" {
		t.Fatalf("expected one USD transaction, got %+v", txns)
	}
}

func TestService_CrossUserAccessDenied(t *testing.T) {
	clk := &clock{now: time.Date(2026, time.October, 8, 15, 0, 0, 0, time.UTC)}
	owner := newFixture(t, "DOP")
	attacker := newFixture(t, "DOP")
	svc := newService(t, clk)
	ctx := context.Background()

	rt := owner.rule(20)
	if err := svc.Create(ctx, rt); err != nil {
		t.Fatal(err)
	}

	// Update with the victim's id but the attacker's identity.
	hijack := attacker.rule(5)
	hijack.ID = rt.ID
	hijack.Name = "hijacked"
	if err := svc.Update(ctx, hijack); !errors.Is(err, service.ErrNotFound) {
		t.Fatalf("cross-user update: expected ErrNotFound, got %v", err)
	}
	if err := svc.Delete(ctx, rt.ID, attacker.userID); !errors.Is(err, service.ErrNotFound) {
		t.Fatalf("cross-user delete: expected ErrNotFound, got %v", err)
	}

	rules, err := svc.FindAllByUser(ctx, owner.userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].Name != "Rent" || rules[0].DayOfMonth != 20 {
		t.Fatalf("owner rule was modified: %+v", rules)
	}

	// Referencing another user's account or category is rejected.
	foreignAccount := attacker.rule(5)
	foreignAccount.AccountID = owner.accountID
	if err := svc.Create(ctx, foreignAccount); !errors.Is(err, service.ErrInvalidReference) {
		t.Fatalf("foreign account: expected ErrInvalidReference, got %v", err)
	}
	foreignCategory := attacker.rule(5)
	foreignCategory.CategoryID = owner.categoryID
	if err := svc.Create(ctx, foreignCategory); !errors.Is(err, service.ErrInvalidReference) {
		t.Fatalf("foreign category: expected ErrInvalidReference, got %v", err)
	}
	ownUpdate := owner.rule(20)
	ownUpdate.ID = rt.ID
	ownUpdate.AccountID = attacker.accountID
	if err := svc.Update(ctx, ownUpdate); !errors.Is(err, service.ErrInvalidReference) {
		t.Fatalf("update to foreign account: expected ErrInvalidReference, got %v", err)
	}

	// The owner can still update and delete.
	ownUpdate.AccountID = owner.accountID
	ownUpdate.Name = "Rent v2"
	if err := svc.Update(ctx, ownUpdate); err != nil {
		t.Fatalf("owner update: %v", err)
	}
	if err := svc.Delete(ctx, rt.ID, owner.userID); err != nil {
		t.Fatalf("owner delete: %v", err)
	}
}

func TestHandler_CrossUserUpdateDeleteReturn404(t *testing.T) {
	gin.SetMode(gin.TestMode)
	clk := &clock{now: time.Date(2026, time.October, 8, 15, 0, 0, 0, time.UTC)}
	owner := newFixture(t, "DOP")
	attacker := newFixture(t, "DOP")
	svc := newService(t, clk)

	rt := owner.rule(20)
	if err := svc.Create(context.Background(), rt); err != nil {
		t.Fatal(err)
	}

	h := handler.NewRecurringTransactionHandler(svc)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("X-User-Id", c.GetHeader("X-Test-User")) })
	r.PUT("/recurring-transactions/:id", h.Update)
	r.DELETE("/recurring-transactions/:id", h.Delete)

	body := fmt.Sprintf(`{"name":"pwned","amount":1,"type":"bill","account_id":%q,"category_id":%q,"day_of_month":1}`, attacker.accountID, attacker.categoryID)
	for _, req := range []*http.Request{
		httptest.NewRequest(http.MethodPut, "/recurring-transactions/"+rt.ID, strings.NewReader(body)),
		httptest.NewRequest(http.MethodDelete, "/recurring-transactions/"+rt.ID, nil),
	} {
		req.Header.Set("X-Test-User", attacker.userID)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusNotFound {
			t.Fatalf("%s as other user: status %d, want 404 (body %s)", req.Method, w.Code, w.Body.String())
		}
	}

	rules, err := svc.FindAllByUser(context.Background(), owner.userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].Name != "Rent" {
		t.Fatalf("owner rule changed: %+v", rules)
	}
}
