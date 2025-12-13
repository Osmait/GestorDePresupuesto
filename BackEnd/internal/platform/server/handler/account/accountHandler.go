package account

import (
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/account"
	errorHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
)

// CreateAccount godoc
//
//	@Summary		Create a new account
//	@Description	Create a new bank account for the authenticated user
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			account	body	dto.AccountRequest	true	"Account creation data"
//	@Success		201		"Account created successfully"
//	@Failure		400		{object}	map[string]string	"Bad request - Invalid input"
//	@Failure		401		{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		500		{object}	map[string]string	"Internal server error"
//	@Router			/account [post]
func CreateAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		var req dto.AccountRequest
		if err := ctx.BindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, "Error fields required")
			return
		}
		if err := req.Validate(); err != nil {
			ctx.JSON(http.StatusBadRequest, err.Error())
			return
		}
		err := accountService.CreateAccount(ctx, req.Name, req.Bank, req.InitialBalance, userId)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, ctx)
		}
		ctx.Status(http.StatusCreated)
	}
}

// FindAllAccount godoc
//
//	@Summary		Get all user accounts
//	@Description	Retrieve all bank accounts for the authenticated user
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Success		200	{array}		dto.AccountResponse	"List of user accounts"
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/account [get]
func FindAllAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		accounts, err := accountService.FindAll(ctx, userId)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, ctx)
		}

		ctx.JSON(http.StatusOK, accounts)
	}
}

// DeleteAccount godoc
//
//	@Summary		Delete an account
//	@Description	Delete a specific bank account by ID
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id	path		string				true	"Account ID"
//	@Success		200	{object}	map[string]string	"Account deleted successfully"
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		404	{object}	map[string]string	"Account not found"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/account/{id} [delete]
func DeleteAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")
		userId := ctx.GetString("X-User-Id")
		err := accountService.DeleteAccount(ctx, id, userId)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, ctx)
		}
		ctx.JSON(http.StatusOK, "Deleted")
	}
}

// UpdateAccount godoc
//
//	@Summary		Update an existing account
//	@Description	Update name and bank information for a specific account owned by the authenticated user
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id		path		string						true	"Account ID"
//	@Param			account	body		dto.AccountUpdateRequest	true	"Account update data"
//	@Success		200		{object}	map[string]string			"Account updated successfully"
//	@Failure		400		{object}	map[string]string			"Bad request - Invalid input"
//	@Failure		401		{object}	map[string]string			"Unauthorized - Invalid JWT token"
//	@Failure		404		{object}	map[string]string			"Account not found or not owned by user"
//	@Failure		500		{object}	map[string]string			"Internal server error"
//	@Router			/account/{id} [put]
func UpdateAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		id := ctx.Param("id")

		var updateRequest dto.AccountUpdateRequest
		if err := ctx.BindJSON(&updateRequest); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		err := accountService.UpdateAccount(ctx, id, &updateRequest, userId)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, ctx)
			return
		}

		ctx.JSON(http.StatusOK, gin.H{"message": "Account updated successfully"})
	}
}
