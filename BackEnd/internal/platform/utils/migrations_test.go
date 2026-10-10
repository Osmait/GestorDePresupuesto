package utils

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	_ "github.com/lib/pq"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
)

var (
	pgOnce      sync.Once
	pgContainer testcontainers.Container
	pgBaseURL   string // postgres://user:pass@host:port
	pgErr       error
)

func TestMain(m *testing.M) {
	code := m.Run()
	if pgContainer != nil {
		_ = pgContainer.Terminate(context.Background())
	}
	os.Exit(code)
}

// freshDatabase returns the URL of a brand-new empty database.
func freshDatabase(t *testing.T) string {
	t.Helper()
	testcontainers.SkipIfProviderIsNotHealthy(t)

	pgOnce.Do(func() {
		ctx := context.Background()
		pgContainer, pgErr = testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
			ContainerRequest: testcontainers.ContainerRequest{
				Image:        "postgres:17-alpine",
				ExposedPorts: []string{"5432/tcp"},
				Env: map[string]string{
					"POSTGRES_DB":       "postgres",
					"POSTGRES_USER":     "test",
					"POSTGRES_PASSWORD": "test",
				},
				WaitingFor: wait.ForLog("database system is ready to accept connections").
					WithOccurrence(2).
					WithStartupTimeout(60 * time.Second),
			},
			Started: true,
		})
		if pgErr != nil {
			return
		}
		host, err := pgContainer.Host(ctx)
		if err != nil {
			pgErr = err
			return
		}
		port, err := pgContainer.MappedPort(ctx, "5432/tcp")
		if err != nil {
			pgErr = err
			return
		}
		pgBaseURL = fmt.Sprintf("postgres://test:test@%s:%s", host, port.Port())
	})
	if pgErr != nil {
		t.Fatalf("start postgres container: %v", pgErr)
	}

	admin, err := sql.Open("postgres", pgBaseURL+"/postgres?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = admin.Close() }()

	name := "db_" + strings.ToLower(strings.NewReplacer("/", "_", " ", "_").Replace(t.Name()))
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	return pgBaseURL + "/" + name + "?sslmode=disable"
}

func latestEmbeddedVersion(t *testing.T) uint {
	t.Helper()
	entries, err := migrationsdb.Migrations.ReadDir(migrationsdb.MigrationsDir)
	if err != nil {
		t.Fatal(err)
	}
	var versions []int
	for _, e := range entries {
		v, err := strconv.Atoi(strings.SplitN(e.Name(), "_", 2)[0])
		if err != nil {
			t.Fatalf("unexpected migration file name %q", e.Name())
		}
		versions = append(versions, v)
	}
	sort.Ints(versions)
	return uint(versions[len(versions)-1])
}

func readVersion(t *testing.T, dbURL string) (uint, bool) {
	t.Helper()
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	var version uint
	var dirty bool
	if err := db.QueryRow("SELECT version, dirty FROM schema_migrations").Scan(&version, &dirty); err != nil {
		t.Fatalf("read schema_migrations: %v", err)
	}
	return version, dirty
}

func TestRunMigrationsFromFS_EmbeddedApplyOnFreshDB(t *testing.T) {
	dbURL := freshDatabase(t)

	if err := RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, dbURL); err != nil {
		t.Fatalf("apply embedded migrations: %v", err)
	}

	version, dirty := readVersion(t, dbURL)
	if dirty {
		t.Fatal("database left dirty")
	}
	if want := latestEmbeddedVersion(t); version != want {
		t.Fatalf("version = %d, want %d", version, want)
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	for _, table := range []string{"users", "transactions", "recurring_transactions", "recurring_transaction_executions"} {
		var exists bool
		if err := db.QueryRow("SELECT to_regclass($1) IS NOT NULL", "public."+table).Scan(&exists); err != nil || !exists {
			t.Fatalf("table %s missing (err=%v)", table, err)
		}
	}

	// Re-running is a no-op.
	if err := RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, dbURL); err != nil {
		t.Fatalf("second run should be a no-op, got %v", err)
	}
}

