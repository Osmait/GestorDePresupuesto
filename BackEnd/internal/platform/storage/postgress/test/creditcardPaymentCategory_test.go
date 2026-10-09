package postgress

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

func TestCreditCardRepository_EnsurePaymentCategory(t *testing.T) {
	ctx := context.Background()
	db := SetUpTest()
	repo := creditcardRepo.NewCreditCardRepository(db)

	t.Run("creates one dedicated category per user, not the oldest one", func(t *testing.T) {
		user := utils.GetNewRandomUser()
		require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))

		oldest := category.NewCategory(newID(), "Supermercado", "🛒", "#123456")
		oldest.UserId = user.Id
		require.NoError(t, categoryRepo.NewCategoryRepository(db).Save(ctx, oldest))

		id, err := repo.EnsurePaymentCategory(ctx, user.Id)
		require.NoError(t, err)
		assert.Equal(t, creditcardRepo.PaymentCategoryID(user.Id), id)
		assert.NotEqual(t, oldest.Id, id)

		var name, owner string
		require.NoError(t, db.QueryRowContext(ctx, "SELECT name, user_id FROM categorys WHERE id = $1", id).Scan(&name, &owner))
		assert.Equal(t, creditcardRepo.PaymentCategoryName, name)
		assert.Equal(t, user.Id, owner)

		again, err := repo.EnsurePaymentCategory(ctx, user.Id)
		require.NoError(t, err)
		assert.Equal(t, id, again)

		var count int
		require.NoError(t, db.QueryRowContext(ctx, "SELECT COUNT(*) FROM categorys WHERE user_id = $1 AND name = $2", user.Id, creditcardRepo.PaymentCategoryName).Scan(&count))
		assert.Equal(t, 1, count)
	})

	t.Run("reuses an existing category with the same name", func(t *testing.T) {
		user := utils.GetNewRandomUser()
		require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))

		existing := category.NewCategory(newID(), "pago de tarjeta", "💳", "#000000")
		existing.UserId = user.Id
		require.NoError(t, categoryRepo.NewCategoryRepository(db).Save(ctx, existing))

		id, err := repo.EnsurePaymentCategory(ctx, user.Id)
		require.NoError(t, err)
		assert.Equal(t, existing.Id, id)
	})
}
