package monthlyPlanHandler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/monthly_plan"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/monthly_plan"
)

// CreateItem godoc
//
//	@Summary		Create a monthly plan item
//	@Description	Add a fixed monthly expense or an expected income to the authenticated user's plan
//	@Tags			MonthlyPlan
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			item	body		dto.MonthlyPlanItemRequest	true	"Monthly plan item data"
//	@Success		201		{object}	map[string]string			"Item created successfully"
//	@Failure		400		{object}	map[string]string			"Bad request - Invalid input"
//	@Failure		401		{object}	map[string]string			"Unauthorized - Invalid JWT token"
//	@Failure		500		{object}	map[string]string			"Internal server error"
//	@Router			/monthly-plan [post]
func CreateItem(service *monthly_plan.MonthlyPlanService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req dto.MonthlyPlanItemRequest

		userID := c.GetString("X-User-Id")
		if err := c.ShouldBindJSON(&req); err != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_JSON", err.Error()))
			return
		}

		if err := service.Create(c, &req, userID); err != nil {
			_ = c.Error(err)
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "created"})
	}
}

// FindAllItems godoc
//
//	@Summary		Get the monthly plan
//	@Description	Retrieve every fixed expense and expected income of the authenticated user
//	@Tags			MonthlyPlan
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Success		200	{array}		dto.MonthlyPlanItemResponse	"List of monthly plan items"
//	@Failure		401	{object}	map[string]string			"Unauthorized - Invalid JWT token"
//	@Failure		500	{object}	map[string]string			"Internal server error"
//	@Router			/monthly-plan [get]
func FindAllItems(service *monthly_plan.MonthlyPlanService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")

		items, err := service.FindAllByUser(c, userID)
		if err != nil {
			_ = c.Error(err)
			return
		}

		c.JSON(http.StatusOK, items)
	}
}

// GetSummary godoc
//
//	@Summary		Get monthly plan totals
//	@Description	Total expected income, total fixed expenses, what is left and the share of income already committed. All amounts in DOP.
//	@Tags			MonthlyPlan
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Success		200	{object}	dto.MonthlyPlanSummaryResponse	"Monthly plan summary"
//	@Failure		401	{object}	map[string]string				"Unauthorized - Invalid JWT token"
//	@Failure		500	{object}	map[string]string				"Internal server error"
//	@Router			/monthly-plan/summary [get]
func GetSummary(service *monthly_plan.MonthlyPlanService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")

		summary, err := service.Summary(c, userID)
		if err != nil {
			_ = c.Error(err)
			return
		}

		c.JSON(http.StatusOK, summary)
	}
}

// UpdateItem godoc
//
//	@Summary		Update a monthly plan item
//	@Description	Modify an existing fixed expense or expected income of the authenticated user
//	@Tags			MonthlyPlan
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id		path		string						true	"Item ID"
//	@Param			item	body		dto.MonthlyPlanItemRequest	true	"Monthly plan item data"
//	@Success		200		{object}	map[string]string			"Item updated successfully"
//	@Failure		400		{object}	map[string]string			"Bad request - Invalid input"
//	@Failure		401		{object}	map[string]string			"Unauthorized - Invalid JWT token"
//	@Failure		404		{object}	map[string]string			"Item not found"
//	@Failure		500		{object}	map[string]string			"Internal server error"
//	@Router			/monthly-plan/{id} [put]
func UpdateItem(service *monthly_plan.MonthlyPlanService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req dto.MonthlyPlanItemRequest

		id := c.Param("id")
		userID := c.GetString("X-User-Id")

		if err := c.ShouldBindJSON(&req); err != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_JSON", err.Error()))
			return
		}

		if err := service.Update(c, &req, id, userID); err != nil {
			_ = c.Error(mapNotFound(err, id))
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "updated"})
	}
}

// ToggleItem godoc
//
//	@Summary		Pause or resume a monthly plan item
//	@Description	Flip the active flag of an item so a cancelled commitment stops counting towards the totals without being deleted
//	@Tags			MonthlyPlan
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id		path		string							true	"Item ID"
//	@Param			body	body		dto.MonthlyPlanToggleRequest	true	"Active flag"
//	@Success		200		{object}	map[string]string				"Item updated successfully"
//	@Failure		400		{object}	map[string]string				"Bad request - Invalid input"
//	@Failure		401		{object}	map[string]string				"Unauthorized - Invalid JWT token"
//	@Failure		404		{object}	map[string]string				"Item not found"
//	@Failure		500		{object}	map[string]string				"Internal server error"
//	@Router			/monthly-plan/{id}/active [patch]
func ToggleItem(service *monthly_plan.MonthlyPlanService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req dto.MonthlyPlanToggleRequest

		id := c.Param("id")
		userID := c.GetString("X-User-Id")

		if err := c.ShouldBindJSON(&req); err != nil {
			_ = c.Error(apperrors.NewValidationError("INVALID_JSON", err.Error()))
			return
		}

		if err := service.SetActive(c, id, userID, *req.IsActive); err != nil {
			_ = c.Error(mapNotFound(err, id))
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "updated"})
	}
}

// DeleteItem godoc
//
//	@Summary		Delete a monthly plan item
//	@Description	Remove a fixed expense or expected income from the authenticated user's plan
//	@Tags			MonthlyPlan
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id	path		string				true	"Item ID"
//	@Success		200	{object}	map[string]string	"Item deleted successfully"
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		404	{object}	map[string]string	"Item not found"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/monthly-plan/{id} [delete]
func DeleteItem(service *monthly_plan.MonthlyPlanService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		userID := c.GetString("X-User-Id")

		if err := service.Delete(c, id, userID); err != nil {
			_ = c.Error(mapNotFound(err, id))
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "deleted"})
	}
}

// mapNotFound translates the service's sentinel error into the typed app error
// the middleware turns into a 404, leaving other errors untouched.
func mapNotFound(err error, id string) error {
	if errorhttp.IsErrNotFound(err) {
		return apperrors.NewNotFoundError("monthly plan item", id)
	}
	return err
}
