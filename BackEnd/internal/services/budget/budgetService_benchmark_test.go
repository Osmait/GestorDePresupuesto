package budget

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/budget"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/mock"
)

// MockBudgetRepositoryBench for benchmarking
type MockBudgetRepositoryBench struct {
	mock.Mock
}

func (m *MockBudgetRepositoryBench) Save(ctx context.Context, budget *budget.Budget) error {
	args := m.Called(ctx, budget)
	return args.Error(0)
}

func (m *MockBudgetRepositoryBench) FindAll(ctx context.Context, userId string) ([]*budget.Budget, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*budget.Budget), args.Error(1)
}

func (m *MockBudgetRepositoryBench) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockBudgetRepositoryBench) FindOne(ctx context.Context, id string) (*budget.Budget, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*budget.Budget), args.Error(1)
}

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

func getNewBudgetBench() *budget.Budget {
	return utils.GetNewRandomBudget()
}

// BenchmarkBudgetService_CreateBudget tests the performance of budget creation
func BenchmarkBudgetService_CreateBudget(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Setup mock responses
	mockRepoBudget.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Generate test data
	budgetRequests := make([]*dto.BudgetRequest, b.N)
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		amounts, _ := faker.RandomInt(100, 10000)
		budgetRequests[i] = dto.NewBudgetRequest(
			faker.UUIDDigit(),
			float64(amounts[0]),
		)
		userIDs[i] = faker.UUIDDigit()
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		_ = budgetService.CreateBudget(ctx, budgetRequests[i], userIDs[i])
	}
}

// BenchmarkBudgetService_FindAll tests the performance of budget retrieval
func BenchmarkBudgetService_FindAll(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Create test budgets
	testBudgets := make([]*budget.Budget, 50)
	for i := 0; i < 50; i++ {
		testBudgets[i] = getNewBudgetBench()
	}

	mockRepoBudget.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testBudgets, nil)
	mockRepoTransaction.On("FindCurrentBudget", mock.Anything, mock.AnythingOfType("string")).Return(500.0, nil)

	// Generate test user IDs
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		userIDs[i] = fmt.Sprintf("user-%d", i%10)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = budgetService.FindAll(ctx, userIDs[i])
	}
}

// BenchmarkBudgetService_Delete tests the performance of budget deletion
func BenchmarkBudgetService_Delete(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Create test budgets for deletion
	testBudgets := make([]*budget.Budget, b.N)
	for i := 0; i < b.N; i++ {
		testBudgets[i] = getNewBudgetBench()
		mockRepoBudget.On("FindOne", mock.Anything, testBudgets[i].Id).Return(testBudgets[i], nil)
		mockRepoBudget.On("Delete", mock.Anything, testBudgets[i].Id).Return(nil)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = budgetService.Delete(ctx, testBudgets[i].Id)
	}
}

// BenchmarkBudgetService_CreateBudget_Parallel tests budget creation under concurrent load
func BenchmarkBudgetService_CreateBudget_Parallel(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Setup mock responses
	mockRepoBudget.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			amounts, _ := faker.RandomInt(100, 10000)
			budgetRequest := dto.NewBudgetRequest(
				faker.UUIDDigit(),
				float64(amounts[0]),
			)
			userID := faker.UUIDDigit()
			_ = budgetService.CreateBudget(ctx, budgetRequest, userID)
		}
	})
}

// BenchmarkBudgetService_FindAll_Parallel tests budget retrieval under concurrent load
func BenchmarkBudgetService_FindAll_Parallel(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Create test budgets
	testBudgets := make([]*budget.Budget, 100)
	for i := 0; i < 100; i++ {
		testBudgets[i] = getNewBudgetBench()
	}

	mockRepoBudget.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testBudgets, nil)
	mockRepoTransaction.On("FindCurrentBudget", mock.Anything, mock.AnythingOfType("string")).Return(750.0, nil)

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userID := fmt.Sprintf("user-%d", i%20)
			_, _ = budgetService.FindAll(ctx, userID)
			i++
		}
	})
}

// BenchmarkBudgetService_BatchOperations tests batch budget operations performance
func BenchmarkBudgetService_BatchOperations(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Setup mock responses
	mockRepoBudget.On("Save", mock.Anything, mock.Anything).Return(nil)
	mockRepoBudget.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return([]*budget.Budget{getNewBudgetBench()}, nil)
	mockRepoTransaction.On("FindCurrentBudget", mock.Anything, mock.AnythingOfType("string")).Return(300.0, nil)

	testBudget := getNewBudgetBench()
	mockRepoBudget.On("FindOne", mock.Anything, mock.AnythingOfType("string")).Return(testBudget, nil)
	mockRepoBudget.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	batchSizes := []int{1, 10, 25, 50}

	for _, batchSize := range batchSizes {
		b.Run(fmt.Sprintf("BatchSize%d", batchSize), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				// Mix of create, find, and delete operations
				for j := 0; j < batchSize; j++ {
					switch j % 3 {
					case 0:
						amounts, _ := faker.RandomInt(100, 10000)
						budgetRequest := dto.NewBudgetRequest(
							faker.UUIDDigit(),
							float64(amounts[0]),
						)
						_ = budgetService.CreateBudget(ctx, budgetRequest, fmt.Sprintf("user-%d", j))
					case 1:
						_, _ = budgetService.FindAll(ctx, fmt.Sprintf("user-%d", j))
					case 2:
						_ = budgetService.Delete(ctx, fmt.Sprintf("budget-%d", j))
					}
				}
			}
		})
	}
}

