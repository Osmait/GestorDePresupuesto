package routes

import (
	aiHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/ai"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	aiService "github.com/osmait/gestorDePresupuesto/internal/services/ai"

	"github.com/gin-gonic/gin"
)

func AIRoutes(r *gin.Engine, aiService *aiService.Service, categoryRepo categoryRepo.CategoryRepoInterface) {
	handler := aiHandler.NewHandler(aiService, categoryRepo)

	ai := r.Group("/ai")
	{
		ai.POST("/extract/transactions", handler.ExtractTransactions)
	}
}
