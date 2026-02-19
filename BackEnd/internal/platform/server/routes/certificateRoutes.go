package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/services/certificate"
)

func CertificateRoutes(s *gin.Engine, certificateService *certificate.CertificateService) {
	certGroup := s.Group("/certificate")
	{
		certGroup.POST("", handler.CreateCertificate(certificateService))
		certGroup.GET("", handler.FindAllCertificates(certificateService))
		certGroup.GET("/summary", handler.GetCertificateSummary(certificateService))
		certGroup.GET("/:id", handler.FindCertificateById(certificateService))
		certGroup.PUT("/:id", handler.UpdateCertificate(certificateService))
		certGroup.DELETE("/:id", handler.DeleteCertificate(certificateService))
		certGroup.POST("/:id/simulate", handler.SimulateCertificate(certificateService))
	}
}
