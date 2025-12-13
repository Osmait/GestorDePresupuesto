package transaction

import (
	"net/http"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/rs/zerolog/log"
)

// CreateTransaction godoc
//
//	@Summary		Create a new transaction
//	@Description	Create a new financial transaction (income or expense)
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			transaction	body		dto.TransactionRequest	true	"Transaction creation data"
//	@Success		201			{object}	map[string]string		"Transaction created successfully"
//	@Failure		400			{object}	map[string]string		"Bad request - Invalid input"
//	@Failure		401			{object}	map[string]string		"Unauthorized - Invalid JWT token"
//	@Failure		500			{object}	map[string]string		"Internal server error"
//	@Router			/transaction [post]
func CreateTransaction(transactionservice *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userID := ctx.GetString("X-User-Id")

		var transactionRequest dto.TransactionRequest

		if err := ctx.BindJSON(&transactionRequest); err != nil {
			ctx.Error(apperrors.NewValidationError("INVALID_JSON", "Error fields required"))
			return
		}
		if err := transactionRequest.Validate(); err != nil {
			ctx.Error(apperrors.NewValidationError("VALIDATION_FAILED", err.Error()))
			return
		}
		err := transactionservice.CreateTransaction(
			ctx,
			transactionRequest.Name,
			transactionRequest.Description,
			transactionRequest.Amount,
			transactionRequest.TypeTransation,
			transactionRequest.AccountId,
			userID,
			transactionRequest.CategoryId,
			transactionRequest.BudgetId,
		)
		if err != nil {
			ctx.Error(err)
			return
		}

		ctx.JSON(http.StatusCreated, "Transaction created")
	}
}

// FindAllTransactionOfAllAccount godoc
//
//	@Summary		Get all transactions across all accounts with filtering and pagination
//	@Description	Retrieve all transactions for the authenticated user across all their accounts with comprehensive filtering, sorting, and pagination options
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			page			query		int					false	"Page number for pagination"		example(1)
//	@Param			limit			query		int					false	"Number of records per page (max 100)"	example(20)
//	@Param			offset			query		int					false	"Number of records to skip"		example(0)
//	@Param			sort_by			query		string					false	"Field to sort by"				example("created_at") 	enums(created_at,amount,name,type_transation)
//	@Param			sort_order		query		string					false	"Sort order"					example("desc") 		enums(asc,desc)
//	@Param			type			query		string					false	"Transaction type filter"		example("all") 			enums(income,expense,all)
//	@Param			category_id		query		string					false	"Filter by category ID"			example("cat_123456789")
//	@Param			categories		query		string					false	"Filter by multiple categories (comma-separated)"	example("cat_1,cat_2,cat_3")
//	@Param			account_id		query		string					false	"Filter by account ID"			example("acc_123456789")
//	@Param			budget_id		query		string					false	"Filter by budget ID"			example("budget_555666777")
//	@Param			date_from		query		string					false	"Start date (YYYY/MM/DD or YYYY-MM-DD)"	example("2024/01/01")
//	@Param			date_to			query		string					false	"End date (YYYY/MM/DD or YYYY-MM-DD)"	example("2024/12/31")
//	@Param			period			query		string					false	"Predefined period filter"		example("this_month") 	enums(today,this_week,this_month,this_year,last_week,last_month,last_year)
//	@Param			amount_min		query		number					false	"Minimum amount filter"			example(0.00)
//	@Param			amount_max		query		number					false	"Maximum amount filter"			example(1000.00)
//	@Param			search			query		string					false	"Search in name and description"	example("grocery")
//	@Param			include_summary	query		bool					false	"Include summary statistics"	example(true)
//	@Success		200		{object}	dto.PaginatedTransactionResponse	"Paginated list of transactions"
//	@Failure		400		{object}	map[string]string				"Bad request - Invalid parameters"
//	@Failure		401		{object}	map[string]string				"Unauthorized - Invalid JWT token"
//	@Failure		500		{object}	map[string]string				"Internal server error"
//	@Router			/transaction [get]
func FindAllTransactionOfAllAccount(transactionService *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		userID := ctx.GetString("X-User-Id")

		// Parse filter parameters
		filter := dto.NewTransactionFilter()
		if err := filter.ParseFromQuery(ctx); err != nil {
			log.Error().Err(err).Msg("failed to parse filter parameters")
			ctx.Error(apperrors.NewValidationError("INVALID_QUERY_PARAMS", "Invalid filter parameters: "+err.Error()))
			return
		}

		// Validate filter parameters
		if err := filter.Validate(); err != nil {
			log.Error().Err(err).Msg("filter validation failed")
			ctx.Error(apperrors.NewValidationError("INVALID_FILTER", "Invalid filter parameters: "+err.Error()))
			return
		}

		// Check if summary is requested
		includeSummary := ctx.Query("include_summary") == "true"

		// Get filtered and paginated transactions
		result, err := transactionService.FindAllOfAllAccountsWithFilters(ctx, userID, filter, includeSummary)
		if err != nil {
			ctx.Error(err)
			return
		}

		// Type assertion to get pagination info for logging
		var totalRecords int64
		var returnedRecords int
		var currentPage int

		switch r := result.(type) {
		case *dto.PaginatedTransactionResponse:
			totalRecords = r.Pagination.TotalRecords
			returnedRecords = len(r.Data)
			currentPage = r.Pagination.CurrentPage
		case *dto.PaginatedTransactionResponseWithSummary:
			totalRecords = r.Pagination.TotalRecords
			returnedRecords = len(r.Data)
			currentPage = r.Pagination.CurrentPage
		}

		log.Debug().
			Int64("total_records", totalRecords).
			Int("returned_records", returnedRecords).
			Int("current_page", currentPage).
			Bool("has_filters", filter.HasFilters()).
			Msg("retrieved filtered transactions")

		ctx.JSON(http.StatusOK, result)
	}
}

