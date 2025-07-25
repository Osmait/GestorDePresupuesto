package transaction

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/mock"
)

// MockTransactionBench for benchmarking
type MockTransactionBench struct {
	mock.Mock
}

func (m *MockTransactionBench) Save(ctx context.Context, transaction *transaction.Transaction) error {
	args := m.Called(ctx, transaction)
	return args.Error(0)
}

func (m *MockTransactionBench) FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, date1, date2, id)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransactionBench) FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, id)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransactionBench) FindCurrentBudget(ctx context.Context, budgetId string) (float64, error) {
	args := m.Called(ctx, budgetId)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockTransactionBench) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// BenchmarkTransactionService_CreateTransaction tests the performance of transaction creation
func BenchmarkTransactionService_CreateTransaction(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Generate test data
	transactions := make([]*transaction.Transaction, b.N)
	for i := 0; i < b.N; i++ {
		transactions[i] = utils.GetNewRandomTransaction()
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		tx := transactions[i]
		_ = transactionService.CreateTransaction(ctx, tx.Name, tx.Description, tx.Amount, tx.TypeTransation, tx.AccountId, tx.UserId, tx.CategoryId, tx.BudgetId)
	}
}

// BenchmarkTransactionService_FindAll tests the performance of transaction retrieval
func BenchmarkTransactionService_FindAll(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Create test transactions
	testTransactions := make([]*transaction.Transaction, 100)
	for i := 0; i < 100; i++ {
		testTransactions[i] = utils.GetNewRandomTransaction()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(testTransactions, nil)

	// Generate date ranges
	currentTime := time.Now()
	date1 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()-7)
	date2 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()+1)

	// Generate test account IDs
	accountIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		accountIDs[i] = fmt.Sprintf("account-%d", i%10)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = transactionService.FindAll(ctx, date1, date2, accountIDs[i])
	}
}

// BenchmarkTransactionService_FindAllOfAllAccounts tests the performance of finding all transactions across accounts
func BenchmarkTransactionService_FindAllOfAllAccounts(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Create test transactions
	testTransactions := make([]*transaction.Transaction, 200)
	for i := 0; i < 200; i++ {
		testTransactions[i] = utils.GetNewRandomTransaction()
	}

	mockRepo.On("FindAllOfAllAccounts", mock.Anything, mock.AnythingOfType("string")).Return(testTransactions, nil)

	// Generate test user IDs
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		userIDs[i] = fmt.Sprintf("user-%d", i%5)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = transactionService.FindAllOfAllAccounts(ctx, userIDs[i])
	}
}

// BenchmarkTransactionService_DeleteTransaction tests the performance of transaction deletion
func BenchmarkTransactionService_DeleteTransaction(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	// Generate test transaction IDs
	transactionIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		transactionIDs[i] = fmt.Sprintf("transaction-%d", i)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = transactionService.DeleteTransaction(ctx, transactionIDs[i])
	}
}

// BenchmarkTransactionService_CreateTransaction_Parallel tests transaction creation under concurrent load
func BenchmarkTransactionService_CreateTransaction_Parallel(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			tx := utils.GetNewRandomTransaction()
			_ = transactionService.CreateTransaction(ctx, tx.Name, tx.Description, tx.Amount, tx.TypeTransation, tx.AccountId, tx.UserId, tx.CategoryId, tx.BudgetId)
		}
	})
}

// BenchmarkTransactionService_FindAll_Parallel tests transaction retrieval under concurrent load
func BenchmarkTransactionService_FindAll_Parallel(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Create test transactions
	testTransactions := make([]*transaction.Transaction, 150)
	for i := 0; i < 150; i++ {
		testTransactions[i] = utils.GetNewRandomTransaction()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(testTransactions, nil)

	// Generate date ranges
	currentTime := time.Now()
	date1 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()-7)
	date2 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()+1)

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			accountID := fmt.Sprintf("account-%d", i%15)
			_, _ = transactionService.FindAll(ctx, date1, date2, accountID)
			i++
		}
	})
}

