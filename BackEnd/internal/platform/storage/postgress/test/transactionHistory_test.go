package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/require"

	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
)

// FindCategorizedHistory (category suggestions) returns only the user's own
// categorized rows since the cut-off, newest first, at most limit of them.
func TestFindCategorizedHistory_IsBoundedAndScoped(t *testing.T) {
	t.Parallel()
	db := SetUpTest()
	ctx := context.Background()

	userID, otherUser := ksuid.New().String(), ksuid.New().String()
	accountID, categoryID := ksuid.New().String(), ksuid.New().String()
	otherAccount, otherCategory := ksuid.New().String(), ksuid.New().String()
	exec := func(q string, args ...any) {
		t.Helper()
		_, err := db.ExecContext(ctx, q, args...)
		require.NoError(t, err)
	}
	for _, u := range []string{userID, otherUser} {
		exec(`INSERT INTO users (id, name, last_name, email, password) VALUES ($1, 'H', 'S', $2, 'x')`, u, u+"@history.test")
	}
	exec(`INSERT INTO account (id, name_account, bank, user_id) VALUES ($1, 'a', 'b', $2)`, accountID, userID)
	exec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1, 'c', 'i', '#000', $2)`, categoryID, userID)
	exec(`INSERT INTO account (id, name_account, bank, user_id) VALUES ($1, 'a', 'b', $2)`, otherAccount, otherUser)
	exec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1, 'c', 'i', '#000', $2)`, otherCategory, otherUser)

	now := time.Now()
	insert := func(user, account, cat string, at time.Time) string {
		id := ksuid.New().String()
		exec(`INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation, account_id, user_id, category_id, currency, created_at)
			VALUES ($1, 'n', '', 10, 'bill', $2, $3, $4, 'DOP', $5)`, id, account, user, cat, at)
		return id
	}
	var recent []string
	for i := 0; i < 5; i++ {
		recent = append(recent, insert(userID, accountID, categoryID, now.Add(-time.Duration(i)*24*time.Hour)))
	}
	insert(userID, accountID, categoryID, now.AddDate(-2, 0, 0)) // too old
	insert(otherUser, otherAccount, otherCategory, now)          // someone else's

	repo := transactionRepo.NewTransactionRepository(db)
	got, err := repo.FindCategorizedHistory(ctx, userID, now.AddDate(-1, 0, 0), 3)
	require.NoError(t, err)
	require.Len(t, got, 3)
	for i, tx := range got {
		require.Equal(t, recent[i], tx.Id, "newest first")
		require.Equal(t, categoryID, tx.CategoryId)
	}

	all, err := repo.FindCategorizedHistory(ctx, userID, now.AddDate(-1, 0, 0), 100)
	require.NoError(t, err)
	require.Len(t, all, 5, "older rows and other users' rows are excluded")
}
