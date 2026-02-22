package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"
	featureFlagHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/featureflag"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
)

func FeatureFlagRoutes(s *gin.Engine, db *sql.DB) {
	handler := featureFlagHandler.NewHandler(db)

	s.GET("/me/features", handler.GetMyFeatures)

	admin := s.Group("/admin")
	admin.Use(middleware.RequireRole("ADMIN"))
	{
		admin.GET("/features", handler.GetCatalog)
		admin.PATCH("/features/:featureKey/global", handler.SetGlobalFeature)
		admin.DELETE("/features/:featureKey/global", handler.ResetGlobalFeature)
		admin.GET("/users/:id/features", handler.GetUserFeatures)
		admin.PUT("/users/:id/features", handler.UpsertUserFeatures)
		admin.DELETE("/users/:id/features/:featureKey", handler.ResetUserFeature)
	}
}
