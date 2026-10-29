package account

import (
	"net/http"

	"github.com/gin-gonic/gin"
	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/account"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
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
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Error fields required"))
			return
		}
		if err := req.Validate(); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("VALIDATION_FAILED", err.Error()))
			return
		}
		err := accountService.CreateAccount(ctx.Request.Context(), req.Name, req.Bank, req.InitialBalance, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
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
		accounts, err := accountService.FindAll(ctx.Request.Context(), userId)
		if err != nil {
			_ = ctx.Error(err)
			return
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
		err := accountService.DeleteAccount(ctx.Request.Context(), id, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
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
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}

		err := accountService.UpdateAccount(ctx.Request.Context(), id, &updateRequest, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusOK, gin.H{"message": "Account updated successfully"})
	}
}

// FindAccount godoc
//
//	@Summary		Get account details
//	@Description	Get specific account details by ID
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id	path		string		true	"Account ID"
//	@Success		200	{object}	dto.AccountResponse
//	@Failure		404	{object}	map[string]string	"Account not found"
//	@Router			/account/{id} [get]
func FindAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")
		userId := ctx.GetString("X-User-Id")
		account, err := accountService.FindById(ctx.Request.Context(), id, userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, account)
	}
}

// ReconcileAccount godoc
//
//	@Summary		Reconcile an account with the bank balance
//	@Description	Compare the account balance with the balance the bank shows now. When they differ an adjustment transaction (adjustment_in/adjustment_out, neutral in reports) moves the account to the bank balance. Every call is recorded.
//	@Tags			Accounts
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id		path		string					true	"Account ID"
//	@Param			body	body		dto.ReconcileRequest	true	"Balance shown by the bank"
//	@Success		201		{object}	account.ReconcileResult
//	@Failure		400		{object}	map[string]string	"Invalid input or credit card account"
//	@Failure		401		{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		404		{object}	map[string]string	"Account not found"
//	@Router			/account/{id}/reconcile [post]
func ReconcileAccount(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		var req dto.ReconcileRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Invalid request body"))
			return
		}
		if err := req.Validate(); err != nil {
			_ = ctx.Error(apperrors.NewValidationError("VALIDATION_FAILED", err.Error()))
			return
		}
		result, err := accountService.Reconcile(ctx.Request.Context(), ctx.Param("id"), userId, account.ReconcileInput{
			BankBalance: *req.BankBalance,
			Currency:    req.Currency,
			Notes:       req.Notes,
		})
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusCreated, result)
	}
}

// ListReconciliations godoc
//
//	@Summary		List account reconciliations
//	@Description	The latest reconciliations of the account, newest first
//	@Tags			Accounts
//	@Produce		json
//	@Security		JWT
//	@Param			id	path		string	true	"Account ID"
//	@Success		200	{array}		accountDomain.Reconciliation
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		404	{object}	map[string]string	"Account not found"
//	@Router			/account/{id}/reconciliations [get]
func ListReconciliations(accountService *account.AccountService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userId := ctx.GetString("X-User-Id")
		var list []*accountDomain.Reconciliation
		list, err := accountService.Reconciliations(ctx.Request.Context(), ctx.Param("id"), userId)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, list)
	}
}
