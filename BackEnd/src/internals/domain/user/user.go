package user

import "time"

type User struct {
	CreatedAt  time.Time `json:"created_at"`
	Id         string    `json:"id"`
	Name       string    `json:"name"`
	LastName   string    `json:"last_name"`
	Email      string    `json:"email"`
	Password   string    `json:"password"`
	Token      string    `json:"token"`
	Confirmend string    `json:"confirmend"`
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
