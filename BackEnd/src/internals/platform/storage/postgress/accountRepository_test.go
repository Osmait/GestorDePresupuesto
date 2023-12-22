package postgress

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"github.com/stretchr/testify/assert"
)

func TestAccountRepository(t *testing.T) {
	db := setUp()
	ctx := context.Background()
	userRepo := NewUserRespository(db)
	user := utils.GetNewRandomUser()
	err := userRepo.Save(ctx, user)
	assert.NoError(t, err)
	accountRepo := NewAccountRepository(db)
	account := utils.GetNewRandomAccount()
	account.UserId = user.Id

	err = accountRepo.Save(ctx, account)
	assert.NoError(t, err)

	listofAccout, err := accountRepo.FindAll(ctx, user.Id)
	assert.NoError(t, err)
	assert.Equal(t, account.Id, listofAccout[len(listofAccout)-1].Id)

	balance, err := accountRepo.Balance(ctx, account.Id)
	assert.NoError(t, err)
	assert.Equal(t, 0.0, balance)

	err = accountRepo.Delete(ctx, account.Id)
	assert.NoError(t, err)

	novalue, err := accountRepo.FindAll(ctx, account.UserId)
	assert.NoError(t, err)
	assert.Empty(t, novalue)

	err = userRepo.Delete(ctx, user.Id)
	assert.NoError(t, err)
}
