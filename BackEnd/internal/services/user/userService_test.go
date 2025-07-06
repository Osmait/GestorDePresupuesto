package user

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	appErrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
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
	assert.True(t, appErrors.IsErrorType(err, appErrors.ErrorTypeNotFound))
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
	assert.True(t, appErrors.IsErrorType(err, appErrors.ErrorTypeNotFound))
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
	assert.True(t, appErrors.IsErrorType(err, appErrors.ErrorTypeValidation))
}

// Additional test cases for better coverage

func TestCreateUser_RepositoryError(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	userRequest := dto.NewUserRequest(user1.Name, user1.LastName, user1.Email, user1.Password)

	// Mock repository error on FindUserByEmail
	mockRepo.On("FindUserByEmail", context.Background(), userRequest.Email).Return(nil, errors.New("database error"))

	err := userService.CreateUser(context.Background(), userRequest)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "database error")
	assert.Contains(t, err.Error(), "Database operation failed")
	mockRepo.AssertExpectations(t)
}

func TestCreateUser_SaveRepositoryError(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()
	userRequest := dto.NewUserRequest(user1.Name, user1.LastName, user1.Email, user1.Password)

	mockRepo.On("FindUserByEmail", context.Background(), userRequest.Email).Return(nil, errorhttp.ErrNotFound)
	mockRepo.On("Save", context.Background(), mock.AnythingOfType("*user.User")).Return(errors.New("save error"))

	err := userService.CreateUser(context.Background(), userRequest)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "save error")
	assert.Contains(t, err.Error(), "Database operation failed")
	mockRepo.AssertExpectations(t)
}

func TestFindByEmail_RepositoryError(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)

	mockRepo.On("FindUserByEmail", context.Background(), mock.Anything).Return((*user.User)(nil), errors.New("database error"))

	_, err := userService.FindByEmail(context.Background(), "test@test.com")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "database error")
	assert.Contains(t, err.Error(), "Database operation failed")
	mockRepo.AssertExpectations(t)
}

func TestDeleteUser_FindUserError(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)

	mockRepo.On("FindUserById", context.Background(), mock.Anything).Return((*user.User)(nil), errors.New("find error"))

	err := userService.DeleteUser(context.Background(), "test-id")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "find error")
	assert.Contains(t, err.Error(), "Database operation failed")
	mockRepo.AssertExpectations(t)
}

func TestDeleteUser_DeleteRepositoryError(t *testing.T) {
	mockRepo := &MockUserRepostory{}
	userService := NewUserService(mockRepo)
	user1 := utils.GetNewRandomUser()

	mockRepo.On("FindUserById", context.Background(), mock.Anything).Return(user1, nil)
	mockRepo.On("Delete", context.Background(), mock.Anything).Return(errors.New("delete error"))

	err := userService.DeleteUser(context.Background(), user1.Id)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "delete error")
	assert.Contains(t, err.Error(), "Database operation failed")
	mockRepo.AssertExpectations(t)
}
