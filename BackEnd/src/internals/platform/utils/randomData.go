package utils

import (
	"math/rand"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
)

func GetNewRandomUser() *user.User {
	user1 := user.NewUser(faker.UUIDDigit(), faker.Name(), faker.LastName(), faker.Email(), faker.Password())
	return user1
}

func GetNewRandomAccount() *account.Account {
	balances, _ := faker.RandomInt(1, 10000000)

	return account.NewAccount(float64(balances[0]), faker.UUIDDigit(), faker.Name(), faker.Name())
}

func GetNewRandomTransaction() *transaction.Transaction {
	trasanctionType := []string{"bill", "income"}
	balances, _ := faker.RandomInt(1, 10000000)

	return transaction.NewTransaction(faker.UUIDDigit(), faker.Name(), faker.Paragraph(), trasanctionType[rand.Intn(2)], faker.UUIDDigit(), float64(balances[0]))
}
