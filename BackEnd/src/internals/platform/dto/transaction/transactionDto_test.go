package dto

import (
	"testing"

	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"

	"github.com/stretchr/testify/assert"
)

func TestTransactionRequest(t *testing.T) {
	transaction := utils.GetNewRandomTransaction()
	transactionRequest := NewTransactionRequest(transaction.Name, transaction.Description, transaction.TypeTransation, transaction.AccountId, transaction.CategoryId, transaction.BudgetId, transaction.Amount)
	assert.Equal(t, transaction.Name, transactionRequest.Name)
	assert.Equal(t, transaction.Description, transactionRequest.Description)
	assert.Equal(t, transaction.TypeTransation, transactionRequest.TypeTransation)
	assert.Equal(t, transaction.AccountId, transactionRequest.AccountId)
	assert.Equal(t, transaction.Amount, transactionRequest.Amount)
	assert.Equal(t, transaction.BudgetId, transactionRequest.BudgetId)
}

func TestTransactionResponse(t *testing.T) {
	transaction := utils.GetNewRandomTransaction()
	transactionResponse := NewTransactionResponse(transaction.Id, transaction.Name, transaction.Description, transaction.TypeTransation, transaction.AccountId, transaction.CategoryId, transaction.Amount, transaction.CreatedAt)

	assert.Equal(t, transaction.Id, transactionResponse.Id)
	assert.Equal(t, transaction.Name, transactionResponse.Name)
	assert.Equal(t, transaction.Description, transactionResponse.Description)
	assert.Equal(t, transaction.TypeTransation, transactionResponse.TypeTransation)
	assert.Equal(t, transaction.AccountId, transactionResponse.AccountId)
	assert.Equal(t, transaction.Amount, transactionResponse.Amount)
	assert.Equal(t, transaction.CreatedAt, transactionResponse.CreatedAt)
}
