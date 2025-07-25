package dto

type CategoryRequest struct {
	Name  string `json:"name" validate:"required,min=2,max=50" binding:"required" example:"Food & Dining"`
	Icon  string `json:"icon" validate:"required,min=1,max=50" binding:"required" example:"🍔"`
	Color string `json:"color" validate:"required,min=4,max=7" binding:"required" example:"#FF6B6B"`
}

func NewCategoryRequest(name, icon, color string) *CategoryRequest {
	return &CategoryRequest{
		Name:  name,
		Icon:  icon,
		Color: color,
	}
}
