package account

import (
	"context"
	"fmt"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/mock"
)

// MockAccountRepositoryBench for benchmarking
type MockAccountRepositoryBench struct {
	mock.Mock
}

func (m *MockAccountRepositoryBench) Save(ctx context.Context, acc *account.Account) error {
	args := m.Called(ctx, acc)
	return args.Error(0)
}

func (m *MockAccountRepositoryBench) FindAll(ctx context.Context, userId string) ([]*account.Account, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*account.Account), args.Error(1)
}

func (m *MockAccountRepositoryBench) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAccountRepositoryBench) Balance(ctx context.Context, id string) (float64, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockAccountRepositoryBench) Update(ctx context.Context, id string, name string, bank string, userId string) error {
	args := m.Called(ctx, id, name, bank, userId)
	return args.Error(0)
}

func (m *MockAccountRepositoryBench) FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error) {
	args := m.Called(ctx, id, userId)
	return args.Get(0).(*account.Account), args.Error(1)
}

// BenchmarkAccountService_CreateAccount tests the performance of account creation
func BenchmarkAccountService_CreateAccount(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Generate test data
	accounts := make([]*account.Account, b.N)
	for i := 0; i < b.N; i++ {
		accounts[i] = utils.GetNewRandomAccount()
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		acc := accounts[i]
		_ = accountService.CreateAccount(ctx, acc.Name, acc.Bank, acc.InitialBalance, acc.UserId)
	}
}

// BenchmarkAccountService_FindAll tests the performance of account retrieval
func BenchmarkAccountService_FindAll(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Create test accounts
	testAccounts := make([]*account.Account, 50)
	for i := 0; i < 50; i++ {
		testAccounts[i] = utils.GetNewRandomAccount()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testAccounts, nil)
	mockRepo.On("Balance", mock.Anything, mock.AnythingOfType("string")).Return(1000.0, nil)

	// Generate test user IDs
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		userIDs[i] = fmt.Sprintf("user-%d", i%10) // Simulate 10 different users
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = accountService.FindAll(ctx, userIDs[i])
	}
}

// BenchmarkAccountService_DeleteAccount tests the performance of account deletion
func BenchmarkAccountService_DeleteAccount(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	// Generate test IDs
	accountIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		accountIDs[i] = fmt.Sprintf("account-%d", i)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = accountService.DeleteAccount(ctx, accountIDs[i])
	}
}

// BenchmarkAccountService_FindAll_Parallel tests account retrieval under concurrent load
func BenchmarkAccountService_FindAll_Parallel(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Create test accounts
	testAccounts := make([]*account.Account, 100)
	for i := 0; i < 100; i++ {
		testAccounts[i] = utils.GetNewRandomAccount()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testAccounts, nil)
	mockRepo.On("Balance", mock.Anything, mock.AnythingOfType("string")).Return(1500.0, nil)

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userID := fmt.Sprintf("user-%d", i%20)
			_, _ = accountService.FindAll(ctx, userID)
			i++
		}
	})
}

// BenchmarkAccountService_CreateAccount_Parallel tests account creation under concurrent load
func BenchmarkAccountService_CreateAccount_Parallel(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			acc := utils.GetNewRandomAccount()
			_ = accountService.CreateAccount(ctx, acc.Name, acc.Bank, acc.InitialBalance, acc.UserId)
		}
	})
}

// BenchmarkAccountService_BatchOperations tests batch account operations performance
func BenchmarkAccountService_BatchOperations(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)
	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return([]*account.Account{utils.GetNewRandomAccount()}, nil)
	mockRepo.On("Balance", mock.Anything, mock.AnythingOfType("string")).Return(2000.0, nil)

	batchSizes := []int{1, 10, 50, 100}

	for _, batchSize := range batchSizes {
		b.Run(fmt.Sprintf("BatchSize%d", batchSize), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				// Mix of create and find operations
				for j := 0; j < batchSize; j++ {
					if j%2 == 0 {
						acc := utils.GetNewRandomAccount()
						_ = accountService.CreateAccount(ctx, acc.Name, acc.Bank, acc.InitialBalance, acc.UserId)
					} else {
						_, _ = accountService.FindAll(ctx, fmt.Sprintf("user-%d", j))
					}
				}
			}
		})
	}
}

// BenchmarkAccountService_MemoryAllocation tests memory allocation patterns
func BenchmarkAccountService_MemoryAllocation(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		acc := utils.GetNewRandomAccount()
		_ = accountService.CreateAccount(ctx, acc.Name, acc.Bank, acc.InitialBalance, acc.UserId)
	}
}

// BenchmarkAccountService_HighConcurrency tests performance under high concurrent load
func BenchmarkAccountService_HighConcurrency(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	testAccounts := []*account.Account{utils.GetNewRandomAccount(), utils.GetNewRandomAccount()}
	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testAccounts, nil)
	mockRepo.On("Balance", mock.Anything, mock.AnythingOfType("string")).Return(1750.0, nil)
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	b.SetParallelism(10) // High concurrency

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			// Mix of operations to simulate real workload
			switch i % 4 {
			case 0:
				_, _ = accountService.FindAll(ctx, "user-test")
			case 1:
				acc := utils.GetNewRandomAccount()
				_ = accountService.CreateAccount(ctx, acc.Name, acc.Bank, acc.InitialBalance, acc.UserId)
			case 2:
				_ = accountService.DeleteAccount(ctx, "account-test")
			case 3:
				// Balance check through FindAll
				_, _ = accountService.FindAll(ctx, "user-balance-test")
			}
			i++
		}
	})
}

// BenchmarkAccountService_LargeDataSet tests performance with large data sets
func BenchmarkAccountService_LargeDataSet(b *testing.B) {
	mockRepo := &MockAccountRepositoryBench{}
	accountService := NewAccountService(mockRepo)
	ctx := context.Background()

	// Create large test data sets
	dataSizes := []int{10, 100, 1000, 10000}

	for _, size := range dataSizes {
		testAccounts := make([]*account.Account, size)
		for i := 0; i < size; i++ {
			testAccounts[i] = utils.GetNewRandomAccount()
		}

		mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testAccounts, nil)
		mockRepo.On("Balance", mock.Anything, mock.AnythingOfType("string")).Return(float64(size*100), nil)

		b.Run(fmt.Sprintf("DataSize%d", size), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = accountService.FindAll(ctx, fmt.Sprintf("user-%d", i%10))
			}
		})
	}
}

func init() {
	// Ensure mock is properly initialized for benchmarks
}
