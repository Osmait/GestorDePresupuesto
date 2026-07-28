package postgress

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/monthly_plan"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	monthlyPlanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/monthly_plan"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

// seedPlanUser creates a user the plan items can hang off, returning its id.
func seedPlanUser(t *testing.T, ctx context.Context) string {
	t.Helper()

	repository := userRepo.NewUserRepository(testDB)
	user := utils.GetNewRandomUser()
	require.NoError(t, repository.Save(ctx, user))

	return user.Id
}

func TestMonthlyPlanRepository_CRUD(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	repository := monthlyPlanRepo.NewMonthlyPlanRepository(db)
	categoryRepository := categoryRepo.NewCategoryRepository(db)
	userID := seedPlanUser(t, ctx)

	category := utils.GetNewRandomCategory()
	category.UserId = userID
	require.NoError(t, categoryRepository.Save(ctx, category))

	day := 5
	item := monthly_plan.NewMonthlyPlanItem(
		"plan-crud-1", userID, "Internet", "Fibra óptica", 2200,
		monthly_plan.CurrencyDOP, monthly_plan.TypeBill,
		&category.Id, nil, &day, true,
	)

	// Save
	require.NoError(t, repository.Save(ctx, item))

	// FindOne returns everything we stored, including the optional fields.
	found, err := repository.FindOne(ctx, item.ID, userID)
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, "Internet", found.Name)
	assert.Equal(t, "Fibra óptica", found.Description)
	assert.Equal(t, 2200.0, found.Amount)
	assert.Equal(t, monthly_plan.CurrencyDOP, found.Currency)
	assert.Equal(t, monthly_plan.TypeBill, found.Type)
	assert.True(t, found.IsActive)
	require.NotNil(t, found.CategoryID)
	assert.Equal(t, category.Id, *found.CategoryID)
	require.NotNil(t, found.DayOfMonth)
	assert.Equal(t, 5, *found.DayOfMonth)
	assert.Nil(t, found.AccountID, "an unset account must come back as nil")
	assert.NotZero(t, found.CreatedAt)

	// Update
	found.Name = "Internet Claro"
	found.Amount = 2500
	rows, err := repository.Update(ctx, found)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	updated, err := repository.FindOne(ctx, item.ID, userID)
	require.NoError(t, err)
	assert.Equal(t, "Internet Claro", updated.Name)
	assert.Equal(t, 2500.0, updated.Amount)

	// SetActive
	rows, err = repository.SetActive(ctx, item.ID, userID, false)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	paused, err := repository.FindOne(ctx, item.ID, userID)
	require.NoError(t, err)
	assert.False(t, paused.IsActive)

	// Delete
	rows, err = repository.Delete(ctx, item.ID, userID)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rows)

	gone, err := repository.FindOne(ctx, item.ID, userID)
	require.NoError(t, err)
	assert.Nil(t, gone, "a deleted item must be reported as absent, not as an error")
}

func TestMonthlyPlanRepository_FindOneNotFound(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	repository := monthlyPlanRepo.NewMonthlyPlanRepository(db)
	userID := seedPlanUser(t, ctx)

	found, err := repository.FindOne(ctx, "does-not-exist", userID)

	assert.NoError(t, err, "a missing row is not an error")
	assert.Nil(t, found)
}

