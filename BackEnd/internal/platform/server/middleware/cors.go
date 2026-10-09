package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	cors "github.com/rs/cors/wrapper/gin"
)

// CORS builds the CORS middleware from configuration (CORS_ALLOWED_ORIGINS
// etc.). Only listed origins receive Access-Control-Allow-Origin; requests
// from other origins are still served (non-browser clients such as the iOS
// app send no Origin) but browsers will refuse to expose the response.
func CORS(cfg config.CORSConfig) gin.HandlerFunc {
	return cors.New(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   cfg.AllowedMethods,
		AllowedHeaders:   cfg.AllowedHeaders,
		ExposedHeaders:   cfg.ExposedHeaders,
		AllowCredentials: cfg.AllowCredentials,
		MaxAge:           cfg.MaxAge,
	})
}
