package utils

import (
	"math/rand"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
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

func GetNewRandomInvestment() *investment.Investment {
	prices, _ := faker.RandomInt(1, 100000)
	currentPrices, _ := faker.RandomInt(1, 100000)
	quantities, _ := faker.RandomInt(1, 1000)

	return investment.NewInvestment(
		faker.UUIDDigit(),
		faker.UUIDDigit(),
		investment.Stock,
		faker.Name(),
		"SYM",
		float64(quantities[0]),
		float64(prices[0]),
		float64(currentPrices[0]),
	)
}
