package utils

import (
	"database/sql"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
)

// Migration 000062 buckets transaction_monthly_rollup by the calendar month in
// app_timezone() (America/Santo_Domingo) instead of UTC and rebuilds it. A
// bill paid on Oct 31 at 21:30 local (Nov 1 01:30 UTC) moves from November to
// October; the down migration moves it back.
func TestMigration62_RollupBucketsByAppTimezone(t *testing.T) {
	dbURL := freshDatabase(t)
	if err := RunMigrationsFromFS(embeddedUpTo(t, 62), "m", dbURL); err != nil {
		t.Fatalf("apply migrations < 62: %v", err)
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

	mustExec(`INSERT INTO users (id, name, last_name, email, password) VALUES ('u62','U','62','u62@example.com','x')`)
	mustExec(`INSERT INTO account (id, name_account, bank, balance, user_id) VALUES ('a62','Principal','B',0,'u62')`)
	mustExec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ('c62','Comida','i','#fff','u62')`)
	mustExec(`INSERT INTO transactions (id, transaction_name, amount, type_transation, account_id, user_id, category_id, currency, created_at) VALUES
		('oct31', 'late october bill', 100, 'bill', 'a62', 'u62', 'c62', 'DOP', '2026-10-31T21:30:00-04:00'),
		('sep30', 'late september bill', 7, 'bill', 'a62', 'u62', 'c62', 'DOP', '2026-09-30T23:30:00-04:00')`)

	// month -> "amount_sum/tx_count" of the user's bills
	rollup := func() map[string]string {
		t.Helper()
		rows, err := db.Query(`SELECT month::text, amount_sum::numeric(19,2)::text || '/' || tx_count FROM transaction_monthly_rollup WHERE user_id = 'u62' AND type_transation = 'bill'`)
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = rows.Close() }()
		got := map[string]string{}
		for rows.Next() {
			var month, v string
			if err := rows.Scan(&month, &v); err != nil {
				t.Fatal(err)
			}
			got[month] = v
		}
		return got
	}
	expect := func(stage string, want map[string]string) {
		t.Helper()
		got := rollup()
		if len(got) != len(want) {
			t.Fatalf("%s: rollup = %v, want %v", stage, got, want)
		}
		for k, v := range want {
			if got[k] != v {
				t.Errorf("%s: rollup[%s] = %q, want %q (all: %v)", stage, k, got[k], v, got)
			}
		}
	}

	// 000054: UTC months
	expect("before 62", map[string]string{"2026-11-01": "100.00/1", "2026-10-01": "7.00/1"})

	if err := RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, dbURL); err != nil {
		t.Fatalf("apply remaining migrations: %v", err)
	}

	var tz string
	if err := db.QueryRow(`SELECT app_timezone()`).Scan(&tz); err != nil {
		t.Fatal(err)
	}
	if tz != "America/Santo_Domingo" {
		t.Errorf("app_timezone() = %q", tz)
	}

	expect("after 62", map[string]string{"2026-10-01": "100.00/1", "2026-09-01": "7.00/1"})

	// the trigger buckets new writes in local months too
	mustExec(`INSERT INTO transactions (id, transaction_name, amount, type_transation, account_id, user_id, category_id, currency, created_at) VALUES
		('nov1', 'early november bill', 5, 'bill', 'a62', 'u62', 'c62', 'DOP', '2026-11-01T00:30:00-04:00')`)
	expect("after insert", map[string]string{"2026-11-01": "5.00/1", "2026-10-01": "100.00/1", "2026-09-01": "7.00/1"})
	// moved to 21:00 local on Oct 31 (Nov 1 in UTC): still October
	mustExec(`UPDATE transactions SET created_at = '2026-10-31T21:00:00-04:00' WHERE id = 'nov1'`)
	expect("after update", map[string]string{"2026-10-01": "105.00/2", "2026-09-01": "7.00/1"})
	mustExec(`DELETE FROM transactions WHERE id = 'nov1'`)
	expect("after delete", map[string]string{"2026-10-01": "100.00/1", "2026-09-01": "7.00/1"})

	// Down: back to UTC months, app_timezone() is gone.
	src, err := iofs.New(migrationsdb.Migrations, migrationsdb.MigrationsDir)
	if err != nil {
		t.Fatal(err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = m.Close() }()
	if err := m.Migrate(61); err != nil {
		t.Fatalf("migrate down to 61: %v", err)
	}
	expect("after down", map[string]string{"2026-11-01": "100.00/1", "2026-10-01": "7.00/1"})
	var exists bool
	if err := db.QueryRow(`SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_timezone')`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Error("app_timezone() still exists after down")
	}
	mustExec(`INSERT INTO transactions (id, transaction_name, amount, type_transation, account_id, user_id, category_id, currency, created_at) VALUES
		('nov1b', 'early november bill', 5, 'bill', 'a62', 'u62', 'c62', 'DOP', '2026-10-31T21:00:00-04:00')`)
	expect("insert after down", map[string]string{"2026-11-01": "105.00/2", "2026-10-01": "7.00/1"})
}
