package account

import (
	"net/http"

	"github.com/gin-gonic/gin"
	accountDomain "github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/account"
)

func CreateAccount(accountService account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var account accountDomain.Account
		if err := ctx.BindJSON(&account); err != nil {
			ctx.JSON(http.StatusBadRequest, "Error campos requeridos")
			return
		}
		err := accountService.CreateAccount(ctx, account.Id, account.Name, account.Bank, account.Balance)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, err.Error())
		}
		ctx.Status(http.StatusCreated)
	}
}

func FindAllAccount(account account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		accountList, err := account.FindAll(ctx)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, "Error Finded accounts")
		}
		ctx.JSON(http.StatusOK, accountList)
	}
}

func DeleteAccount(accountService account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")
		err := accountService.DeleteAccount(ctx, id)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, "Error deleting account")
		}
		ctx.JSON(http.StatusOK, "Deleted")

	}
}
