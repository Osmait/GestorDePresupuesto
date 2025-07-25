package dto

import "time"

type CategoryResponse struct {
	CreatedAt time.Time `json:"created_at" example:"2024-01-15T10:30:00Z"`
	Id        string    `json:"id" example:"cat_123456789"`
	Name      string    `json:"name" example:"Food & Dining"`
	Icon      string    `json:"icon" example:"🍔"`
	Color     string    `json:"color" example:"#FF6B6B"`
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
