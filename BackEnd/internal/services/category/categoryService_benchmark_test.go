package category

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/category"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/mock"
)

// MockCategoryRepositoryBench for benchmarking
type MockCategoryRepositoryBench struct {
	mock.Mock
}

func (m *MockCategoryRepositoryBench) Save(ctx context.Context, category *category.Category) error {
	args := m.Called(ctx, category)
	return args.Error(0)
}

func (m *MockCategoryRepositoryBench) FindAll(ctx context.Context, userId string) ([]*category.Category, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepositoryBench) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCategoryRepositoryBench) FindOne(ctx context.Context, id string) (*category.Category, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*category.Category), args.Error(1)
}

func getNewCategoryBench() *category.Category {
	return utils.GetNewRandomCategory()
}

// BenchmarkCategoryService_CreateCategory tests the performance of category creation
func BenchmarkCategoryService_CreateCategory(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Generate test data
	categoryRequests := make([]*dto.CategoryRequest, b.N)
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		categoryRequests[i] = dto.NewCategoryRequest(
			faker.Name(),
			faker.Name(),
			faker.Name(),
		)
		userIDs[i] = faker.UUIDDigit()
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		_ = categoryService.CreateCategory(ctx, categoryRequests[i], userIDs[i])
	}
}

// BenchmarkCategoryService_FindAll tests the performance of category retrieval
func BenchmarkCategoryService_FindAll(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Create test categories
	testCategories := make([]*category.Category, 50)
	for i := 0; i < 50; i++ {
		testCategories[i] = getNewCategoryBench()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testCategories, nil)

	// Generate test user IDs
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		userIDs[i] = fmt.Sprintf("user-%d", i%10)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = categoryService.FindAll(ctx, userIDs[i])
	}
}

// BenchmarkCategoryService_Delete tests the performance of category deletion
func BenchmarkCategoryService_Delete(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Create test categories for deletion
	testCategories := make([]*category.Category, b.N)
	for i := 0; i < b.N; i++ {
		testCategories[i] = getNewCategoryBench()
		mockRepo.On("FindOne", mock.Anything, testCategories[i].Id).Return(testCategories[i], nil)
		mockRepo.On("Delete", mock.Anything, testCategories[i].Id).Return(nil)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = categoryService.Delete(ctx, testCategories[i].Id)
	}
}

// BenchmarkCategoryService_CreateCategory_Parallel tests category creation under concurrent load
func BenchmarkCategoryService_CreateCategory_Parallel(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			categoryRequest := dto.NewCategoryRequest(
				faker.Name(),
				faker.Name(),
				faker.Name(),
			)
			userID := faker.UUIDDigit()
			_ = categoryService.CreateCategory(ctx, categoryRequest, userID)
		}
	})
}

// BenchmarkCategoryService_FindAll_Parallel tests category retrieval under concurrent load
func BenchmarkCategoryService_FindAll_Parallel(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Create test categories
	testCategories := make([]*category.Category, 100)
	for i := 0; i < 100; i++ {
		testCategories[i] = getNewCategoryBench()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testCategories, nil)

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userID := fmt.Sprintf("user-%d", i%20)
			_, _ = categoryService.FindAll(ctx, userID)
			i++
		}
	})
}

// BenchmarkCategoryService_BatchOperations tests batch category operations performance
func BenchmarkCategoryService_BatchOperations(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)
	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return([]*category.Category{getNewCategoryBench()}, nil)

	testCategory := getNewCategoryBench()
	mockRepo.On("FindOne", mock.Anything, mock.AnythingOfType("string")).Return(testCategory, nil)
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	batchSizes := []int{1, 10, 25, 50}

	for _, batchSize := range batchSizes {
		b.Run(fmt.Sprintf("BatchSize%d", batchSize), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				// Mix of create, find, and delete operations
				for j := 0; j < batchSize; j++ {
					switch j % 3 {
					case 0:
						categoryRequest := dto.NewCategoryRequest(
							faker.Name(),
							faker.Name(),
							faker.Name(),
						)
						_ = categoryService.CreateCategory(ctx, categoryRequest, fmt.Sprintf("user-%d", j))
					case 1:
						_, _ = categoryService.FindAll(ctx, fmt.Sprintf("user-%d", j))
					case 2:
						_ = categoryService.Delete(ctx, fmt.Sprintf("category-%d", j))
					}
				}
			}
		})
	}
}