func TestRunMigrationsFromFS_DirtyStateReturnsErrorWithoutForcing(t *testing.T) {
	dbURL := freshDatabase(t)

	fsys := fstest.MapFS{
		"m/1_create_a.up.sql":   {Data: []byte("CREATE TABLE a (id int);")},
		"m/1_create_a.down.sql": {Data: []byte("DROP TABLE a;")},
		"m/2_broken.up.sql":     {Data: []byte("CREATE TABLE b (id int); SELECT * FROM table_that_does_not_exist;")},
		"m/2_broken.down.sql":   {Data: []byte("DROP TABLE IF EXISTS b;")},
	}

	err := RunMigrationsFromFS(fsys, "m", dbURL)
	if err == nil {
		t.Fatal("expected the broken migration to fail")
	}
	if version, dirty := readVersion(t, dbURL); version != 2 || !dirty {
		t.Fatalf("after failure got version=%d dirty=%v, want 2/true", version, dirty)
	}

	// The next start must refuse instead of forcing a version and re-running.
	err = RunMigrationsFromFS(fsys, "m", dbURL)
	if !errors.Is(err, ErrDirtyDatabase) {
		t.Fatalf("expected ErrDirtyDatabase, got %v", err)
	}
	if version, dirty := readVersion(t, dbURL); version != 2 || !dirty {
		t.Fatalf("dirty state was modified: version=%d dirty=%v", version, dirty)
	}

	// Same behaviour through the URL-based (file://) runner.
	dir := t.TempDir()
	for name, f := range fsys {
		if err := os.WriteFile(filepath.Join(dir, filepath.Base(name)), f.Data, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := RunDBMigration("file://"+filepath.ToSlash(dir), dbURL); !errors.Is(err, ErrDirtyDatabase) {
		t.Fatalf("expected ErrDirtyDatabase from RunDBMigration, got %v", err)
	}
}

// embeddedUpTo returns the embedded migrations with version < maxVersion.
func embeddedUpTo(t *testing.T, maxVersion int) fstest.MapFS {
	t.Helper()
	entries, err := migrationsdb.Migrations.ReadDir(migrationsdb.MigrationsDir)
	if err != nil {
		t.Fatal(err)
	}
	out := fstest.MapFS{}
	for _, e := range entries {
		v, _ := strconv.Atoi(strings.SplitN(e.Name(), "_", 2)[0])
		if v >= maxVersion {
			continue
		}
		data, err := migrationsdb.Migrations.ReadFile(migrationsdb.MigrationsDir + "/" + e.Name())
		if err != nil {
			t.Fatal(err)
		}
		out["m/"+e.Name()] = &fstest.MapFile{Data: data}
	}
	return out
}

func TestMigration48_BackfillsNextExecutionDate(t *testing.T) {
	dbURL := freshDatabase(t)
	if err := RunMigrationsFromFS(embeddedUpTo(t, 48), "m", dbURL); err != nil {
		t.Fatalf("apply migrations < 48: %v", err)
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()

	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := db.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec(`INSERT INTO users (id, name, last_name, email, password) VALUES ('u1','U','One','u1@example.com','x')`)
	mustExec(`INSERT INTO account (id, name_account, bank, balance, user_id) VALUES ('a1','A','B',0,'u1')`)
	mustExec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ('c1','C','i','#fff','u1')`)

	var today time.Time
	if err := db.QueryRow(`SELECT CURRENT_DATE`).Scan(&today); err != nil {
		t.Fatal(err)
	}
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	lastMonth := monthStart.AddDate(0, -1, 0)

	type row struct {
		id       string
		day      int
		lastExec *time.Time
		created  time.Time
	}
	lastMonthExec := lastMonth.AddDate(0, 0, 4)
	longAgo := monthStart.AddDate(0, -6, 0)
	rows := []row{
		{"executed_last_month", 5, &lastMonthExec, lastMonth.AddDate(0, -2, 0)},
		{"never_executed_recent", 31, nil, today.AddDate(0, 0, -1)},
		{"executed_long_ago", 15, &longAgo, longAgo},
		{"never_executed_old", 1, nil, monthStart.AddDate(-1, 0, 0)},
	}
	for _, r := range rows {
		mustExec(`INSERT INTO recurring_transactions (id, user_id, name, amount, type, account_id, category_id, day_of_month, last_execution_date, created_at)
			VALUES ($1,'u1','n',10,'bill','a1','c1',$2,$3,$4)`, r.id, r.day, r.lastExec, r.created)
	}

	if err := RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, dbURL); err != nil {
		t.Fatalf("apply remaining migrations: %v", err)
	}

	for _, r := range rows {
		floor := r.created
		if r.lastExec != nil {
			floor = time.Date(r.lastExec.Year(), r.lastExec.Month()+1, 1, 0, 0, 0, 0, time.UTC)
		}
		floor = time.Date(floor.Year(), floor.Month(), floor.Day(), 0, 0, 0, 0, time.UTC)
		if floor.Before(monthStart) {
			floor = monthStart
		}
		want := clampFirstOnOrAfter(floor, r.day)

		var got time.Time
		if err := db.QueryRow(`SELECT next_execution_date FROM recurring_transactions WHERE id=$1`, r.id).Scan(&got); err != nil {
			t.Fatal(err)
		}
		got = time.Date(got.Year(), got.Month(), got.Day(), 0, 0, 0, 0, time.UTC)
		if !got.Equal(want) {
			t.Errorf("%s: next_execution_date = %s, want %s", r.id, got.Format(time.DateOnly), want.Format(time.DateOnly))
		}
		if got.Before(monthStart) {
			t.Errorf("%s: backfill scheduled before the current month (%s)", r.id, got.Format(time.DateOnly))
		}
	}
}

// clampFirstOnOrAfter mirrors the domain FirstOccurrenceOnOrAfter helper.
func clampFirstOnOrAfter(date time.Time, day int) time.Time {
	occ := func(y int, m time.Month) time.Time {
		first := time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
		last := first.AddDate(0, 1, -1).Day()
		dd := day
		if dd > last {
			dd = last
		}
		return time.Date(first.Year(), first.Month(), dd, 0, 0, 0, 0, time.UTC)
	}
	c := occ(date.Year(), date.Month())
	if c.Before(date) {
		c = occ(date.Year(), date.Month()+1)
	}
	return c
}
