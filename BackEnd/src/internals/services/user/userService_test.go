package user

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-faker/faker/v4"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockUserRepostory struct {
	mock.Mock
}

func (m *MockUserRepostory) FindUser(ctx context.Context, id string) (*user.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepostory) FindUserByEmail(ctx context.Context, email string) (*user.User, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepostory) CreateUser(ctx context.Context, user *user.User) error {
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

func TestCreateUser(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userServie := NewUserService(mockRepo)
	user1 := getNewUser()
	fmt.Println(user1)
	mockRepo.On("CreateUser", context.Background(), mock.AnythingOfType("*user.User")).Return(nil)
	err := userServie.CreateUser(context.Background(), user1)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestFindUser(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)
	user1 := getNewUser()
	mockRepo.On("FindUser", context.Background(), mock.Anything).Return(user1, nil)
	Result, err := userService.FindUserById(context.Background(), user1.Id)
	assert.NoError(t, err)
	assert.Equal(t, user1, Result)

	mockRepo.AssertExpectations(t)
}

func TestFindUserByEmail(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	UserService := NewUserService(mockRepo)
	user1 := getNewUser()
	mockRepo.On("FindUserByEmail", context.Background(), mock.Anything).Return(user1, nil)
	result, err := UserService.FindUserByEmail(context.Background(), user1.Email)
	assert.NoError(t, err)
	assert.Equal(t, user1, result)
	mockRepo.AssertExpectations(t)
}

func TestDeleteUser(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	UserService := NewUserService(mockRepo)
	mockRepo.On("Delete", context.Background(), mock.Anything).Return(nil)
	err := UserService.DeleteUser(context.Background(), "1")
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}
