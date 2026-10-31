package user

import "time"

// The roles a user can have.
const (
	RoleUser  = "USER"
	RoleAdmin = "ADMIN"
)

type User struct {
	CreatedAt time.Time  `json:"created_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
	Id        string     `json:"id"`
	Name      string     `json:"name"`
	LastName  string     `json:"last_name"`
	Email     string     `json:"email"`
	Password  string     `json:"password"`
	Token     string     `json:"token"`
	Confirmed bool       `json:"confirmed"`
	IsDemo    bool       `json:"is_demo"`
	IpAddress string     `json:"ip_address,omitempty"`
	Role      string     `json:"role"`
}

func NewUser(id, name, lastName, email, password string) *User {
	return &User{
		Id:        id,
		Name:      name,
		LastName:  lastName,
		Password:  password,
		Email:     email,
		Role:      RoleUser,
		Confirmed: false,
	}
}
