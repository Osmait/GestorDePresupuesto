package utils

import (
	"math/rand"
	"time"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/monthly_plan"
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

// GetNewRandomMonthlyPlanItem builds a random active fixed expense in DOP with
// no category, account or day set. Tests override whatever they care about.
func GetNewRandomMonthlyPlanItem() *monthly_plan.MonthlyPlanItem {
	amounts, _ := faker.RandomInt(1, 100000)
	return monthly_plan.NewMonthlyPlanItem(
		faker.UUIDDigit(),
		faker.UUIDDigit(),
		faker.Name(),
		faker.Sentence(),
		float64(amounts[0]),
		monthly_plan.CurrencyDOP,
		monthly_plan.TypeBill,
		nil,
		nil,
		nil,
		true,
	)
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

func GetNewRandomCertificate(userId string) *certificate.Certificate {
	capitals, _ := faker.RandomInt(1000, 1000000)
	rates, _ := faker.RandomInt(1, 20)
	taxRates, _ := faker.RandomInt(5, 15)
	cutDays, _ := faker.RandomInt(1, 28)

	interestTypes := []certificate.InterestType{certificate.InterestTypeSimple, certificate.InterestTypeCompound}

	cert := certificate.NewCertificate(
		faker.UUIDDigit(),
		userId,
		faker.Name(),
		float64(capitals[0]),
		interestTypes[rand.Intn(2)],
		float64(rates[0]),
		float64(taxRates[0]),
		cutDays[0],
	)

	return cert
}

func GetNewRandomCertificatePayment(certificateId, userId string) *certificate.CertificatePayment {
	capitals, _ := faker.RandomInt(1000, 1000000)
	rates, _ := faker.RandomInt(1, 20)
	taxRates, _ := faker.RandomInt(5, 15)
	grossInterests, _ := faker.RandomInt(100, 10000)

	gross := float64(grossInterests[0])
	tax := gross * float64(taxRates[0]) / 100
	net := gross - tax

	now := time.Now()
	periodStart := now.AddDate(0, -1, 0)

	payment := certificate.NewCertificatePayment(
		faker.UUIDDigit(),
		certificateId,
		userId,
		now,
		periodStart,
		now,
		gross,
		tax,
		net,
		float64(rates[0]),
		float64(taxRates[0]),
		float64(capitals[0]),
	)

	return payment
}
