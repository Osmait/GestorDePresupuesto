package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/search"
	searchService "github.com/osmait/gestorDePresupuesto/internal/services/search"
)

func SearchRoutes(s *gin.Engine, service *searchService.SearchService) {
	searchHandler := search.NewSearchHandler(service)
	group := s.Group("/search")
	group.GET("", searchHandler.Search)
}
