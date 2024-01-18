package category

import "time"

type Category struct {
	CreatedAt time.Time `json:"created_at"`
	Id        string    `json:"id"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	Color     string    `json:"color"`
	UserId    string    `json:"user_id"`
}

func NewCategory(id, name, icon, color string) *Category {
	return &Category{
		Id:    id,
		Name:  name,
		Icon:  icon,
		Color: color,
	}
}
