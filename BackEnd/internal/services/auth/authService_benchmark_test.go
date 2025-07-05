package auth

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-faker/faker/v4"
	authRequest "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
	"github.com/stretchr/testify/mock"
	"golang.org/x/crypto/bcrypt"
)

// MockUserRepositoryBench for benchmarking
type MockUserRepositoryBench struct {
	mock.Mock
}

func (m *MockUserRepositoryBench) FindUserById(ctx context.Context, id string) (*user.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepositoryBench) FindUserByEmail(ctx context.Context, email string) (*user.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepositoryBench) Save(ctx context.Context, user *user.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepositoryBench) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func getNewUserBench() *user.User {
	return user.NewUser(faker.UUIDHyphenated(), faker.Name(), faker.LastName(), faker.Email(), faker.Password())
}

// BenchmarkAuthService_Login tests the performance of user authentication
func BenchmarkAuthService_Login(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Create test users with hashed passwords
	testUsers := make([]*user.User, b.N)
	loginRequests := make([]*authRequest.AuthRequest, b.N)

	for i := 0; i < b.N; i++ {
		testUser := getNewUserBench()
		plainPassword := testUser.Password

		// Hash the password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
		if err != nil {
			b.Fatal(err)
		}
		testUser.Password = string(hashedPassword)

		testUsers[i] = testUser
		loginRequests[i] = authRequest.NewAuthRequest(testUser.Email, plainPassword)
	}

	// Setup mock responses
	for i := 0; i < b.N; i++ {
		mockRepo.On("FindUserByEmail", mock.Anything, testUsers[i].Email).Return(testUsers[i], nil)
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		_, _ = authService.Login(ctx, loginRequests[i])
	}
}

// BenchmarkAuthService_Login_Parallel tests authentication under concurrent load
func BenchmarkAuthService_Login_Parallel(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Create test user with hashed password
	testUser := getNewUserBench()
	plainPassword := testUser.Password

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		b.Fatal(err)
	}
	testUser.Password = string(hashedPassword)

	// Setup mock responses
	mockRepo.On("FindUserByEmail", mock.Anything, mock.AnythingOfType("string")).Return(testUser, nil)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			loginRequest := authRequest.NewAuthRequest(testUser.Email, plainPassword)
			_, _ = authService.Login(ctx, loginRequest)
		}
	})
}

// BenchmarkAuthService_Login_DifferentUsers tests authentication with different users
func BenchmarkAuthService_Login_DifferentUsers(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Create multiple test users
	numUsers := 100
	testUsers := make([]*user.User, numUsers)
	plainPasswords := make([]string, numUsers)

	for i := 0; i < numUsers; i++ {
		testUser := getNewUserBench()
		plainPassword := testUser.Password

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
		if err != nil {
			b.Fatal(err)
		}
		testUser.Password = string(hashedPassword)

		testUsers[i] = testUser
		plainPasswords[i] = plainPassword

		// Setup mock for this user
		mockRepo.On("FindUserByEmail", mock.Anything, testUser.Email).Return(testUser, nil)
	}

	// Generate test data
	loginRequests := make([]*authRequest.AuthRequest, b.N)
	for i := 0; i < b.N; i++ {
		userIndex := i % numUsers
		loginRequests[i] = authRequest.NewAuthRequest(testUsers[userIndex].Email, plainPasswords[userIndex])
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = authService.Login(ctx, loginRequests[i])
	}
}

// BenchmarkAuthService_Login_MemoryAllocation tests memory allocation patterns
func BenchmarkAuthService_Login_MemoryAllocation(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Create test user
	testUser := getNewUserBench()
	plainPassword := testUser.Password

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		b.Fatal(err)
	}
	testUser.Password = string(hashedPassword)

	// Setup mock responses
	mockRepo.On("FindUserByEmail", mock.Anything, mock.AnythingOfType("string")).Return(testUser, nil)

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		loginRequest := authRequest.NewAuthRequest(testUser.Email, plainPassword)
		_, _ = authService.Login(ctx, loginRequest)
	}
}

// BenchmarkAuthService_Login_HighConcurrency tests performance under high concurrent load
func BenchmarkAuthService_Login_HighConcurrency(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Create test users for high concurrency
	numUsers := 50
	testUsers := make([]*user.User, numUsers)
	plainPasswords := make([]string, numUsers)

	for i := 0; i < numUsers; i++ {
		testUser := getNewUserBench()
		plainPassword := testUser.Password

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
		if err != nil {
			b.Fatal(err)
		}
		testUser.Password = string(hashedPassword)

		testUsers[i] = testUser
		plainPasswords[i] = plainPassword

		// Setup mock for this user
		mockRepo.On("FindUserByEmail", mock.Anything, testUser.Email).Return(testUser, nil)
	}

	b.SetParallelism(10) // High concurrency

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userIndex := i % numUsers
			loginRequest := authRequest.NewAuthRequest(testUsers[userIndex].Email, plainPasswords[userIndex])
			_, _ = authService.Login(ctx, loginRequest)
			i++
		}
	})
}

