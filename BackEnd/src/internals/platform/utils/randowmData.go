package utils

import (
	"math/rand"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
)

func GetNewUser() *user.User {
	user1 := user.NewUser(faker.ID, faker.Name(), faker.LastName(), faker.Email(), faker.Password())
	return user1
}

func GetNewRandomAccount() *account.Account {
	balances, _ := faker.RandomInt(1, 10000000)

	return account.NewAccount(float64(balances[0]), faker.ID, faker.Name(), faker.Name())
}

func GetNewRandomTransaction() *transaction.Transaction {
	trasanctionType := []string{"bill", "income"}
	balances, _ := faker.RandomInt(1, 10000000)

	return transaction.NewTransaction(faker.ID, faker.Name(), faker.Paragraph(), trasanctionType[rand.Intn(2)], faker.ID, float64(balances[0]))
}
