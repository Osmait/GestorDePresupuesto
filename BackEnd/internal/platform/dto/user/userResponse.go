package dto

import "time"

type UserResponse struct {
	CreatedAt time.Time `json:"created_at"`
	Id        string    `json:"id"`
	Name      string    `json:"name"`
	LastName  string    `json:"last_name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
}

func NewUserResponse(id, name, lastName, email, role string, createdAt time.Time) *UserResponse {
	return &UserResponse{
		Id:        id,
		Name:      name,
		LastName:  lastName,
		Email:     email,
		Role:      role,
		CreatedAt: createdAt,
	}
}
