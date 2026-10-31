package postgress

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
)

// The include_summary numbers computed in SQL (SummarizeWithFilters +
// CalculateSummaryFromGroups) are exactly those of the previous in-memory
// computation (every matching row loaded, CalculateSummary), for a seeded
// dataset with mixed types, currencies (including NULL), categories and
// fractional amounts, under several filters.
func TestSummarizeWithFilters_MatchesInMemorySummary(t *testing.T) {
	t.Parallel()
	db := SetUpTest()
	ctx := context.Background()
	loc, err := time.LoadLocation("America/Santo_Domingo")
	require.NoError(t, err)

	userID, otherUser := ksuid.New().String(), ksuid.New().String()
	accounts := []string{ksuid.New().String(), ksuid.New().String()}
	categories := []string{ksuid.New().String(), ksuid.New().String(), ksuid.New().String()}

	mustExec := func(q string, args ...any) {
		t.Helper()
		_, err := db.ExecContext(ctx, q, args...)
		require.NoError(t, err)
	}
	for _, u := range []string{userID, otherUser} {
		mustExec(`INSERT INTO users (id, name, last_name, email, password) VALUES ($1, 'S', 'Q', $2, 'x')`, u, u+"@summary.test")
	}
	for _, a := range accounts {
		mustExec(`INSERT INTO account (id, name_account, bank, user_id) VALUES ($1, 'a', 'b', $2)`, a, userID)
	}
	for _, c := range categories {
		mustExec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1, 'c', 'i', '#000', $2)`, c, userID)
	}
	otherAccount, otherCategory := ksuid.New().String(), ksuid.New().String()
	mustExec(`INSERT INTO account (id, name_account, bank, user_id) VALUES ($1, 'a', 'b', $2)`, otherAccount, otherUser)
	mustExec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1, 'c', 'i', '#000', $2)`, otherCategory, otherUser)

	base := time.Date(2026, 9, 25, 10, 0, 0, 0, loc)
	types := []string{"income", "bill", "bill"}
	for i := 0; i < 240; i++ {
		var currency any
		switch i % 5 {
		case 0, 1:
			currency = "DOP"
		case 2, 3:
			currency = "USD"
		default:
			currency = nil // legacy rows without currency count as DOP
		}
		amount := money.MustParse(fmt.Sprintf("%d.%02d", 1+(i*7919)%900, (i*37)%100))
		name := "Supermercado"
		if i%4 == 0 {
			name = "Gasolina"
		}
		mustExec(`INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation, account_id, user_id, category_id, currency, created_at)
			VALUES ($1, $2, 'seed', $3, $4, $5, $6, $7, $8, $9)`,
			ksuid.New().String(), name, amount, types[i%3], accounts[i%2], userID, categories[i%3], currency,
			base.Add(time.Duration(i)*5*time.Hour))
	}
	// Another user's rows never count.
	mustExec(`INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation, account_id, user_id, category_id, currency, created_at)
		VALUES ($1, 'Supermercado', '', 99999, 'bill', $2, $3, $4, 'DOP', $5)`, ksuid.New().String(), otherAccount, otherUser, otherCategory, base)

	repo := transactionRepo.NewTransactionRepository(db)
	rate := money.MustParse("60.4321")
	october := dto.NewTransactionFilter()
	october.CalculatedDateFrom = time.Date(2026, 10, 1, 0, 0, 0, 0, loc)
	october.CalculatedDateTo = time.Date(2026, 11, 1, 0, 0, 0, 0, loc)

	filters := map[string]func() *dto.TransactionFilter{
		"all":     dto.NewTransactionFilter,
		"october": func() *dto.TransactionFilter { f := *october; return &f },
		"bills of one account": func() *dto.TransactionFilter {
			f := dto.NewTransactionFilter()
			f.Type, f.AccountId = "bill", accounts[1]
			return f
		},
		"search and category": func() *dto.TransactionFilter {
			f := dto.NewTransactionFilter()
			f.Search, f.CategoryId = "gasol", categories[0]
			return f
		},
		"paginated page is ignored": func() *dto.TransactionFilter {
			f := *october
			f.Limit, f.Offset = 10, 20
			return &f
		},
		"no match": func() *dto.TransactionFilter {
			f := dto.NewTransactionFilter()
			f.Search = "nothing-matches-this"
			return f
		},
	}

	for name, newFilter := range filters {
		t.Run(name, func(t *testing.T) {
			filter := newFilter()
			count, err := repo.CountWithFilters(ctx, userID, filter)
			require.NoError(t, err)

			// Before: every matching row, summarized in memory.
			all := *filter
			all.Limit, all.Offset = 0, 0
			rows, err := repo.FindAllOfAllAccountsWithFilters(ctx, userID, &all)
			require.NoError(t, err)
			responses := make([]*dto.TransactionResponse, 0, len(rows))
			for _, r := range rows {
				responses = append(responses, dto.NewTransactionResponse(r.Id, r.Name, r.Description, r.TypeTransation,
					r.AccountId, r.CategoryId, r.Amount, r.Currency, r.CreatedAt))
			}
			want := dto.CalculateSummary(responses, count, rate)

			// Now: aggregated in SQL.
			groups, err := repo.SummarizeWithFilters(ctx, userID, filter)
			require.NoError(t, err)
			got := dto.CalculateSummaryFromGroups(groups, count, rate)

			wantJSON, err := json.Marshal(want)
			require.NoError(t, err)
			gotJSON, err := json.Marshal(got)
			require.NoError(t, err)
			require.JSONEq(t, string(wantJSON), string(gotJSON))
			if name != "no match" {
				require.NotZero(t, want.IncomeCount+want.ExpenseCount, "the filter must match rows")
			}
		})
	}
}
