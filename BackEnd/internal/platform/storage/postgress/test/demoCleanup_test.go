package postgress

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

// A demo user who used the app (loan with a payment, certificate, savings
// goal, AI reconciliation session) is deleted by the cleanup. The production
// worker failed on loans_source_account_id_fkey (RESTRICT) and kept every
// expired demo user.
func TestDemoCleanup_DeletesUsersWithBlockingRows(t *testing.T) {
	ctx := context.Background()
	repo := userRepo.NewUserRepository(testDB)
	demo := utils.GetNewRandomUser()
	demo.IsDemo = true
	require.NoError(t, repo.Save(ctx, demo))
	keep := utils.GetNewRandomUser()
	keep.IsDemo = true
	require.NoError(t, repo.Save(ctx, keep)) // recent: must survive

	exec := func(q string, args ...any) {
		t.Helper()
		_, err := testDB.Exec(q, args...)
		require.NoError(t, err, q)
	}
	acc, loan := newID(), newID()
	exec(`INSERT INTO account (id, name_account, bank, balance, user_id) VALUES ($1, 'Demo', 'B', 1000, $2)`, acc, demo.Id)
	exec(`INSERT INTO loans (id, user_id, borrower_name, principal_amount, interest_mode, term_months, start_date, source_account_id, total_amount)
		VALUES ($1, $2, 'Ana', 500, 'none', 2, CURRENT_DATE, $3, 500)`, loan, demo.Id, acc)
	exec(`INSERT INTO loan_payments (id, loan_id, destination_account_id, amount, payment_date) VALUES ($1, $2, $3, 100, now())`, newID(), loan, acc)
	exec(`INSERT INTO certificates (id, user_id, bank, base_capital, current_interest_rate, cut_day) VALUES ($1, $2, 'B', 1000, 5, 10)`, newID(), demo.Id)
	exec(`INSERT INTO savings_goals (id, user_id, account_id, name, target_amount) VALUES ($1, $2, $3, 'Viaje', 5000)`, newID(), demo.Id, acc)
	exec(`INSERT INTO reconciliation_sessions (id, user_id, account_id, document_type) VALUES ($1, $2, $3, 'pdf')`, newID(), demo.Id, acc)
	exec(`UPDATE users SET created_at = now() - interval '48 hours' WHERE id = $1`, demo.Id)

	require.NoError(t, repo.DeleteDemoUsersOlderThan(ctx, time.Now().Add(-24*time.Hour)))

	var left, kept int
	require.NoError(t, testDB.QueryRow(`SELECT (SELECT count(*) FROM users WHERE id = $1) + (SELECT count(*) FROM account WHERE user_id = $1)
		+ (SELECT count(*) FROM loans WHERE user_id = $1)`, demo.Id).Scan(&left))
	assert.Zero(t, left, "the expired demo user and its rows are gone")
	require.NoError(t, testDB.QueryRow(`SELECT count(*) FROM users WHERE id = $1`, keep.Id).Scan(&kept))
	assert.Equal(t, 1, kept, "a recent demo user is kept")
}

// Every foreign key to users or account that would block deleting a demo
// user (no ON DELETE CASCADE / SET NULL) belongs to a table the cleanup
// empties first, or to a table that cascades from one of them.
func TestDemoCleanup_CoversBlockingForeignKeys(t *testing.T) {
	rows, err := testDB.Query(`
		SELECT DISTINCT c.conrelid::regclass::text
		FROM pg_constraint c
		WHERE c.contype = 'f'
		  AND c.confrelid IN ('users'::regclass, 'account'::regclass)
		  AND c.confdeltype NOT IN ('c', 'n')
		  AND c.conrelid NOT IN ('users'::regclass)
		  AND NOT EXISTS (
		      SELECT 1 FROM pg_constraint p
		      WHERE p.contype = 'f' AND p.conrelid = c.conrelid AND p.confdeltype = 'c'
		        AND p.confrelid::regclass::text = ANY($1))`, cleanupParents())
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()
	var missing []string
	for rows.Next() {
		var table string
		require.NoError(t, rows.Scan(&table))
		if !slices.Contains(userRepo.DemoCleanupTables, table) {
			missing = append(missing, table)
		}
	}
	require.NoError(t, rows.Err())
	assert.Empty(t, missing, "add these tables to DemoCleanupTables (before account)")
}

// cleanupParents are the tables emptied before account: a row cascading from
// one of them is gone before the accounts are deleted.
func cleanupParents() []string {
	i := slices.Index(userRepo.DemoCleanupTables, "account")
	return userRepo.DemoCleanupTables[:i]
}
