package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/loan"
	loanService "github.com/osmait/gestorDePresupuesto/internal/services/loan"
)

func LoanRoutes(s *gin.Engine, service *loanService.LoanService) {
	group := s.Group("/loan")
	{
		group.POST("", handler.CreateLoan(service))
		group.GET("", handler.FindAllLoans(service))
		group.GET("/summary", handler.GetLoanSummary(service))
		group.GET("/:id", handler.FindLoanById(service))
		group.POST("/:id/payments", handler.RegisterPayment(service))
		group.PATCH("/:id/status", handler.UpdateLoanStatus(service))
	}
}