// BenchmarkCategoryService_MemoryAllocation tests memory allocation patterns
func BenchmarkCategoryService_MemoryAllocation(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		categoryRequest := dto.NewCategoryRequest(
			faker.Name(),
			faker.Name(),
			faker.Name(),
		)
		userID := faker.UUIDDigit()
		_ = categoryService.CreateCategory(ctx, categoryRequest, userID)
	}
}

// BenchmarkCategoryService_HighConcurrency tests performance under high concurrent load
func BenchmarkCategoryService_HighConcurrency(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	testCategories := []*category.Category{getNewCategoryBench(), getNewCategoryBench()}
	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testCategories, nil)
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	testCategory := getNewCategoryBench()
	mockRepo.On("FindOne", mock.Anything, mock.AnythingOfType("string")).Return(testCategory, nil)
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	b.SetParallelism(10) // High concurrency

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			// Mix of operations to simulate real workload
			switch i % 3 {
			case 0:
				_, _ = categoryService.FindAll(ctx, "user-test")
			case 1:
				categoryRequest := dto.NewCategoryRequest(
					faker.Name(),
					faker.Name(),
					faker.Name(),
				)
				_ = categoryService.CreateCategory(ctx, categoryRequest, "user-test")
			case 2:
				_ = categoryService.Delete(ctx, "category-test")
			}
			i++
		}
	})
}

// BenchmarkCategoryService_LargeDataSet tests performance with large data sets
func BenchmarkCategoryService_LargeDataSet(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Create large test data sets
	dataSizes := []int{10, 50, 100, 500}

	for _, size := range dataSizes {
		testCategories := make([]*category.Category, size)
		for i := 0; i < size; i++ {
			testCategories[i] = getNewCategoryBench()
		}

		mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testCategories, nil)

		b.Run(fmt.Sprintf("DataSize%d", size), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, _ = categoryService.FindAll(ctx, fmt.Sprintf("user-%d", i%10))
			}
		})
	}
}

// BenchmarkCategoryService_ConcurrentUsers tests concurrent category access for different users
func BenchmarkCategoryService_ConcurrentUsers(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Create test categories for multiple users
	numUsers := 100
	testCategories := make([]*category.Category, numUsers*3) // 3 categories per user
	for i := 0; i < numUsers*3; i++ {
		testCategories[i] = getNewCategoryBench()
	}

	mockRepo.On("FindAll", mock.Anything, mock.AnythingOfType("string")).Return(testCategories[:3], nil)

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userID := fmt.Sprintf("user-%d", i%numUsers)
			_, _ = categoryService.FindAll(ctx, userID)
			i++
		}
	})
}

// BenchmarkCategoryService_CategoryVariations tests performance with different category types
func BenchmarkCategoryService_CategoryVariations(b *testing.B) {
	mockRepo := &MockCategoryRepositoryBench{}
	categoryService := NewCategoryServices(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Different category types
	categoryTypes := []struct {
		name  string
		icon  string
		color string
	}{
		{"Food", "🍕", "#FF6B6B"},
		{"Transport", "🚗", "#4ECDC4"},
		{"Entertainment", "🎬", "#45B7D1"},
		{"Shopping", "🛍️", "#96CEB4"},
		{"Healthcare", "🏥", "#FFEAA7"},
		{"Education", "📚", "#DDA0DD"},
		{"Utilities", "💡", "#FF7675"},
		{"Travel", "✈️", "#74B9FF"},
	}

	for _, categoryType := range categoryTypes {
		b.Run(fmt.Sprintf("Type%s", categoryType.name), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				categoryRequest := dto.NewCategoryRequest(
					categoryType.name,
					categoryType.icon,
					categoryType.color,
				)
				userID := faker.UUIDDigit()
				_ = categoryService.CreateCategory(ctx, categoryRequest, userID)
			}
		})
	}
}

func init() {
	// Ensure mock is properly initialized for benchmarks
}
