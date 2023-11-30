package user

import "time"

type User struct {
	Id         string    `json:"id"`
	Name       string    `json:"name"`
	LastName   string    `json:"last_name"`
	Email      string    `json:"email"`
	Password   string    `json:"password"`
	Token      string    `json:"token"`
	Confirmend string    `json:"confirmend"`
	CreatedAt  time.Time `json:"created_at"`
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
