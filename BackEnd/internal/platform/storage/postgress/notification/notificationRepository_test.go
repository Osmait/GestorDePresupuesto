package notification

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
	"github.com/osmait/gestorDePresupuesto/internal/domain/notification"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

// adminDB is the migrating superuser; appDB connects as a role that does NOT
// bypass row-level security, like a production deployment should.
var adminDB, appDB *sql.DB

func TestMain(m *testing.M) {
	ctx := context.Background()
	container, err := postgres.Run(ctx, "postgres:17-alpine",
		postgres.WithDatabase("notif"),
		postgres.WithUsername("admin"),
		postgres.WithPassword("admin"),
		testcontainers.WithWaitStrategy(wait.ForLog("database system is ready to accept connections").
			WithOccurrence(2).WithStartupTimeout(60*time.Second)),
	)
	if err != nil {
		log.Fatalf("postgres container: %v", err)
	}
	host, _ := container.Host(ctx)
	port, _ := container.MappedPort(ctx, "5432")
	dsn := func(user, pass string) string {
		return fmt.Sprintf("postgres://%s:%s@%s:%s/notif?sslmode=disable", user, pass, host, port.Port())
	}
	if err := utils.RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, dsn("admin", "admin")); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	adminDB, _ = sql.Open("postgres", dsn("admin", "admin"))
	for _, stmt := range []string{
		`CREATE ROLE app LOGIN PASSWORD 'app' NOSUPERUSER NOBYPASSRLS`,
		`GRANT USAGE ON SCHEMA public TO app`,
		`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app`,
	} {
		if _, err := adminDB.Exec(stmt); err != nil {
			log.Fatalf("%s: %v", stmt, err)
		}
	}
	appDB, _ = sql.Open("postgres", dsn("app", "app"))

	code := m.Run()
	_ = appDB.Close()
	_ = adminDB.Close()
	_ = container.Terminate(ctx)
	os.Exit(code)
}

func newUser(t *testing.T) string {
	t.Helper()
	u := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(adminDB).Save(context.Background(), u))
	return u.Id
}

// rlsTx opens a transaction scoped to userID the way RLSMiddleware does and
// returns a context carrying it.
func rlsTx(t *testing.T, userID string) (context.Context, *sql.Tx) {
	t.Helper()
	tx, err := appDB.BeginTx(context.Background(), nil)
	require.NoError(t, err)
	_, err = tx.Exec(`SELECT set_config('app.current_user_id', $1, true), set_config('app.is_admin', 'false', true)`, userID)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback() })
	return txhelper.WithTx(context.Background(), tx), tx
}

// Background saves (async budget alerts, the recurring scheduler) have no
// request transaction: they must still pass the FORCE RLS policy.
func TestSave_WithoutRequestTxPassesRLS(t *testing.T) {
	userID := newUser(t)
	repo := NewNotificationRepository(appDB)

	// What the code did before: a bare insert on the pool is rejected.
	_, err := appDB.Exec(insertNotification, uuid.New(), userID, "info", "bare", nil, false, time.Now())
	require.Error(t, err, "sanity check: RLS must be enforced for the app role")

	n := notification.Notification{ID: uuid.New(), UserID: userID, Type: "budget_warning", Message: "async", CreatedAt: time.Now()}
	require.NoError(t, repo.Save(context.Background(), n))

	var count int
	require.NoError(t, adminDB.QueryRow(`SELECT count(*) FROM notifications WHERE id = $1`, n.ID).Scan(&count))
	assert.Equal(t, 1, count)

	// A save for another user cannot be smuggled through a request tx.
	other := newUser(t)
	ctx, _ := rlsTx(t, other)
	err = repo.Save(ctx, notification.Notification{ID: uuid.New(), UserID: userID, Type: "info", Message: "x", CreatedAt: time.Now()})
	assert.Error(t, err)
}

func TestListByUserID_KeysetPagesNewestFirstWithTies(t *testing.T) {
	userID := newUser(t)
	other := newUser(t)
	base := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC)
	insert := func(user string, at time.Time) {
		_, err := adminDB.Exec(insertNotification, uuid.New(), user, "info", "m", nil, false, at)
		require.NoError(t, err)
	}
	for i := range 9 {
		insert(userID, base.Add(time.Duration(i/3)*time.Second)) // groups of 3 identical timestamps
	}
	insert(other, base.Add(time.Hour))

	ctx, _ := rlsTx(t, userID)
	repo := NewNotificationRepository(appDB)
	all, err := repo.GetByUserID(ctx, userID)
	require.NoError(t, err)
	require.Len(t, all, 9)

	var walked []notification.Notification
	var after *notification.HistoryCursor
	for range 10 {
		page, err := repo.ListByUserID(ctx, userID, after, 2)
		require.NoError(t, err)
		require.NotNil(t, page)
		if len(page) == 0 {
			break
		}
		walked = append(walked, page...)
		last := page[len(page)-1]
		after = &notification.HistoryCursor{CreatedAt: last.CreatedAt, ID: last.ID}
	}
	require.Len(t, walked, 9)
	for i := range all {
		assert.Equal(t, all[i].ID, walked[i].ID, "position %d", i)
		if i > 0 {
			prev, cur := walked[i-1], walked[i]
			assert.True(t, cur.CreatedAt.Before(prev.CreatedAt) ||
				(cur.CreatedAt.Equal(prev.CreatedAt) && cur.ID.String() < prev.ID.String()))
		}
	}

	// The other user sees only their own row, even when asking for userID.
	otherCtx, _ := rlsTx(t, other)
	leaked, err := repo.ListByUserID(otherCtx, userID, nil, 50)
	require.NoError(t, err)
	assert.Empty(t, leaked)
	assert.NotNil(t, leaked)

	var hasIndex bool
	require.NoError(t, adminDB.QueryRow(`SELECT EXISTS (SELECT 1 FROM pg_indexes
		WHERE tablename = 'notifications' AND indexname = 'idx_notifications_user_created_id')`).Scan(&hasIndex))
	assert.True(t, hasIndex)
}
