package transaction

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	transactionDomain "github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/transaction"
)

func CreateTransaction(transactionservice transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var transaction transactionDomain.Transaction
		if err := ctx.BindJSON(&transaction); err != nil {
			ctx.JSON(http.StatusBadRequest, "Error campos requeridos")
			return
		}
		err := transactionservice.CreateTransaction(ctx, transaction.Id, transaction.Name, transaction.Description, transaction.Amount, transaction.TypeTransation, transaction.Account_id)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, err.Error())
		}

		ctx.Status(http.StatusCreated)
	}
}

func FindAllTransaction(transactionService transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		date1 := ctx.Query("date")
		date2 := ctx.Query("date2")

		if date1 == "" || date2 == "" {
			currenTime := time.Now()
			date1 = fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day())
			date2 = fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()+1)
		}

		transactionsList, err := transactionService.FindAll(ctx, date1, date2)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, "Error Finding transantion")

		}

		ctx.JSON(http.StatusOK, transactionsList)
	}
}

func DeleteTransaction(transactionService transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")
		err := transactionService.DeleteTransaction(ctx, id)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, err.Error())
		}
		ctx.JSON(http.StatusOK, "Deleted")

	}
}
