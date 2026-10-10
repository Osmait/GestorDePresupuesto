package loan

import (
	"net/http"

	"github.com/gin-gonic/gin"
	loanDomain "github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	loanService "github.com/osmait/gestorDePresupuesto/internal/services/loan"
)

func CreateLoan(service *loanService.LoanService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		var req dto.CreateLoanRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}

		response, err := service.CreateLoan(ctx.Request.Context(), &req, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusCreated, response)
	}
}

func FindAllLoans(service *loanService.LoanService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		response, err := service.FindAll(ctx.Request.Context(), userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, response)
	}
}

func FindLoanById(service *loanService.LoanService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")

		response, err := service.FindById(ctx.Request.Context(), id, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusOK, response)
	}
}

func RegisterPayment(service *loanService.LoanService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")

		var req dto.RegisterLoanPaymentRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}

		response, err := service.RegisterPayment(ctx.Request.Context(), id, userId, &req)
		if err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusCreated, response)
	}
}

func UpdateLoanStatus(service *loanService.LoanService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")

		var req dto.UpdateLoanStatusRequest
		if err := ctx.BindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}

		if req.Status != loanDomain.LoanStatusActive && req.Status != loanDomain.LoanStatusPaid && req.Status != loanDomain.LoanStatusDefaulted && req.Status != loanDomain.LoanStatusCancelled {
			_ = ctx.Error(apperrors.NewValidationError("VALIDATION_FAILED", "invalid status"))
			return
		}

		if err := service.UpdateStatus(ctx.Request.Context(), id, userId, req.Status); err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusOK, gin.H{"message": "Loan status updated successfully"})
	}
}

func CancelLoan(service *loanService.LoanService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")

		if err := service.CancelLoan(ctx.Request.Context(), id, userId); err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusOK, gin.H{"message": "Loan cancelled successfully"})
	}
}

func GetLoanSummary(service *loanService.LoanService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		summary, err := service.GetSummary(ctx.Request.Context(), userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, summary)
	}
}
