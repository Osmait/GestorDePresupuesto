package dto

import "time"

type CategoryResponse struct {
	CreatedAt time.Time `json:"created_at"`
	Id        string    `json:"id"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	Color     string    `json:"color"`
}

func NewCategoryResponse(id, name, icon, color string, createdAt time.Time) *CategoryResponse {
	return &CategoryResponse{
		Id:        id,
		Name:      name,
		Icon:      icon,
		Color:     color,
		CreatedAt: createdAt,
	}
}
