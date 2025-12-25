package dto

import (
	"testing"

	"github.com/go-playground/assert/v2"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

func TestUserRequest(t *testing.T) {
	user := utils.GetNewRandomUser()
	userRequest := NewUserRequest(user.Name, user.LastName, user.Password, user.Email)
	assert.Equal(t, userRequest.Email, user.Email)
	assert.Equal(t, userRequest.Name, user.Name)
	assert.Equal(t, userRequest.LastName, user.LastName)
	assert.Equal(t, userRequest.Password, user.Password)
}

func TestUserResponse(t *testing.T) {
	user := utils.GetNewRandomUser()
	userRequest := NewUserResponse(user.Id, user.Name, user.LastName, user.Email, user.Role, user.CreatedAt)
	assert.Equal(t, userRequest.Email, user.Email)
	assert.Equal(t, userRequest.Name, user.Name)
	assert.Equal(t, userRequest.LastName, user.LastName)
	assert.Equal(t, userRequest.Id, user.Id)
	assert.Equal(t, userRequest.CreatedAt, user.CreatedAt)
}
