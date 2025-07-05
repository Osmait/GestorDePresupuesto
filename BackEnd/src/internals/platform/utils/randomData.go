package utils

import (
	"math/rand"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/budget"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/category"
	"github.com/osmait/gestorDePresupuesto/src/internals/domain/invesment"
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

	return transaction.NewTransaction(
		faker.UUIDDigit(),
		faker.Name(),
		faker.Paragraph(),
		trasanctionType[rand.Intn(2)],
		faker.UUIDDigit(),
		faker.UUIDDigit(),
		float64(balances[0]))
}

func GetNewRandomCategory() *category.Category {
	return category.NewCategory(faker.UUIDDigit(), faker.Name(), faker.Name(), faker.Name())
}

func GetNewRandomBudget() *budget.Budget {
	balances, _ := faker.RandomInt(1, 10000000)
	return budget.NewBudget(faker.UUIDDigit(), faker.UUIDDigit(), faker.UUIDDigit(),
		float64(balances[0]))
}

func GetNewRandomInvestment() *invesment.Invesment {
	prices, _ := faker.RandomInt(1, 100000)
	currentPrices, _ := faker.RandomInt(1, 100000)
	quantities, _ := faker.RandomInt(1, 1000)

	return invesment.NewInvesment(
		faker.UUIDDigit(),
		faker.Name(),
		float64(prices[0]),
		float64(currentPrices[0]),
		float64(quantities[0]),
		faker.UUIDDigit(),
	)
}
