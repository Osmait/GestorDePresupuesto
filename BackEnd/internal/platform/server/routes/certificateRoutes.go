package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/services/certificate"
)

func CertificateRoutes(s *gin.Engine, certificateService *certificate.CertificateService, flags *middleware.FeatureFlags) {
	certGroup := s.Group("/certificate", flags.Require("module_certificates"))
	{
		certGroup.POST("", handler.CreateCertificate(certificateService))
		certGroup.GET("", handler.FindAllCertificates(certificateService))
		certGroup.GET("/summary", handler.GetCertificateSummary(certificateService))
		certGroup.GET("/:id", handler.FindCertificateById(certificateService))
		certGroup.PUT("/:id", handler.UpdateCertificate(certificateService))
		certGroup.DELETE("/:id", handler.DeleteCertificate(certificateService))
		certGroup.PUT("/payments/:paymentId", handler.UpdateCertificatePayment(certificateService))
		certGroup.POST("/:id/simulate", handler.SimulateCertificate(certificateService))
	}
}
