package user

import "time"

type User struct {
	CreatedAt time.Time `json:"created_at"`
	Id        string    `json:"id"`
	Name      string    `json:"name"`
	LastName  string    `json:"last_name"`
	Email     string    `json:"email"`
	Password  string    `json:"password"`
	Token     string    `json:"token"`
	Confirmed string    `json:"confirmed"`
	IsDemo    bool      `json:"is_demo"`
}

func NewUser(id, name, lastName, email, password string) *User {
	return &User{
		Id:       id,
		Name:     name,
		LastName: lastName,
		Password: password,
		Email:    email,
	}
}
