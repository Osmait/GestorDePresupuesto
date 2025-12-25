package postgress

import (
	"context"
	"testing"

	postgress "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"
)

func TestUserRespo(t *testing.T) {
	db := SetUpTest()
	repo := postgress.NewUserRepository(db)
	ctx := context.Background()
	user := utils.GetNewRandomUser()
	err := repo.Save(ctx, user)
	assert.NoError(t, err)

	userDb, err := repo.FindUserById(ctx, user.Id)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, userDb.Id, user.Id)
	assert.NoError(t, err)
	err = repo.Delete(ctx, user.Id)
	assert.NoError(t, err)
	nouser, err := repo.FindUserById(ctx, user.Id)
	assert.Error(t, err)
	assert.Nil(t, nouser)
}
