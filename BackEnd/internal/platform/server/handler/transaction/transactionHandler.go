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

		ctx.JSON(http.StatusCreated, "Transaction created")
	}
}

func FindAllTransactionOfAllAccount(transactionService *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		date1 := ctx.Query("date")
		date2 := ctx.Query("date2")
		userId := ctx.GetString("X-User-Id")
		if date1 == "" || date2 == "" {
			currentTime := time.Now()
			// Use proper date arithmetic to avoid negative days
			date1Time := currentTime.AddDate(0, 0, -7) // 7 days ago
			date2Time := currentTime.AddDate(0, 0, 2)  // 1 day from now

			// Format dates properly
			date1 = fmt.Sprintf("%d/%d/%d", date1Time.Year(), date1Time.Month(), date1Time.Day())
			date2 = fmt.Sprintf("%d/%d/%d", date2Time.Year(), date2Time.Month(), date2Time.Day())
		}

		transactionsList, err := transactionService.FindAllOfAllAccounts(ctx, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, ctx)
			return
		}
		fmt.Println("transactionsList", transactionsList)
		for i := range transactionsList {
			if transactionsList[i].TypeTransation == "income" {
				fmt.Printf("Transaction %d: %+v\n", i, transactionsList[i])
			}
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
			currentTime := time.Now()
			// Use proper date arithmetic to avoid negative days
			date1Time := currentTime.AddDate(0, 0, -2) // 2 days ago
			date2Time := currentTime.AddDate(0, 0, 1)  // 1 day from now

			// Format dates properly
			date1 = fmt.Sprintf("%d/%d/%d", date1Time.Year(), date1Time.Month(), date1Time.Day())
			date2 = fmt.Sprintf("%d/%d/%d", date2Time.Year(), date2Time.Month(), date2Time.Day())
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
