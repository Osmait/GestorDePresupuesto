package invesment

import (
	"net/http"

	"github.com/gin-gonic/gin"
	invesmentDomain "github.com/osmait/gestorDePresupuesto/internal/domain/invesment"
	errorHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/internal/services/invesment"
)

func CreateInvesment(invesmentServices *invesment.InvesmentServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		var invesment invesmentDomain.Invesment
		err := c.Bind(&invesment)
		if err != nil {
			c.JSON(http.StatusBadRequest, err)
			return
		}
		err = invesmentServices.CreateInvesment(c, &invesment)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusCreated, "created")
	}
}

func FindAllInvesment(invesmentServices *invesment.InvesmentServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetString("X-user-Id")
		invesments, err := invesmentServices.FindAll(c, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, invesments)
	}
}

func DeleteInvesment(invesmentServices *invesment.InvesmentServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		err := invesmentServices.Delete(c, id)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, "Deleted")
	}
}