// BenchmarkBudgetService_MemoryAllocation tests memory allocation patterns
func BenchmarkBudgetService_MemoryAllocation(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Setup mock responses
	mockRepoBudget.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		amounts, _ := faker.RandomInt(100, 10000)
		budgetRequest := dto.NewBudgetRequest(
			faker.UUIDDigit(),
			float64(amounts[0]),
		)
		userID := faker.UUIDDigit()
		_ = budgetService.CreateBudget(ctx, budgetRequest, userID)
	}
}

// BenchmarkBudgetService_HighConcurrency tests performance under high concurrent load
func BenchmarkBudgetService_HighConcurrency(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Setup mock responses
	testBudgets := []*budget.Budget{getNewBudgetBench(), getNewBudgetBench()}
	mockRepoBudget.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testBudgets, nil)
	mockRepoTransaction.On("FindCurrentBudget", mock.Anything, mock.AnythingOfType("string")).Return(600.0, nil)
	mockRepoBudget.On("Save", mock.Anything, mock.Anything).Return(nil)

	testBudget := getNewBudgetBench()
	mockRepoBudget.On("FindOne", mock.Anything, mock.AnythingOfType("string")).Return(testBudget, nil)
	mockRepoBudget.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	b.SetParallelism(10) // High concurrency

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			// Mix of operations to simulate real workload
			switch i % 3 {
			case 0:
				_, _ = budgetService.FindAll(ctx, "user-test")
			case 1:
				amounts, _ := faker.RandomInt(100, 10000)
				budgetRequest := dto.NewBudgetRequest(
					faker.UUIDDigit(),
					float64(amounts[0]),
				)
				_ = budgetService.CreateBudget(ctx, budgetRequest, "user-test")
			case 2:
				_ = budgetService.Delete(ctx, "budget-test")
			}
			i++
		}
	})
}

// BenchmarkBudgetService_LargeDataSet tests performance with large data sets
func BenchmarkBudgetService_LargeDataSet(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Create large test data sets
	dataSizes := []int{10, 50, 100, 500}

	for _, size := range dataSizes {
		testBudgets := make([]*budget.Budget, size)
		for i := 0; i < size; i++ {
			testBudgets[i] = getNewBudgetBench()
		}

		mockRepoBudget.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testBudgets, nil)
		mockRepoTransaction.On("FindCurrentBudget", mock.Anything, mock.AnythingOfType("string")).Return(float64(size*10), nil)

		b.Run(fmt.Sprintf("DataSize%d", size), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = budgetService.FindAll(ctx, fmt.Sprintf("user-%d", i%10))
			}
		})
	}
}

// BenchmarkBudgetService_AmountVariations tests performance with different budget amounts
func BenchmarkBudgetService_AmountVariations(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Setup mock responses
	mockRepoBudget.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Different budget amounts
	amountRanges := []struct {
		name string
		min  int
		max  int
	}{
		{"Small", 100, 1000},
		{"Medium", 1000, 10000},
		{"Large", 10000, 100000},
		{"Enterprise", 100000, 1000000},
	}

	for _, amountRange := range amountRanges {
		b.Run(fmt.Sprintf("Amount%s", amountRange.name), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				amounts, _ := faker.RandomInt(amountRange.min, amountRange.max)
				budgetRequest := dto.NewBudgetRequest(
					faker.UUIDDigit(),
					float64(amounts[0]),
				)
				userID := faker.UUIDDigit()
				_ = budgetService.CreateBudget(ctx, budgetRequest, userID)
			}
		})
	}
}

// BenchmarkBudgetService_ConcurrentFindAll tests concurrent budget retrieval with current amounts
func BenchmarkBudgetService_ConcurrentFindAll(b *testing.B) {
	mockRepoBudget := &MockBudgetRepositoryBench{}
	mockRepoTransaction := &MockTransactionBench{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	ctx := context.Background()

	// Create test budgets for multiple users
	numUsers := 100
	testBudgets := make([]*budget.Budget, numUsers*5) // 5 budgets per user
	for i := 0; i < numUsers*5; i++ {
		testBudgets[i] = getNewBudgetBench()
	}

	mockRepoBudget.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testBudgets[:5], nil)
	mockRepoTransaction.On("FindCurrentBudget", mock.Anything, mock.AnythingOfType("string")).Return(250.0, nil)

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userID := fmt.Sprintf("user-%d", i%numUsers)
			_, _ = budgetService.FindAll(ctx, userID)
			i++
		}
	})
}

func init() {
	// Ensure mock is properly initialized for benchmarks
}
