package category

import "time"

type Category struct {
	Id        string    `json:"id"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	CreatedAt time.Time `json:"created_at"`
}

func NewCategory(id, name, icon string) *Category {
	return &Category{
		Id:   id,
		Name: name,
		Icon: icon,
	}
}
