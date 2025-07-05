package invesment

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/internal/domain/invesment"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/mock"
)

// MockInvestmentRepositoryBench for benchmarking
type MockInvestmentRepositoryBench struct {
	mock.Mock
}

func (m *MockInvestmentRepositoryBench) Save(ctx context.Context, investment *invesment.Invesment) error {
	args := m.Called(ctx, investment)
	return args.Error(0)
}

func (m *MockInvestmentRepositoryBench) FindAll(ctx context.Context, userId string) ([]*invesment.Invesment, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*invesment.Invesment), args.Error(1)
}

func (m *MockInvestmentRepositoryBench) FindOne(ctx context.Context, id string) (*invesment.Invesment, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*invesment.Invesment), args.Error(1)
}

func (m *MockInvestmentRepositoryBench) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func getNewInvestmentBench() *invesment.Invesment {
	return utils.GetNewRandomInvestment()
}

// BenchmarkInvestmentService_CreateInvestment tests the performance of investment creation
func BenchmarkInvestmentService_CreateInvestment(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Generate test data
	investments := make([]*invesment.Invesment, b.N)
	for i := 0; i < b.N; i++ {
		investments[i] = getNewInvestmentBench()
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		_ = investmentService.CreateInvesment(ctx, investments[i])
	}
}

// BenchmarkInvestmentService_FindAll tests the performance of investment retrieval
func BenchmarkInvestmentService_FindAll(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Create test investments
	testInvestments := make([]*invesment.Invesment, 50)
	for i := 0; i < 50; i++ {
		testInvestments[i] = getNewInvestmentBench()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testInvestments, nil)

	// Generate test user IDs
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		userIDs[i] = fmt.Sprintf("user-%d", i%10)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = investmentService.FindAll(ctx, userIDs[i])
	}
}

// BenchmarkInvestmentService_Delete tests the performance of investment deletion
func BenchmarkInvestmentService_Delete(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Create test investments for deletion
	testInvestments := make([]*invesment.Invesment, b.N)
	for i := 0; i < b.N; i++ {
		testInvestments[i] = getNewInvestmentBench()
		mockRepo.On("FindOne", mock.Anything, testInvestments[i].Id).Return(testInvestments[i], nil)
		mockRepo.On("Delete", mock.Anything, testInvestments[i].Id).Return(nil)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = investmentService.Delete(ctx, testInvestments[i].Id)
	}
}

// BenchmarkInvestmentService_CreateInvestment_Parallel tests investment creation under concurrent load
func BenchmarkInvestmentService_CreateInvestment_Parallel(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			investment := getNewInvestmentBench()
			_ = investmentService.CreateInvesment(ctx, investment)
		}
	})
}

// BenchmarkInvestmentService_FindAll_Parallel tests investment retrieval under concurrent load
func BenchmarkInvestmentService_FindAll_Parallel(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Create test investments
	testInvestments := make([]*invesment.Invesment, 100)
	for i := 0; i < 100; i++ {
		testInvestments[i] = getNewInvestmentBench()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testInvestments, nil)

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userID := fmt.Sprintf("user-%d", i%20)
			_, _ = investmentService.FindAll(ctx, userID)
			i++
		}
	})
}

// BenchmarkInvestmentService_BatchOperations tests batch investment operations performance
func BenchmarkInvestmentService_BatchOperations(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)
	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return([]*invesment.Invesment{getNewInvestmentBench()}, nil)

	testInvestment := getNewInvestmentBench()
	mockRepo.On("FindOne", mock.Anything, mock.AnythingOfType("string")).Return(testInvestment, nil)
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	batchSizes := []int{1, 10, 25, 50}

	for _, batchSize := range batchSizes {
		b.Run(fmt.Sprintf("BatchSize%d", batchSize), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				// Mix of create, find, and delete operations
				for j := 0; j < batchSize; j++ {
					switch j % 3 {
					case 0:
						investment := getNewInvestmentBench()
						_ = investmentService.CreateInvesment(ctx, investment)
					case 1:
						_, _ = investmentService.FindAll(ctx, fmt.Sprintf("user-%d", j))
					case 2:
						_ = investmentService.Delete(ctx, fmt.Sprintf("investment-%d", j))
					}
				}
			}
		})
	}
}

// BenchmarkInvestmentService_MemoryAllocation tests memory allocation patterns
func BenchmarkInvestmentService_MemoryAllocation(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		investment := getNewInvestmentBench()
		_ = investmentService.CreateInvesment(ctx, investment)
	}
}

// BenchmarkInvestmentService_HighConcurrency tests performance under high concurrent load
func BenchmarkInvestmentService_HighConcurrency(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	testInvestments := []*invesment.Invesment{getNewInvestmentBench(), getNewInvestmentBench()}
	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testInvestments, nil)
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	testInvestment := getNewInvestmentBench()
	mockRepo.On("FindOne", mock.Anything, mock.AnythingOfType("string")).Return(testInvestment, nil)
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	b.SetParallelism(10) // High concurrency

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			// Mix of operations to simulate real workload
			switch i % 3 {
			case 0:
				_, _ = investmentService.FindAll(ctx, "user-test")
			case 1:
				investment := getNewInvestmentBench()
				_ = investmentService.CreateInvesment(ctx, investment)
			case 2:
				_ = investmentService.Delete(ctx, "investment-test")
			}
			i++
		}
	})
}

