package transaction

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	transactionDomain "github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
	errorHandler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/transaction"
)

func CreateTransaction(transactionservice *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")

		var transaction transactionDomain.Transaction

		if err := ctx.BindJSON(&transaction); err != nil {
			ctx.JSON(http.StatusBadRequest, "Error fields required ")
			return
		}
		err := transactionservice.CreateTransaction(ctx, transaction.Name, transaction.Description, transaction.Amount, transaction.TypeTransation, transaction.AccountId, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, ctx)
		}

		ctx.Status(http.StatusCreated)
	}
}

func FindAllTransactionOfAllAccount(transactionService *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		date1 := ctx.Query("date")
		date2 := ctx.Query("date2")
		userId := ctx.GetString("X-User-Id")
		if date1 == "" || date2 == "" {
			currenTime := time.Now()
			date1 = fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()-7)
			date2 = fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()+1)
		}

		transactionsList, err := transactionService.FindAllOfAllAccounts(ctx, date1, date2, userId)
		fmt.Println(transactionsList)
		if err != nil {
			fmt.Println(err.Error())
			errorHandler.ReponseByTypeOfErr(err, ctx)
			return
		}

		ctx.JSON(http.StatusOK, transactionsList)
	}
}

func FindAllTransaction(transactionService *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		date1 := ctx.Query("date")
		date2 := ctx.Query("date2")
		id := ctx.Param("id")

		if date1 == "" || date2 == "" {
			currenTime := time.Now()
			date1 = fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()-2)
			date2 = fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()+1)
		}

		transactionsList, err := transactionService.FindAll(ctx, date1, date2, id)
		fmt.Println(transactionsList)
		if err != nil {
			fmt.Println(err.Error())
			errorHandler.ReponseByTypeOfErr(err, ctx)
			return
		}

		ctx.JSON(http.StatusOK, transactionsList)
	}
}

func DeleteTransaction(transactionService *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")
		err := transactionService.DeleteTransaction(ctx, id)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, ctx)
			return
		}
		ctx.JSON(http.StatusOK, "Deleted")
	}
}
