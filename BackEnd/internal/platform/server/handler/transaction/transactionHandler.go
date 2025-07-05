package transaction

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	errorHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

func CreateTransaction(transactionservice *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")

		var transactionRequest dto.TransactionRequest

		if err := ctx.BindJSON(&transactionRequest); err != nil {
			ctx.JSON(http.StatusBadRequest, "Error fields required ")
			return
		}
		err := transactionservice.CreateTransaction(
			ctx,
			transactionRequest.Name,
			transactionRequest.Description,
			transactionRequest.Amount,
			transactionRequest.TypeTransation,
			transactionRequest.AccountId,
			userId,
			transactionRequest.CategoryId,
			transactionRequest.BudgetId,
		)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, ctx)
			return
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
		if err != nil {
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
		if err != nil {
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
