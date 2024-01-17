package dto

type UserRequest struct {
	Name     string `json:"name"`
	LastName string `json:"last_name"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

func NewUserRequest(name, lastName, password, email string) *UserRequest {
	return &UserRequest{
		Name:     name,
		LastName: lastName,
		Email:    email,
		Password: password,
	}
}
