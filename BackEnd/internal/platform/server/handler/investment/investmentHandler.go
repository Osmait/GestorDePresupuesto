package investment

import (
	"net/http"

	"github.com/gin-gonic/gin"
	investmentDomain "github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	errorHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/internal/services/investment"
)

func CreateInvestment(investmentServices *investment.InvestmentServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		var investment investmentDomain.Investment
		err := c.Bind(&investment)
		if err != nil {
			c.JSON(http.StatusBadRequest, err)
			return
		}
		err = investmentServices.CreateInvestment(c, &investment)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusCreated, "created")
	}
}

func FindAllInvestment(investmentServices *investment.InvestmentServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetString("X-user-Id")
		investments, err := investmentServices.FindAll(c, userId)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, investments)
	}
}

func DeleteInvestment(investmentServices *investment.InvestmentServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		err := investmentServices.Delete(c, id)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, "Deleted")
	}
}
