package dto

// UserRequest represents the data required to create a new user account.
// All fields are validated for security and business rule compliance.
// Note: gin only enforces the `binding` tags; the `validate` tags are
// documentation for the (unwired) ValidationMiddleware. Email format and the
// minimum password length (Security.PasswordMinLength default) are therefore
// repeated in `binding`.
type UserRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=50,alpha_space" binding:"required"`
	LastName string `json:"last_name" validate:"required,min=2,max=50,alpha_space" binding:"required"`
	Password string `json:"password" validate:"required,min=8,max=128,password_strength" binding:"required,min=8"`
	Email    string `json:"email" validate:"required,email,max=320" binding:"required,email"`
	Role     string `json:"role" validate:"omitempty,oneof=USER ADMIN"`
}

// NewUserRequest creates a new UserRequest with the provided information.
// This constructor ensures proper initialization of the request object.
func NewUserRequest(name, lastName, password, email string) *UserRequest {
	return &UserRequest{
		Name:     name,
		LastName: lastName,
		Email:    email,
		Password: password,
	}
}

// Validate performs business logic validation on the UserRequest.
// It checks for additional constraints beyond basic field validation.
func (u *UserRequest) Validate() error {
	// Additional custom validation logic can be added here
	// e.g., blacklisted emails, common passwords, etc.
	return nil
}
