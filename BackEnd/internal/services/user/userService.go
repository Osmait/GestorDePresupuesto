package user

import (
	"context"
	"fmt"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/segmentio/ksuid"
	"golang.org/x/crypto/bcrypt"
)

// UserService handles business logic related to user management.
type UserService struct {
	userRepository userRepo.UserRepositoryInterface
}

// NewUserService creates a new instance of UserService.
func NewUserService(userRepo userRepo.UserRepositoryInterface) *UserService {
	return &UserService{
		userRepository: userRepo,
	}
}

// CreateUser registers a new user in the system after validating the request and hashing the password.
func (u *UserService) CreateUser(ctx context.Context, userRequest *dto.UserRequest) error {
	// Use safe call to prevent panics
	return apperrors.SafeCall(ctx, "CreateUser", func() error {
		// Check for duplicate user with wrapped error handling
		existingUser, err := u.userRepository.FindUserByEmail(ctx, userRequest.Email)
		if err != nil && !errorhttp.IsErrNotFound(err) {
			return apperrors.WrapDatabaseError(ctx, err, "FindUserByEmail")
		}

		if existingUser != nil {
			return apperrors.NewConflictError("user", "email already exists").
				WithContext(ctx).
				WithOperation("CreateUser").
				WithDetails(map[string]interface{}{
					"email": userRequest.Email,
				})
		}

		// Hash password with error handling
		hashPassword, err := utils.HashPassword(userRequest.Password)
		if err != nil {
			return apperrors.WrapError(ctx, err, "CreateUser", "failed to hash password")
		}

		// Generate ID with error handling
		id, err := ksuid.NewRandom()
		if err != nil {
			return apperrors.WrapError(ctx, err, "CreateUser", "failed to generate user ID")
		}

		// Create user domain object
		userToSave := user.NewUser(id.String(), userRequest.Name, userRequest.LastName, userRequest.Email, hashPassword)

		// Save user with wrapped error handling
		if err := u.userRepository.Save(ctx, userToSave); err != nil {
			return apperrors.WrapDatabaseError(ctx, err, "Save user")
		}

		return nil
	})
}

func (u *UserService) FindByEmail(ctx context.Context, email string) (*dto.UserResponse, error) {
	// Use safe call with result to prevent panics
	return apperrors.SafeCallWithResult(ctx, "FindByEmail", func() (*dto.UserResponse, error) {
		// Input validation
		if email == "" {
			return nil, apperrors.NewValidationError("INVALID_EMAIL", "email is required").
				WithContext(ctx).
				WithOperation("FindByEmail").
				WithDetails(map[string]interface{}{
					"field": "email",
				})
		}

		// Find user with error handling
		foundUser, err := u.userRepository.FindUserByEmail(ctx, email)
		if err != nil {
			if errorhttp.IsErrNotFound(err) {
				return nil, apperrors.NewNotFoundError("user", email).
					WithContext(ctx).
					WithOperation("FindByEmail")
			}
			return nil, apperrors.WrapDatabaseError(ctx, err, "FindUserByEmail")
		}

		// Additional validation
		if foundUser.Id == "" || foundUser.Email != email {
			return nil, apperrors.NewNotFoundError("user", email).
				WithContext(ctx).
				WithOperation("FindByEmail")
		}

		// Create response
		userResponse := dto.NewUserResponse(foundUser.Id, foundUser.Name, foundUser.LastName, foundUser.Email, foundUser.Role, foundUser.CreatedAt)
		return userResponse, nil
	})
}

// GetUser retrieves a user's details by their ID.
func (u *UserService) GetUser(ctx context.Context, id string) (*dto.UserResponse, error) {
	return u.FindUserById(ctx, id)
}

func (u *UserService) FindUserById(ctx context.Context, id string) (*dto.UserResponse, error) {
	// Use safe call with result to prevent panics
	return apperrors.SafeCallWithResult(ctx, "FindUserById", func() (*dto.UserResponse, error) {
		// Input validation
		if id == "" {
			return nil, apperrors.NewValidationError("INVALID_ID", "user ID is required").
				WithContext(ctx).
				WithOperation("FindUserById").
				WithDetails(map[string]interface{}{
					"field": "id",
				})
		}

		// Find user with error handling
		foundUser, err := u.userRepository.FindUserById(ctx, id)
		if err != nil {
			if errorhttp.IsErrNotFound(err) {
				return nil, apperrors.NewNotFoundError("user", id).
					WithContext(ctx).
					WithOperation("FindUserById")
			}
			return nil, apperrors.WrapDatabaseError(ctx, err, "FindUserById")
		}

		// Additional validation
		if foundUser.Id == "" || foundUser.Id != id {
			return nil, apperrors.NewNotFoundError("user", id).
				WithContext(ctx).
				WithOperation("FindUserById")
		}

		// Create response
		userResponse := dto.NewUserResponse(foundUser.Id, foundUser.Name, foundUser.LastName, foundUser.Email, foundUser.Role, foundUser.CreatedAt)
		return userResponse, nil
	})
}

// DeleteUser removes a user from the system by their ID.
func (u *UserService) DeleteUser(ctx context.Context, id string) error {
	// Use safe call to prevent panics
	return apperrors.SafeCall(ctx, "DeleteUser", func() error {
		// Input validation
		if id == "" {
			return apperrors.NewValidationError("INVALID_ID", "user ID is required").
				WithContext(ctx).
				WithOperation("DeleteUser").
				WithDetails(map[string]interface{}{
					"field": "id",
				})
		}

		// Check if user exists
		foundUser, err := u.userRepository.FindUserById(ctx, id)
		if err != nil {
			if errorhttp.IsErrNotFound(err) {
				return apperrors.NewNotFoundError("user", id).
					WithContext(ctx).
					WithOperation("DeleteUser")
			}
			return apperrors.WrapDatabaseError(ctx, err, "FindUserById for deletion")
		}

		if foundUser.Id == "" {
			return apperrors.NewNotFoundError("user", id).
				WithContext(ctx).
				WithOperation("DeleteUser")
		}

		// Delete user with error handling
		if err := u.userRepository.Delete(ctx, id); err != nil {
			return apperrors.WrapDatabaseError(ctx, err, "Delete user")
		}

		return nil
	})
}

