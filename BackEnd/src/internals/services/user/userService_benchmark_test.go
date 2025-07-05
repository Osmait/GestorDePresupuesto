package user

import (
	"context"
	"fmt"
	"testing"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
	userDto "github.com/osmait/gestorDePresupuesto/src/internals/platform/dto/user"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"github.com/stretchr/testify/mock"
)

// MockUserRepository for benchmarking
type MockUserRepositoryBench struct {
	mock.Mock
}

func (m *MockUserRepositoryBench) Save(ctx context.Context, user *user.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepositoryBench) FindUserByEmail(ctx context.Context, email string) (*user.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepositoryBench) FindUserById(ctx context.Context, id string) (*user.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepositoryBench) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// BenchmarkUserService_CreateUser tests the performance of user creation
func BenchmarkUserService_CreateUser(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Generate test data
	userRequests := make([]*userDto.UserRequest, b.N)
	for i := 0; i < b.N; i++ {
		user := utils.GetNewRandomUser()
		userRequests[i] = userDto.NewUserRequest(user.Name, user.LastName, user.Password, user.Email)
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		_ = userService.CreateUser(ctx, userRequests[i])
	}
}

// BenchmarkUserService_FindUserById tests the performance of user lookup by ID
func BenchmarkUserService_FindUserById(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Create test user
	testUser := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", mock.Anything, mock.AnythingOfType("string")).Return(testUser, nil)

	// Generate test IDs
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		userIDs[i] = testUser.Id
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = userService.FindUserById(ctx, userIDs[i])
	}
}

// BenchmarkUserService_FindByEmail tests the performance of user lookup by email
func BenchmarkUserService_FindByEmail(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Create test user
	testUser := utils.GetNewRandomUser()
	mockRepo.On("FindUserByEmail", mock.Anything, mock.AnythingOfType("string")).Return(testUser, nil)

	// Generate test emails
	emails := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		emails[i] = testUser.Email
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = userService.FindByEmail(ctx, emails[i])
	}
}

// BenchmarkUserService_DeleteUser tests the performance of user deletion
func BenchmarkUserService_DeleteUser(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	testUser := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", mock.Anything, mock.AnythingOfType("string")).Return(testUser, nil)
	mockRepo.On("Delete", mock.Anything, mock.AnythingOfType("string")).Return(nil)

	// Generate test IDs
	userIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		userIDs[i] = testUser.Id
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_ = userService.DeleteUser(ctx, userIDs[i])
	}
}

// BenchmarkUserService_CreateUser_Parallel tests user creation under concurrent load
func BenchmarkUserService_CreateUser_Parallel(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			user := utils.GetNewRandomUser()
			userRequest := userDto.NewUserRequest(user.Name, user.LastName, user.Password, user.Email)
			_ = userService.CreateUser(ctx, userRequest)
		}
	})
}

// BenchmarkUserService_FindUserById_Parallel tests user lookup under concurrent load
func BenchmarkUserService_FindUserById_Parallel(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Create test user
	testUser := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", mock.Anything, mock.AnythingOfType("string")).Return(testUser, nil)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, _ = userService.FindUserById(ctx, testUser.Id)
		}
	})
}

// BenchmarkUserService_BatchOperations tests batch user operations performance
func BenchmarkUserService_BatchOperations(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping batch operations benchmark in short mode")
	}

	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)
	mockRepo.On("FindUserById", mock.Anything, mock.AnythingOfType("string")).Return(utils.GetNewRandomUser(), nil)

	// Reduced batch sizes for faster execution
	batchSizes := []int{1, 10, 50}
	if testing.Short() {
		batchSizes = []int{1, 5}
	}

	for _, batchSize := range batchSizes {
		b.Run(fmt.Sprintf("BatchSize%d", batchSize), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				// Create batch of users
				for j := 0; j < batchSize; j++ {
					user := utils.GetNewRandomUser()
					userRequest := userDto.NewUserRequest(user.Name, user.LastName, user.Password, user.Email)
					_ = userService.CreateUser(ctx, userRequest)
				}
			}
		})
	}
}

// BenchmarkUserService_MemoryAllocation tests memory allocation patterns
func BenchmarkUserService_MemoryAllocation(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping memory allocation benchmark in short mode")
	}

	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		user := utils.GetNewRandomUser()
		userRequest := userDto.NewUserRequest(user.Name, user.LastName, user.Password, user.Email)
		_ = userService.CreateUser(ctx, userRequest)
	}
}

// BenchmarkUserService_HighConcurrency tests performance under high concurrent load
func BenchmarkUserService_HighConcurrency(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping high concurrency benchmark in short mode")
	}

	mockRepo := &MockUserRepositoryBench{}
	userService := NewUserService(mockRepo)
	ctx := context.Background()

	// Setup mock responses
	testUser := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", mock.Anything, mock.AnythingOfType("string")).Return(testUser, nil)
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	// Reduced concurrency for faster execution
	parallelism := 5
	if testing.Short() {
		parallelism = 2
	}
	b.SetParallelism(parallelism)

	counter := 0
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			// Mix of operations to simulate real workload
			switch counter % 3 {
			case 0:
				_, _ = userService.FindUserById(ctx, testUser.Id)
			case 1:
				user := utils.GetNewRandomUser()
				userRequest := userDto.NewUserRequest(user.Name, user.LastName, user.Password, user.Email)
				_ = userService.CreateUser(ctx, userRequest)
			case 2:
				_, _ = userService.FindByEmail(ctx, testUser.Email)
			}
			counter++
		}
	})
}

func init() {
	// Ensure mock is properly initialized for benchmarks
}
