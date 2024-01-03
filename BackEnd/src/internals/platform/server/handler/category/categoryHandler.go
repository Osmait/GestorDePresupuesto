package category

import (
	"net/http"

	"github.com/gin-gonic/gin"
	categoryDomain "github.com/osmait/gestorDePresupuesto/src/internals/domain/category"
	errorHandler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/category"
)

func CreateCategory(categoryServices *category.CategoryServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		var category categoryDomain.Category
		err := c.Bind(&category)
		if err != nil {
			c.JSON(http.StatusBadRequest, err)
			return
		}
		err = categoryServices.CreateCategory(c, &category)

		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusCreated, "created")
	}
}

func FindAllCategorys(categoryServices *category.CategoryServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetString("X-user-Id")
		categorys, err := categoryServices.FindAll(c, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, categorys)
	}
}

func DeleteCategory(categoryServices *category.CategoryServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		err := categoryServices.Delete(c, id)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, "Deleted")
	}
}
