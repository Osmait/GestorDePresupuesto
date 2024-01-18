package user

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
	dto "github.com/osmait/gestorDePresupuesto/src/internals/platform/dto/user"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/errorhttp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
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
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
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

func TestCreateUser(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	user1 := utils.GetNewRandomUser()
	userRequest := dto.NewUserRequest(user1.Name, user1.LastName, user1.Email, user1.Password)
	mockRepo.On("FindUserByEmail", context.Background(), userRequest.Email).Return(nil, errorhttp.ErrNotFound)
	mockRepo.On("Save", context.Background(), mock.AnythingOfType("*user.User")).Return(nil)
	userServie := NewUserService(mockRepo)
	err := userServie.CreateUser(context.Background(), userRequest)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestCreateUserErrorDuplicateEmail(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userServie := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	userRequest := dto.NewUserRequest(user1.Name, user1.LastName, user1.Email, user1.Password)
	mockRepo.On("FindUserByEmail", context.Background(), mock.Anything).Return(user1, nil)
	mockRepo.On("Save", context.Background(), mock.AnythingOfType("*user.User")).Return(nil)
	err := userServie.CreateUser(context.Background(), userRequest)
	assert.Error(t, err)
}

func TestFindUser(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", context.Background(), mock.Anything).Return(user1, nil)
	_, err := userService.FindUserById(context.Background(), "1")
	assert.Error(t, err)
	assert.Equal(t, err, errorhttp.ErrNotFound)

	mockRepo.AssertExpectations(t)
}

func TestFindUserByErrorNotFond(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()

	mockRepo.On("FindUserById", context.Background(), mock.Anything).Return(user1, nil)
	Result, err := userService.FindUserById(context.Background(), user1.Id)
	assert.NoError(t, err)
	assert.Equal(t, user1.Id, Result.Id)

	mockRepo.AssertExpectations(t)
}

func TestFindUserByError(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	user1.Id = ""
	mockRepo.On("FindUserById", context.Background(), mock.Anything).Return(user1, nil)
	_, err := userService.FindUserById(context.Background(), "1")
	assert.Error(t, err)

	mockRepo.AssertExpectations(t)
}

func TestFindUserByEmail(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	UserService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	mockRepo.On("FindUserByEmail", context.Background(), mock.Anything).Return(user1, nil)
	result, err := UserService.FindByEmail(context.Background(), user1.Email)
	assert.NoError(t, err)
	assert.Equal(t, user1.Id, result.Id)
	mockRepo.AssertExpectations(t)
}

func TestFindUserByEmailError(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	UserService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	mockRepo.On("FindUserByEmail", context.Background(), mock.Anything).Return(user1, nil)
	_, err := UserService.FindByEmail(context.Background(), "test@test.com")
	assert.Error(t, err)
	assert.Equal(t, errorhttp.ErrNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestDeleteUser(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	UserService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	mockRepo.On("FindUserById", context.Background(), mock.Anything).Return(user1, nil)
	mockRepo.On("Delete", context.Background(), mock.Anything).Return(nil)
	err := UserService.DeleteUser(context.Background(), user1.Id)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestDeleteUserError(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	UserService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	user1.Id = ""
	mockRepo.On("FindUserById", context.Background(), mock.Anything).Return(user1, nil)
	mockRepo.On("Delete", context.Background(), mock.Anything).Return(nil)
	err := UserService.DeleteUser(context.Background(), user1.Id)
	assert.Error(t, err)
	assert.Equal(t, errorhttp.ErrNotFound, err)
}
