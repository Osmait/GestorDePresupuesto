package auth

import (
	"context"
	"testing"

	"github.com/go-faker/faker/v4"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	authRequest "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/crypto/bcrypt"
)

type MockUserRepostory struct {
	mock.Mock
}

func (m *MockUserRepostory) FindUserById(ctx context.Context, id string) (*user.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepostory) FindUserByEmail(ctx context.Context, email string) (*user.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepostory) FindUserByIp(ctx context.Context, ip string) (*user.User, error) {
	args := m.Called(ctx, ip)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepostory) Save(ctx context.Context, user *user.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepostory) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func getNewUser() *user.User {
	user1 := user.NewUser(faker.ID, faker.Name(), faker.LastName(), faker.Email(), faker.Password())
	return user1
}

func getTestConfig() *config.Config {
	return &config.Config{
		JWT: config.JWTConfig{
			Secret: "test-secret-key-for-testing",
		},
	}
}

func TestAuthServices(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	testConfig := getTestConfig()
	authService := NewAuthService(mockRepo, nil, nil, nil, nil, testConfig)

	user1 := getNewUser()
	passwor := user1.Password

	hashPassword, err := bcrypt.GenerateFromPassword([]byte(user1.Password), bcrypt.DefaultCost)
	if err != nil {
		return
	}
	user1.Password = string(hashPassword)
	mockRepo.On("FindUserByEmail", context.Background(), mock.Anything).Return(user1, nil)
	loginRequest := authRequest.NewAuthRequest(user1.Email, passwor)
	_, err = authService.Login(context.Background(), loginRequest)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}
