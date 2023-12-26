package account

import (
	"net/http"

	"github.com/gin-gonic/gin"
	accountDomain "github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
	errorHandler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/account"
)

type AccountResponse struct {
	AccountInfo    *accountDomain.Account
	CurrentBalance float64
}

func CreateAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		var account accountDomain.Account
		if err := ctx.BindJSON(&account); err != nil {
			ctx.JSON(http.StatusBadRequest, "Error filds required")
			return
		}
		err := accountService.CreateAccount(ctx, account.Name, account.Bank, account.InitialBalance, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, ctx)
		}
		ctx.Status(http.StatusCreated)
	}
}

func FindAllAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		accountList, err := accountService.FindAll(ctx, userId)
		var accountResponse []AccountResponse
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, ctx)
		}
		for _, account := range accountList {
			balance, err := accountService.Balance(ctx, account.Id)
			if err != nil {
				errorHandler.ReponseByTypeOfErr(err, ctx)
			}
			accounts := AccountResponse{AccountInfo: account, CurrentBalance: balance + account.InitialBalance}
			accountResponse = append(accountResponse, accounts)
		}
		ctx.JSON(http.StatusOK, accountResponse)
	}
}

func DeleteAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")
		err := accountService.DeleteAccount(ctx, id)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, ctx)
		}
		ctx.JSON(http.StatusOK, "Deleted")
	}
}
