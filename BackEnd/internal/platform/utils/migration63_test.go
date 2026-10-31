package utils

import (
	"database/sql"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
)

// Migration 000063 adds session_started_at to refresh_tokens (backfilled with
// the created_at of the first token of each rotation chain) and to
// mcp_oauth_tokens (backfilled with created_at); the down migration drops it.
func TestMigration63_BackfillsRefreshSessionStart(t *testing.T) {
	dbURL := freshDatabase(t)
	if err := RunMigrationsFromFS(embeddedUpTo(t, 63), "m", dbURL); err != nil {
		t.Fatalf("apply migrations < 63: %v", err)
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

	login := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	other := time.Date(2026, 10, 20, 8, 0, 0, 0, time.UTC)
	mustExec(`INSERT INTO users (id, name, last_name, email, password) VALUES ('u63','U','63','u63@example.com','x')`)
	// A chain of three rotations from the September login, and an
	// unrelated session started in October.
	mustExec(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at, replaced_by) VALUES
		('t1', 'u63', 'h1', $1::timestamptz + interval '7 days', $1, $1::timestamptz + interval '1 day', 't2'),
		('t2', 'u63', 'h2', $1::timestamptz + interval '8 days', $1::timestamptz + interval '1 day', $1::timestamptz + interval '2 days', 't3'),
		('t3', 'u63', 'h3', $1::timestamptz + interval '9 days', $1::timestamptz + interval '2 days', NULL, NULL),
		('o1', 'u63', 'h4', $2::timestamptz + interval '7 days', $2, NULL, NULL)`, login, other)
	mustExec(`INSERT INTO mcp_oauth_clients (client_id, redirect_uris) VALUES ('c63', '["https://claude.ai/cb"]')`)
	mustExec(`INSERT INTO mcp_oauth_tokens (access_token_hash, client_id, user_id, subject, expires_at, purge_after, created_at)
		VALUES (repeat('a', 64), 'c63', 'u63', 'u63', $1::timestamptz + interval '1 hour', $1::timestamptz + interval '30 days', $1)`, other)

	if err := RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, dbURL); err != nil {
		t.Fatalf("apply remaining migrations: %v", err)
	}

	for id, want := range map[string]time.Time{"t1": login, "t2": login, "t3": login, "o1": other} {
		var got time.Time
		if err := db.QueryRow(`SELECT session_started_at FROM refresh_tokens WHERE id = $1`, id).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if !got.Equal(want) {
			t.Errorf("refresh token %s: session_started_at = %s, want %s", id, got, want)
		}
	}
	var mcpStart time.Time
	if err := db.QueryRow(`SELECT session_started_at FROM mcp_oauth_tokens WHERE client_id = 'c63'`).Scan(&mcpStart); err != nil {
		t.Fatal(err)
	}
	if !mcpStart.Equal(other) {
		t.Errorf("mcp token session_started_at = %s, want %s", mcpStart, other)
	}
	// New rows default to now().
	mustExec(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ('n1', 'u63', 'h5', now() + interval '1 day')`)

	src, err := iofs.New(migrationsdb.Migrations, migrationsdb.MigrationsDir)
	if err != nil {
		t.Fatal(err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = m.Close() }()
	if err := m.Migrate(62); err != nil {
		t.Fatalf("migrate down to 62: %v", err)
	}
	var columns int
	if err := db.QueryRow(`SELECT count(*) FROM information_schema.columns WHERE column_name = 'session_started_at'`).Scan(&columns); err != nil {
		t.Fatal(err)
	}
	if columns != 0 {
		t.Errorf("session_started_at still exists in %d tables after down", columns)
	}
}