// UpdateUser modifies an existing user's information.
func (u *UserService) UpdateUser(ctx context.Context, id string, userRequest *dto.UserRequest) error {
	return apperrors.SafeCall(ctx, "UpdateUser", func() error {
		// Input validation
		if id == "" {
			return apperrors.NewValidationError("INVALID_ID", "user ID is required").
				WithContext(ctx).
				WithOperation("UpdateUser").
				WithDetails(map[string]interface{}{
					"field": "id",
				})
		}

		// Check if user exists
		existingUser, err := u.userRepository.FindUserById(ctx, id)
		if err != nil {
			if errorhttp.IsErrNotFound(err) {
				return apperrors.NewNotFoundError("user", id).
					WithContext(ctx).
					WithOperation("UpdateUser")
			}
			return apperrors.WrapDatabaseError(ctx, err, "FindUserById for update")
		}

		if existingUser.Id == "" {
			return apperrors.NewNotFoundError("user", id).
				WithContext(ctx).
				WithOperation("UpdateUser")
		}

		// Check for email conflicts if email is being changed
		if userRequest.Email != "" && userRequest.Email != existingUser.Email {
			duplicateUser, err := u.userRepository.FindUserByEmail(ctx, userRequest.Email)
			if err != nil && !errorhttp.IsErrNotFound(err) {
				return apperrors.WrapDatabaseError(ctx, err, "FindUserByEmail for update")
			}

			if duplicateUser != nil && duplicateUser.Id != id {
				return apperrors.NewConflictError("user", "email already exists").
					WithContext(ctx).
					WithOperation("UpdateUser").
					WithDetails(map[string]interface{}{
						"email":        userRequest.Email,
						"existing_id":  duplicateUser.Id,
						"requested_id": id,
					})
			}
		}

		// Update user fields
		if userRequest.Name != "" {
			existingUser.Name = userRequest.Name
		}
		if userRequest.LastName != "" {
			existingUser.LastName = userRequest.LastName
		}
		if userRequest.Email != "" {
			existingUser.Email = userRequest.Email
		}

		// Hash new password if provided
		if userRequest.Password != "" {
			hashPassword, err := bcrypt.GenerateFromPassword([]byte(userRequest.Password), bcrypt.DefaultCost)
			if err != nil {
				return apperrors.WrapError(ctx, err, "UpdateUser", "failed to hash password")
			}
			existingUser.Password = string(hashPassword)
		}

		// Save updated user
		if err := u.userRepository.Update(ctx, existingUser); err != nil {
			return apperrors.WrapDatabaseError(ctx, err, "Update user")
		}

		return nil
	})
}

// BatchUpdateUsers updates multiple users in a single operation.
func (u *UserService) BatchUpdateUsers(ctx context.Context, updates []dto.UserResponse) error {
	return apperrors.SafeCall(ctx, "BatchUpdateUsers", func() error {
		for _, update := range updates {
			// Find existing user
			existingUser, err := u.userRepository.FindUserById(ctx, update.Id)
			if err != nil {
				return apperrors.WrapDatabaseError(ctx, err, fmt.Sprintf("FindUserById for batch update: %s", update.Id))
			}

			// Update fields
			existingUser.Name = update.Name
			existingUser.LastName = update.LastName
			existingUser.Email = update.Email
			existingUser.Role = update.Role

			// Save change
			if err := u.userRepository.Update(ctx, existingUser); err != nil {
				return apperrors.WrapDatabaseError(ctx, err, fmt.Sprintf("Update user in batch: %s", update.Id))
			}
		}
		return nil
	})
}

// GetUserWithRetry demonstrates retry pattern with error handling
func (u *UserService) GetUserWithRetry(ctx context.Context, id string) (*dto.UserResponse, error) {
	var result *dto.UserResponse
	var err error

	// Retry with exponential backoff
	retryErr := apperrors.RetryWithBackoff(ctx, "GetUserWithRetry", 3, 100, func() error {
		result, err = u.FindUserById(ctx, id)
		return err
	})

	if retryErr != nil {
		return nil, apperrors.WrapError(ctx, retryErr, "GetUserWithRetry",
			fmt.Sprintf("failed to get user after retries: %s", id))
	}

	return result, nil
}

// DeleteDemoUsers deletes demo users older than the specified retention duration.
// If retention is 0, it deletes all demo users created before now.
func (u *UserService) DeleteDemoUsers(ctx context.Context, retention time.Duration) error {
	olderThan := time.Now().Add(-retention)
	return u.userRepository.DeleteDemoUsersOlderThan(ctx, olderThan)
}

// GetAllUsers retrieves all users from the database and returns them as UserResponse DTOs.
func (u *UserService) GetAllUsers(ctx context.Context) ([]*dto.UserResponse, error) {
	return apperrors.SafeCallWithResult(ctx, "GetAllUsers", func() ([]*dto.UserResponse, error) {
		users, err := u.userRepository.FindAll(ctx)
		if err != nil {
			return nil, apperrors.WrapDatabaseError(ctx, err, "FindAll users")
		}

		var response []*dto.UserResponse
		for _, user := range users {
			response = append(response, dto.NewUserResponse(user.Id, user.Name, user.LastName, user.Email, user.Role, user.CreatedAt))
		}
		return response, nil
	})
}
