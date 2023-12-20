package authRequest

type AuthRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func NewAuthRequest(email, password string) *AuthRequest {
	return &AuthRequest{
		Email:    email,
		Password: password,
	}
}
