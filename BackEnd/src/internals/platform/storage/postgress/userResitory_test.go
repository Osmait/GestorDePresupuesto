package postgress

import (
	"context"
	"testing"

	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"github.com/stretchr/testify/assert"
)

func TestUserRespo(t *testing.T) {
	db := setUp()
	repo := NewUserRespository(db)
	ctx := context.Background()
	user := utils.GetNewRandomUser()
	err := repo.CreateUser(ctx, user)
	assert.NoError(t, err)

	userDb, err := repo.FindUser(ctx, user.Id)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, userDb.Id, user.Id)
	assert.NoError(t, err)
	err = repo.Delete(ctx, user.Id)
	assert.NoError(t, err)
	nouser, err := repo.FindUser(ctx, user.Id)
	assert.NoError(t, err)
	assert.Equal(t, nouser.Id, "")
}
