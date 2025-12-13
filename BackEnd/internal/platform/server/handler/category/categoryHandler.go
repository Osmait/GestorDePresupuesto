package category

import (
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/category"
	errorHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/internal/services/category"
)

// CreateCategory godoc
//
//	@Summary		Create a new category
//	@Description	Create a new expense/income category for the authenticated user
//	@Tags			Categories
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			category	body		dto.CategoryRequest	true	"Category creation data"
//	@Success		201			{object}	map[string]string	"Category created successfully"
//	@Failure		400			{object}	map[string]string	"Bad request - Invalid input"
//	@Failure		401			{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		500			{object}	map[string]string	"Internal server error"
//	@Router			/category [post]
func CreateCategory(categoryServices *category.CategoryServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		var categoryRequest dto.CategoryRequest
		userId := c.GetString("X-User-Id")
		err := c.Bind(&categoryRequest)
		if err != nil {
			c.JSON(http.StatusBadRequest, err)
			return
		}
		err = categoryServices.CreateCategory(c, &categoryRequest, userId)

		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusCreated, "created")
	}
}

// FindAllCategories godoc
//
//	@Summary		Get all user categories
//	@Description	Retrieve all categories for the authenticated user
//	@Tags			Categories
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Success		200	{array}		dto.CategoryResponse	"List of user categories"
//	@Failure		401	{object}	map[string]string		"Unauthorized - Invalid JWT token"
//	@Failure		500	{object}	map[string]string		"Internal server error"
//	@Router			/category [get]
func FindAllCategories(categoryServices *category.CategoryServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetString("X-User-Id")
		categorys, err := categoryServices.FindAll(c, userId)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, categorys)
	}
}

// DeleteCategory godoc
//
//	@Summary		Delete a category
//	@Description	Delete a specific category by ID
//	@Tags			Categories
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id	path		string				true	"Category ID"
//	@Success		200	{object}	map[string]string	"Category deleted successfully"
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		404	{object}	map[string]string	"Category not found"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/category/{id} [delete]
func DeleteCategory(categoryServices *category.CategoryServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		userId := c.GetString("X-User-Id")
		err := categoryServices.Delete(c, id, userId)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, "Deleted")
	}
}
