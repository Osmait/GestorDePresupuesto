package authRequest

type AuthRequest struct {
	Email    string `json:"email" example:"user@example.com"`
	Password string `json:"password" example:"mySecurePassword123"`
}

func NewAuthRequest(email, password string) *AuthRequest {
	return &AuthRequest{
		Email:    email,
		Password: password,
	}
}
