package search

import (
	"net/http"

	"github.com/gin-gonic/gin"
	// Skipping replacement until I check errors.go
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/search"
)

type SearchHandler struct {
	service *search.SearchService
}

func NewSearchHandler(service *search.SearchService) *SearchHandler {
	return &SearchHandler{
		service: service,
	}
}

func (h *SearchHandler) Search(ctx *gin.Context) {
	userId := ctx.GetString("X-User-Id")
	query := ctx.Query("q")

	if query == "" {
		ctx.JSON(http.StatusOK, gin.H{
			"transactions": []interface{}{},
			"categories":   []interface{}{},
			"accounts":     []interface{}{},
			"budgets":      []interface{}{},
		})
		return
	}

	response, err := h.service.Search(ctx, userId, query)
	if err != nil {
		ctx.Error(apperrors.NewInternalError("Error executing search", err))
		return
	}

	ctx.JSON(http.StatusOK, response)
}