// BenchmarkTransactionService_BatchOperations tests batch transaction operations performance
func BenchmarkTransactionService_BatchOperations(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)
	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]*transaction.Transaction{utils.GetNewRandomTransaction()}, nil)
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	// Generate date ranges
	currentTime := time.Now()
	date1 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()-7)
	date2 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()+1)

	batchSizes := []int{1, 10, 50, 100}

	for _, batchSize := range batchSizes {
		b.Run(fmt.Sprintf("BatchSize%d", batchSize), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				// Mix of create, find, and delete operations
				for j := 0; j < batchSize; j++ {
					switch j % 3 {
					case 0:
						tx := utils.GetNewRandomTransaction()
						_ = transactionService.CreateTransaction(ctx, tx.Name, tx.Description, tx.Amount, tx.TypeTransation, tx.AccountId, tx.UserId, tx.CategoryId, tx.BudgetId)
					case 1:
						_, _ = transactionService.FindAll(ctx, date1, date2, fmt.Sprintf("account-%d", j))
					case 2:
						_ = transactionService.DeleteTransaction(ctx, fmt.Sprintf("transaction-%d", j))
					}
				}
			}
		})
	}
}

// BenchmarkTransactionService_MemoryAllocation tests memory allocation patterns
func BenchmarkTransactionService_MemoryAllocation(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		tx := utils.GetNewRandomTransaction()
		_ = transactionService.CreateTransaction(ctx, tx.Name, tx.Description, tx.Amount, tx.TypeTransation, tx.AccountId, tx.UserId, tx.CategoryId, tx.BudgetId)
	}
}

// BenchmarkTransactionService_HighConcurrency tests performance under high concurrent load
func BenchmarkTransactionService_HighConcurrency(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	testTransactions := []*transaction.Transaction{utils.GetNewRandomTransaction(), utils.GetNewRandomTransaction()}
	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(testTransactions, nil)
	mockRepo.On("FindAllOfAllAccounts", mock.Anything, mock.AnythingOfType("string")).Return(testTransactions, nil)
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	// Generate date ranges
	currentTime := time.Now()
	date1 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()-7)
	date2 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()+1)

	b.SetParallelism(10) // High concurrency

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			// Mix of operations to simulate real workload
			switch i % 4 {
			case 0:
				_, _ = transactionService.FindAll(ctx, date1, date2, "account-test")
			case 1:
				tx := utils.GetNewRandomTransaction()
				_ = transactionService.CreateTransaction(ctx, tx.Name, tx.Description, tx.Amount, tx.TypeTransation, tx.AccountId, tx.UserId, tx.CategoryId, tx.BudgetId)
			case 2:
				_ = transactionService.DeleteTransaction(ctx, "transaction-test")
			case 3:
				_, _ = transactionService.FindAllOfAllAccounts(ctx, "user-test")
			}
			i++
		}
	})
}

// BenchmarkTransactionService_LargeDataSet tests performance with large data sets
func BenchmarkTransactionService_LargeDataSet(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Create large test data sets
	dataSizes := []int{10, 100, 1000, 5000}

	// Generate date ranges
	currentTime := time.Now()
	date1 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()-30)
	date2 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()+1)

	for _, size := range dataSizes {
		testTransactions := make([]*transaction.Transaction, size)
		for i := 0; i < size; i++ {
			testTransactions[i] = utils.GetNewRandomTransaction()
		}

		mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(testTransactions, nil)

		b.Run(fmt.Sprintf("DataSize%d", size), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = transactionService.FindAll(ctx, date1, date2, fmt.Sprintf("account-%d", i%10))
			}
		})
	}
}

// BenchmarkTransactionService_DateRangeVariations tests performance with different date ranges
func BenchmarkTransactionService_DateRangeVariations(b *testing.B) {
	mockRepo := &MockTransactionBench{}
	transactionService := NewTransactionService(mockRepo)
	ctx := context.Background()

	// Create test transactions
	testTransactions := make([]*transaction.Transaction, 100)
	for i := 0; i < 100; i++ {
		testTransactions[i] = utils.GetNewRandomTransaction()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(testTransactions, nil)

	// Different date ranges
	currentTime := time.Now()
	dateRanges := []struct {
		name string
		days int
	}{
		{"1Day", 1},
		{"7Days", 7},
		{"30Days", 30},
		{"90Days", 90},
		{"365Days", 365},
	}

	for _, dateRange := range dateRanges {
		date1 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()-dateRange.days)
		date2 := fmt.Sprintf("%d/%d/%d", currentTime.Year(), currentTime.Month(), currentTime.Day()+1)

		b.Run(fmt.Sprintf("DateRange%s", dateRange.name), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = transactionService.FindAll(ctx, date1, date2, fmt.Sprintf("account-%d", i%5))
			}
		})
	}
}

func init() {
	// Ensure mock is properly initialized for benchmarks
}