// A user must never be able to read, edit or delete another user's plan.
func TestMonthlyPlanRepository_IsScopedByUser(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	repository := monthlyPlanRepo.NewMonthlyPlanRepository(db)
	ownerID := seedPlanUser(t, ctx)
	attackerID := seedPlanUser(t, ctx)

	item := monthly_plan.NewMonthlyPlanItem(
		"plan-scope-1", ownerID, "Alquiler", "", 25000,
		monthly_plan.CurrencyDOP, monthly_plan.TypeBill, nil, nil, nil, true,
	)
	require.NoError(t, repository.Save(ctx, item))

	t.Run("FindOne", func(t *testing.T) {
		found, err := repository.FindOne(ctx, item.ID, attackerID)
		assert.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("FindAllByUser", func(t *testing.T) {
		items, err := repository.FindAllByUser(ctx, attackerID)
		assert.NoError(t, err)
		assert.Empty(t, items)
	})

	t.Run("Update", func(t *testing.T) {
		stolen := monthly_plan.NewMonthlyPlanItem(
			item.ID, attackerID, "Hacked", "", 1,
			monthly_plan.CurrencyDOP, monthly_plan.TypeBill, nil, nil, nil, true,
		)
		rows, err := repository.Update(ctx, stolen)
		assert.NoError(t, err)
		assert.Equal(t, int64(0), rows, "updating someone else's item must affect no rows")

		untouched, err := repository.FindOne(ctx, item.ID, ownerID)
		require.NoError(t, err)
		assert.Equal(t, "Alquiler", untouched.Name)
	})

	t.Run("SetActive", func(t *testing.T) {
		rows, err := repository.SetActive(ctx, item.ID, attackerID, false)
		assert.NoError(t, err)
		assert.Equal(t, int64(0), rows)
	})

	t.Run("Delete", func(t *testing.T) {
		rows, err := repository.Delete(ctx, item.ID, attackerID)
		assert.NoError(t, err)
		assert.Equal(t, int64(0), rows)

		stillThere, err := repository.FindOne(ctx, item.ID, ownerID)
		require.NoError(t, err)
		assert.NotNil(t, stillThere)
	})

	require.NoError(t, deletePlanItems(ctx, repository, ownerID))
}

// FindAllByUser must return incomes before expenses, each ordered by the day of
// the month, so the UI can render the two columns and the timeline as-is.
func TestMonthlyPlanRepository_FindAllByUserOrdering(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	repository := monthlyPlanRepo.NewMonthlyPlanRepository(db)
	userID := seedPlanUser(t, ctx)

	day1, day15, day30 := 1, 15, 30
	seed := []*monthly_plan.MonthlyPlanItem{
		monthly_plan.NewMonthlyPlanItem("ord-bill-15", userID, "Internet", "", 2200, monthly_plan.CurrencyDOP, monthly_plan.TypeBill, nil, nil, &day15, true),
		monthly_plan.NewMonthlyPlanItem("ord-income-30", userID, "Salario", "", 85000, monthly_plan.CurrencyDOP, monthly_plan.TypeIncome, nil, nil, &day30, true),
		monthly_plan.NewMonthlyPlanItem("ord-bill-1", userID, "Alquiler", "", 25000, monthly_plan.CurrencyDOP, monthly_plan.TypeBill, nil, nil, &day1, true),
		monthly_plan.NewMonthlyPlanItem("ord-income-15", userID, "Freelance", "", 12000, monthly_plan.CurrencyDOP, monthly_plan.TypeIncome, nil, nil, &day15, true),
		// No day set: must sort last inside its own group.
		monthly_plan.NewMonthlyPlanItem("ord-bill-noday", userID, "Imprevistos", "", 3000, monthly_plan.CurrencyDOP, monthly_plan.TypeBill, nil, nil, nil, true),
	}
	for _, item := range seed {
		require.NoError(t, repository.Save(ctx, item))
	}

	items, err := repository.FindAllByUser(ctx, userID)
	require.NoError(t, err)
	require.Len(t, items, 5)

	gotIDs := make([]string, 0, len(items))
	for _, item := range items {
		gotIDs = append(gotIDs, item.ID)
	}

	assert.Equal(t, []string{
		"ord-income-15",  // income, day 15
		"ord-income-30",  // income, day 30
		"ord-bill-1",     // bill, day 1
		"ord-bill-15",    // bill, day 15
		"ord-bill-noday", // bill, no day -> last
	}, gotIDs)

	require.NoError(t, deletePlanItems(ctx, repository, userID))
}

func TestMonthlyPlanRepository_Totals(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	repository := monthlyPlanRepo.NewMonthlyPlanRepository(db)
	userID := seedPlanUser(t, ctx)

	seed := []*monthly_plan.MonthlyPlanItem{
		monthly_plan.NewMonthlyPlanItem("tot-income-dop", userID, "Salario", "", 85000, monthly_plan.CurrencyDOP, monthly_plan.TypeIncome, nil, nil, nil, true),
		monthly_plan.NewMonthlyPlanItem("tot-income-usd", userID, "Freelance", "", 200, monthly_plan.CurrencyUSD, monthly_plan.TypeIncome, nil, nil, nil, true),
		monthly_plan.NewMonthlyPlanItem("tot-bill-dop", userID, "Alquiler", "", 25000, monthly_plan.CurrencyDOP, monthly_plan.TypeBill, nil, nil, nil, true),
		monthly_plan.NewMonthlyPlanItem("tot-bill-usd", userID, "Netflix", "", 15, monthly_plan.CurrencyUSD, monthly_plan.TypeBill, nil, nil, nil, true),
		// Paused rows must be excluded from every total.
		monthly_plan.NewMonthlyPlanItem("tot-bill-paused", userID, "Gym", "", 1500, monthly_plan.CurrencyDOP, monthly_plan.TypeBill, nil, nil, nil, false),
		monthly_plan.NewMonthlyPlanItem("tot-income-paused", userID, "Bono viejo", "", 9999, monthly_plan.CurrencyDOP, monthly_plan.TypeIncome, nil, nil, nil, false),
	}
	for _, item := range seed {
		require.NoError(t, repository.Save(ctx, item))
	}

	totals, err := repository.Totals(ctx, userID, 60)
	require.NoError(t, err)

	// 85000 DOP + (200 USD * 60) = 97000
	assert.Equal(t, 97000.0, totals.TotalIncome)
	// 25000 DOP + (15 USD * 60) = 25900
	assert.Equal(t, 25900.0, totals.TotalExpenses)
	assert.Equal(t, 2, totals.IncomeCount, "the paused income must not be counted")
	assert.Equal(t, 2, totals.ExpensesCount, "the paused expense must not be counted")

	require.NoError(t, deletePlanItems(ctx, repository, userID))
}

func TestMonthlyPlanRepository_TotalsOnEmptyPlan(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	repository := monthlyPlanRepo.NewMonthlyPlanRepository(db)
	userID := seedPlanUser(t, ctx)

	totals, err := repository.Totals(ctx, userID, 60)

	require.NoError(t, err)
	assert.Zero(t, totals.TotalIncome, "COALESCE must turn a NULL sum into 0")
	assert.Zero(t, totals.TotalExpenses)
	assert.Zero(t, totals.IncomeCount)
	assert.Zero(t, totals.ExpensesCount)
}

// A non-positive rate would zero out every USD row, so the repository clamps it
// to 1 and leaves the amounts unconverted instead.
func TestMonthlyPlanRepository_TotalsGuardsAgainstInvalidRate(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	repository := monthlyPlanRepo.NewMonthlyPlanRepository(db)
	userID := seedPlanUser(t, ctx)

	item := monthly_plan.NewMonthlyPlanItem(
		"rate-guard-1", userID, "Netflix", "", 15,
		monthly_plan.CurrencyUSD, monthly_plan.TypeBill, nil, nil, nil, true,
	)
	require.NoError(t, repository.Save(ctx, item))

	totals, err := repository.Totals(ctx, userID, 0)

	require.NoError(t, err)
	assert.Equal(t, 15.0, totals.TotalExpenses)

	require.NoError(t, deletePlanItems(ctx, repository, userID))
}

// deletePlanItems clears a user's plan so the shared container stays tidy.
func deletePlanItems(ctx context.Context, repository *monthlyPlanRepo.MonthlyPlanRepository, userID string) error {
	items, err := repository.FindAllByUser(ctx, userID)
	if err != nil {
		return err
	}
	for _, item := range items {
		if _, err := repository.Delete(ctx, item.ID, userID); err != nil {
			return err
		}
	}
	return nil
}
