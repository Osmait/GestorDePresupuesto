package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
)

// Editing a transaction's date used to be ignored: the UPDATE never wrote
// created_at, so a bill moved to the previous month stayed in this month's
// reports. A zero CreatedAt must keep the stored date.
func TestTransactionRepository_UpdateMovesDateAndRollup(t *testing.T) {
	u := seedLedgerUser(t, testDB)
	repo := transactionRepo.NewTransactionRepository(testDB)
	ctx := context.Background()

	oct := time.Date(2026, 10, 3, 16, 0, 0, 0, time.UTC)
	sep := time.Date(2026, 9, 28, 16, 0, 0, 0, time.UTC)

	txn := transaction.NewTransaction(newID(), "super", "", "bill", u.bankDOP, u.categoryID, money.FromInt(3000))
	txn.UserId = u.id
	txn.CreatedAt = oct
	require.NoError(t, repo.Save(ctx, txn))

	storedDate := func() time.Time {
		t.Helper()
		var at time.Time
		require.NoError(t, testDB.QueryRow(`SELECT created_at FROM transactions WHERE id = $1`, txn.Id).Scan(&at))
		return at.UTC()
	}
	rollupBills := func(month string) string {
		t.Helper()
		var v string
		require.NoError(t, testDB.QueryRow(`SELECT COALESCE(SUM(amount_sum), 0)::numeric(19,2)::text FROM transaction_monthly_rollup
			WHERE user_id = $1 AND month = $2::date AND type_transation = 'bill'`, u.id, month).Scan(&v))
		return v
	}
	edit := func(at time.Time) {
		t.Helper()
		update := transaction.NewTransaction(txn.Id, "super", "", "bill", u.bankDOP, u.categoryID, money.FromInt(3000))
		update.UserId = u.id
		update.CreatedAt = at
		require.NoError(t, repo.Update(ctx, txn.Id, update))
	}

	edit(sep)
	require.True(t, storedDate().Equal(sep), "date = %s, want %s", storedDate(), sep)
	require.Equal(t, "0.00", rollupBills("2026-10-01"))
	require.Equal(t, "3000.00", rollupBills("2026-09-01"))

	edit(time.Time{})
	require.True(t, storedDate().Equal(sep), "a zero date must keep %s, got %s", sep, storedDate())
}
