package postgress

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"github.com/stretchr/testify/assert"
)

func TestTransactionRepository(t *testing.T) {
	db := setUp()
	ctx := context.Background()
	transactionRepo := NewTransactionRepository(db)
	accountRepo := NewAccountRepository(db)
	userRepo := NewUserRespository(db)
	transaction := utils.GetNewRandomTransaction()
	account := utils.GetNewRandomAccount()
	user := utils.GetNewRandomUser()

	transaction.Account_id = account.Id
	transaction.User_id = user.Id
	account.UserId = user.Id
	err := userRepo.Save(ctx, user)
	assert.NoError(t, err)
	err = accountRepo.Save(ctx, account)
	assert.NoError(t, err)
	err = transactionRepo.Save(ctx, transaction)
	assert.NoError(t, err)

	currenTime := time.Now()
	date1 := fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()-7)
	date2 := fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()+1)
	transactionList, err := transactionRepo.FindAll(ctx, date1, date2, account.Id)
	assert.NoError(t, err)
	assert.NotEmpty(t, transactionList)

	err = transactionRepo.Delete(ctx, transaction.Id)
	assert.NoError(t, err)

	err = accountRepo.Delete(ctx, account.Id)
	assert.NoError(t, err)

	err = userRepo.Delete(ctx, user.Id)
	assert.NoError(t, err)
}
