package dto

type CategoryRequest struct {
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

func NewCategoryRequest(name, icon, color string) *CategoryRequest {
	return &CategoryRequest{
		Name:  name,
		Icon:  icon,
		Color: color,
	}
}
