package postgress

import (
	"context"
	"testing"
	"time"

	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	postgress "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"

	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"

	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
)

func TestTransactionRepository(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	transactionRepo := postgress.NewTransactionRepository(db)
	accountRepo := accountRepo.NewAccountRepository(db)
	userRepo := userRepo.NewUserRepository(db)
	categoryRepo := categoryRepo.NewCategoryRepository(db)
	transaction := utils.GetNewRandomTransaction()
	account := utils.GetNewRandomAccount()
	user := utils.GetNewRandomUser()
	category := utils.GetNewRandomCategory()
	category.UserId = user.Id

	transaction.AccountId = account.Id
	transaction.UserId = user.Id
	transaction.CategoryId = category.Id
	account.UserId = user.Id
	transaction.CreatedAt = time.Now() // Ensure transaction is within query range
	err := categoryRepo.Save(ctx, category)
	assert.NoError(t, err)
	err = userRepo.Save(ctx, user)
	assert.NoError(t, err)
	err = accountRepo.Save(ctx, account)
	assert.NoError(t, err)
	err = transactionRepo.Save(ctx, transaction)
	assert.NoError(t, err)

	currentTime := time.Now()
	date1 := currentTime.AddDate(0, 0, -7).Format("2006-01-02")
	date2 := currentTime.AddDate(0, 0, 5).Format("2006-01-02")
	transactionList, err := transactionRepo.FindAll(ctx, date1, date2, account.Id)
	assert.NoError(t, err)
	assert.NotEmpty(t, transactionList)

	err = transactionRepo.Delete(ctx, transaction.Id, user.Id)
	assert.NoError(t, err)

	err = accountRepo.Delete(ctx, account.Id, user.Id)
	assert.NoError(t, err)

	err = userRepo.Delete(ctx, user.Id)
	assert.NoError(t, err)

	err = categoryRepo.Delete(ctx, category.Id, user.Id)
	assert.NoError(t, err)
}