// BenchmarkInvestmentService_LargeDataSet tests performance with large data sets
func BenchmarkInvestmentService_LargeDataSet(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Create large test data sets
	dataSizes := []int{10, 50, 100, 500}

	for _, size := range dataSizes {
		testInvestments := make([]*invesment.Invesment, size)
		for i := 0; i < size; i++ {
			testInvestments[i] = getNewInvestmentBench()
		}

		mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testInvestments, nil)

		b.Run(fmt.Sprintf("DataSize%d", size), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = investmentService.FindAll(ctx, fmt.Sprintf("user-%d", i%10))
			}
		})
	}
}

// BenchmarkInvestmentService_InvestmentTypes tests performance with different investment types
func BenchmarkInvestmentService_InvestmentTypes(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Different investment types with varying price ranges
	investmentTypes := []struct {
		name     string
		minPrice int
		maxPrice int
		minQty   int
		maxQty   int
	}{
		{"Stocks", 10, 1000, 1, 1000},
		{"Crypto", 1, 100000, 1, 10000},
		{"Bonds", 100, 10000, 1, 100},
		{"ETF", 50, 500, 1, 500},
		{"Commodities", 1000, 100000, 1, 10},
		{"RealEstate", 100000, 10000000, 1, 1},
	}

	for _, investmentType := range investmentTypes {
		b.Run(fmt.Sprintf("Type%s", investmentType.name), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				prices, _ := faker.RandomInt(investmentType.minPrice, investmentType.maxPrice)
				currentPrices, _ := faker.RandomInt(investmentType.minPrice, investmentType.maxPrice)
				quantities, _ := faker.RandomInt(investmentType.minQty, investmentType.maxQty)

				investment := invesment.NewInvesment(
					faker.UUIDDigit(),
					investmentType.name+" "+faker.Name(),
					float64(prices[0]),
					float64(currentPrices[0]),
					float64(quantities[0]),
					faker.UUIDDigit(),
				)
				_ = investmentService.CreateInvesment(ctx, investment)
			}
		})
	}
}

// BenchmarkInvestmentService_PriceVariations tests performance with different price variations
func BenchmarkInvestmentService_PriceVariations(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Different price ranges
	priceRanges := []struct {
		name string
		min  int
		max  int
	}{
		{"Penny", 1, 10},
		{"Low", 10, 100},
		{"Medium", 100, 1000},
		{"High", 1000, 10000},
		{"Premium", 10000, 100000},
	}

	for _, priceRange := range priceRanges {
		b.Run(fmt.Sprintf("Price%s", priceRange.name), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				prices, _ := faker.RandomInt(priceRange.min, priceRange.max)
				currentPrices, _ := faker.RandomInt(priceRange.min, priceRange.max)
				quantities, _ := faker.RandomInt(1, 1000)

				investment := invesment.NewInvesment(
					faker.UUIDDigit(),
					faker.Name(),
					float64(prices[0]),
					float64(currentPrices[0]),
					float64(quantities[0]),
					faker.UUIDDigit(),
				)
				_ = investmentService.CreateInvesment(ctx, investment)
			}
		})
	}
}

// BenchmarkInvestmentService_ConcurrentUsers tests concurrent investment access for different users
func BenchmarkInvestmentService_ConcurrentUsers(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Create test investments for multiple users
	numUsers := 100
	testInvestments := make([]*invesment.Invesment, numUsers*5) // 5 investments per user
	for i := 0; i < numUsers*5; i++ {
		testInvestments[i] = getNewInvestmentBench()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testInvestments[:5], nil)

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userID := fmt.Sprintf("user-%d", i%numUsers)
			_, _ = investmentService.FindAll(ctx, userID)
			i++
		}
	})
}

// BenchmarkInvestmentService_PortfolioSize tests performance with different portfolio sizes
func BenchmarkInvestmentService_PortfolioSize(b *testing.B) {
	mockRepo := &MockInvestmentRepositoryBench{}
	investmentService := NewInvesmentServices(mockRepo)
	ctx := context.Background()

	// Different portfolio sizes
	portfolioSizes := []int{1, 5, 10, 25, 50, 100}

	for _, size := range portfolioSizes {
		testInvestments := make([]*invesment.Invesment, size)
		for i := 0; i < size; i++ {
			testInvestments[i] = getNewInvestmentBench()
		}

		mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testInvestments, nil)

		b.Run(fmt.Sprintf("Portfolio%d", size), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = investmentService.FindAll(ctx, fmt.Sprintf("user-%d", i%10))
			}
		})
	}
}

func init() {
	// Ensure mock is properly initialized for benchmarks
}
