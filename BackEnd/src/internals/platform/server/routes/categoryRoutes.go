package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/category"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/category"
)

func CategoryRoutes(s *gin.Engine, categoryService *category.CategoryServices) {
	s.POST("/category", handler.CreateCategory(categoryService))
	s.GET("/category", handler.FindAllCategorys(categoryService))
	s.DELETE("/category/:id", handler.DeleteCategory(categoryService))
}