// FindAllTransaction godoc
//
//	@Summary		Get transactions for a specific account with filtering and pagination
//	@Description	Retrieve transactions for a specific account with comprehensive filtering, sorting, and pagination options
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id				path		string					true	"Account ID"
//	@Param			page			query		int					false	"Page number for pagination"		example(1)
//	@Param			limit			query		int					false	"Number of records per page (max 100)"	example(20)
//	@Param			offset			query		int					false	"Number of records to skip"		example(0)
//	@Param			sort_by			query		string					false	"Field to sort by"				example("created_at") 	enums(created_at,amount,name,type_transation)
//	@Param			sort_order		query		string					false	"Sort order"					example("desc") 		enums(asc,desc)
//	@Param			type			query		string					false	"Transaction type filter"		example("all") 			enums(income,expense,all)
//	@Param			category_id		query		string					false	"Filter by category ID"			example("cat_123456789")
//	@Param			categories		query		string					false	"Filter by multiple categories (comma-separated)"	example("cat_1,cat_2,cat_3")
//	@Param			budget_id		query		string					false	"Filter by budget ID"			example("budget_555666777")
//	@Param			date_from		query		string					false	"Start date (YYYY/MM/DD or YYYY-MM-DD)"	example("2024/01/01")
//	@Param			date_to			query		string					false	"End date (YYYY/MM/DD or YYYY-MM-DD)"	example("2024/12/31")
//	@Param			period			query		string					false	"Predefined period filter"		example("this_month") 	enums(today,this_week,this_month,this_year,last_week,last_month,last_year)
//	@Param			amount_min		query		number					false	"Minimum amount filter"			example(0.00)
//	@Param			amount_max		query		number					false	"Maximum amount filter"			example(1000.00)
//	@Param			search			query		string					false	"Search in name and description"	example("grocery")
//	@Param			include_summary	query		bool					false	"Include summary statistics"	example(true)
//	@Success		200		{object}	dto.PaginatedTransactionResponse	"Paginated list of transactions for the account"
//	@Failure		400		{object}	map[string]string				"Bad request - Invalid parameters"
//	@Failure		401		{object}	map[string]string				"Unauthorized - Invalid JWT token"
//	@Failure		404		{object}	map[string]string				"Account not found"
//	@Failure		500		{object}	map[string]string				"Internal server error"
//	@Router			/transaction/{id} [get]
func FindAllTransaction(transactionService *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		accountId := ctx.Param("id")

		// Parse filter parameters
		filter := dto.NewTransactionFilter()
		if err := filter.ParseFromQuery(ctx); err != nil {
			log.Error().Err(err).Msg("failed to parse filter parameters")
			ctx.Error(apperrors.NewValidationError("INVALID_QUERY_PARAMS", "Invalid filter parameters: "+err.Error()))
			return
		}

		// Set account ID from path parameter
		filter.AccountId = accountId

		// Validate filter parameters
		if err := filter.Validate(); err != nil {
			log.Error().Err(err).Msg("filter validation failed")
			ctx.Error(apperrors.NewValidationError("INVALID_FILTER", "Invalid filter parameters: "+err.Error()))
			return
		}

		// Check if summary is requested
		includeSummary := ctx.Query("include_summary") == "true"

		// Get filtered and paginated transactions
		result, err := transactionService.FindAllWithFilters(ctx, filter, includeSummary)
		if err != nil {
			ctx.Error(err)
			return
		}

		// Type assertion to get pagination info for logging
		var totalRecords int64
		var returnedRecords int
		var currentPage int

		switch r := result.(type) {
		case *dto.PaginatedTransactionResponse:
			totalRecords = r.Pagination.TotalRecords
			returnedRecords = len(r.Data)
			currentPage = r.Pagination.CurrentPage
		case *dto.PaginatedTransactionResponseWithSummary:
			totalRecords = r.Pagination.TotalRecords
			returnedRecords = len(r.Data)
			currentPage = r.Pagination.CurrentPage
		}

		log.Debug().
			Str("account_id", accountId).
			Int64("total_records", totalRecords).
			Int("returned_records", returnedRecords).
			Int("current_page", currentPage).
			Bool("has_filters", filter.HasFilters()).
			Msg("retrieved filtered transactions for account")

		ctx.JSON(http.StatusOK, result)
	}
}

// DeleteTransaction godoc
//
//	@Summary		Delete a transaction
//	@Description	Delete a specific transaction by ID
//	@Tags			Transactions
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id	path		string				true	"Transaction ID"
//	@Success		200	{object}	map[string]string	"Transaction deleted successfully"
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		404	{object}	map[string]string	"Transaction not found"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/transaction/{id} [delete]
func DeleteTransaction(transactionService *transaction.TransactionService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		id := ctx.Param("id")
		userID := ctx.GetString("X-User-Id")
		err := transactionService.DeleteTransaction(ctx, id, userID)
		if err != nil {
			ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, "Deleted")
	}
}
