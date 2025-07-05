package account

import (
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/account"
	errorHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
)

func CreateAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		var account dto.AccountRequest
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
		accounts, err := accountService.FindAll(ctx, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, ctx)
		}

		ctx.JSON(http.StatusOK, accounts)
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
