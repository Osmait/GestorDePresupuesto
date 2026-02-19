package certificate

import (
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/certificate"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/certificate"
)

func CreateCertificate(certificateService *certificate.CertificateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		var req dto.CreateCertificateRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Error fields required"))
			return
		}
		if err := req.Validate(); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("VALIDATION_FAILED", err.Error()))
			return
		}
		err := certificateService.CreateCertificate(ctx, &req, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.Status(http.StatusCreated)
	}
}

func FindAllCertificates(certificateService *certificate.CertificateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		certificates, err := certificateService.FindAll(ctx, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, certificates)
	}
}

func FindCertificateById(certificateService *certificate.CertificateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")
		certificate, err := certificateService.FindById(ctx, id, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, certificate)
	}
}

func UpdateCertificate(certificateService *certificate.CertificateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")

		var req dto.UpdateCertificateRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}

		err := certificateService.UpdateCertificate(ctx, id, &req, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": "Certificate updated successfully"})
	}
}

func DeleteCertificate(certificateService *certificate.CertificateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")
		err := certificateService.DeleteCertificate(ctx, id, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": "Certificate cancelled successfully"})
	}
}

func SimulateCertificate(certificateService *certificate.CertificateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")

		var req dto.SimulatePaymentRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}

		result, err := certificateService.Simulate(ctx, id, &req, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}

func GetCertificateSummary(certificateService *certificate.CertificateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		summary, err := certificateService.GetSummary(ctx, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, summary)
	}
}
