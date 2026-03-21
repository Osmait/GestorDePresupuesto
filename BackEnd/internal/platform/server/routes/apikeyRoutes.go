package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/apikey"
	apikeyService "github.com/osmait/gestorDePresupuesto/internal/services/apikey"
)

func APIKeyRoutes(engine *gin.Engine, service *apikeyService.APIKeyService) {
	engine.POST("/api-keys", handler.CreateAPIKey(service))
	engine.GET("/api-keys", handler.ListAPIKeys(service))
	engine.DELETE("/api-keys/:id", handler.RevokeAPIKey(service))
}