// BenchmarkAuthService_Login_BatchOperations tests batch authentication operations
func BenchmarkAuthService_Login_BatchOperations(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Create test users
	numUsers := 20
	testUsers := make([]*user.User, numUsers)
	plainPasswords := make([]string, numUsers)

	for i := 0; i < numUsers; i++ {
		testUser := getNewUserBench()
		plainPassword := testUser.Password

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
		if err != nil {
			b.Fatal(err)
		}
		testUser.Password = string(hashedPassword)

		testUsers[i] = testUser
		plainPasswords[i] = plainPassword

		// Setup mock for this user
		mockRepo.On("FindUserByEmail", mock.Anything, testUser.Email).Return(testUser, nil)
	}

	batchSizes := []int{1, 5, 10, 20}

	for _, batchSize := range batchSizes {
		b.Run(fmt.Sprintf("BatchSize%d", batchSize), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				// Process batch of login requests
				for j := 0; j < batchSize; j++ {
					userIndex := j % numUsers
					loginRequest := authRequest.NewAuthRequest(testUsers[userIndex].Email, plainPasswords[userIndex])
					_, _ = authService.Login(ctx, loginRequest)
				}
			}
		})
	}
}

// BenchmarkAuthService_Login_PasswordComplexity tests authentication with different password complexities
func BenchmarkAuthService_Login_PasswordComplexity(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Different password complexities
	passwordTypes := []struct {
		name     string
		password string
	}{
		{"Simple", "password123"},
		{"Medium", "MyP@ssw0rd123"},
		{"Complex", "MyV3ryC0mpl3x!P@ssw0rd#2023$"},
		{"VeryComplex", "Th1s!s@V3ryC0mpl3xP@ssw0rd#W1th$p3c1@lCh@r@ct3rs&Numbers123"},
	}

	for _, passwordType := range passwordTypes {
		testUser := getNewUserBench()
		plainPassword := passwordType.password

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
		if err != nil {
			b.Fatal(err)
		}
		testUser.Password = string(hashedPassword)

		// Setup mock for this user
		mockRepo.On("FindUserByEmail", mock.Anything, testUser.Email).Return(testUser, nil)

		b.Run(fmt.Sprintf("Password%s", passwordType.name), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				loginRequest := authRequest.NewAuthRequest(testUser.Email, plainPassword)
				_, _ = authService.Login(ctx, loginRequest)
			}
		})
	}
}

// BenchmarkAuthService_Login_BCryptCosts tests authentication with different bcrypt costs
func BenchmarkAuthService_Login_BCryptCosts(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Different bcrypt costs
	bcryptCosts := []int{bcrypt.MinCost, bcrypt.DefaultCost, bcrypt.DefaultCost + 2}

	for _, cost := range bcryptCosts {
		testUser := getNewUserBench()
		plainPassword := testUser.Password

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), cost)
		if err != nil {
			b.Fatal(err)
		}
		testUser.Password = string(hashedPassword)

		// Setup mock for this user
		mockRepo.On("FindUserByEmail", mock.Anything, testUser.Email).Return(testUser, nil)

		b.Run(fmt.Sprintf("BCryptCost%d", cost), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				loginRequest := authRequest.NewAuthRequest(testUser.Email, plainPassword)
				_, _ = authService.Login(ctx, loginRequest)
			}
		})
	}
}

// BenchmarkAuthService_Login_ConcurrentUsers tests concurrent authentication for different users
func BenchmarkAuthService_Login_ConcurrentUsers(b *testing.B) {
	mockRepo := &MockUserRepositoryBench{}
	authService := NewAuthService(mockRepo)
	ctx := context.Background()

	// Create multiple test users for concurrent access
	numUsers := 1000
	testUsers := make([]*user.User, numUsers)
	plainPasswords := make([]string, numUsers)

	for i := 0; i < numUsers; i++ {
		testUser := getNewUserBench()
		plainPassword := testUser.Password

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.MinCost) // Use min cost for faster benchmarking
		if err != nil {
			b.Fatal(err)
		}
		testUser.Password = string(hashedPassword)

		testUsers[i] = testUser
		plainPasswords[i] = plainPassword

		// Setup mock for this user
		mockRepo.On("FindUserByEmail", mock.Anything, testUser.Email).Return(testUser, nil)
	}

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userIndex := i % numUsers
			loginRequest := authRequest.NewAuthRequest(testUsers[userIndex].Email, plainPasswords[userIndex])
			_, _ = authService.Login(ctx, loginRequest)
			i++
		}
	})
}

func init() {
	// Ensure mock is properly initialized for benchmarks
}
