package postgress

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

type TransactionRepository struct {
	db *sql.DB
}

func NewTransactionRepository(db *sql.DB) *TransactionRepository {
	return &TransactionRepository{
		db: db,
	}
}

func (repo *TransactionRepository) Save(ctx context.Context, transaction *transaction.Transaction) error {
	currency := transaction.Currency
	if currency == "" {
		currency = "DOP"
	}

	if transaction.UserId == "" {
		return errors.New("transaction user id is required")
	}
	if transaction.AccountId == "" {
		return fmt.Errorf("%w (account)", ownership.ErrReferenceNotOwned)
	}

	// Every referenced row must belong to the transaction owner.
	if err := ownership.VerifyReferences(ctx, txhelper.FromContext(ctx, repo.db), transaction.UserId,
		ownership.Reference{Table: ownership.Account, ID: transaction.AccountId},
		ownership.Reference{Table: ownership.Category, ID: transaction.CategoryId},
		ownership.Reference{Table: ownership.Budget, ID: transaction.BudgetId},
	); err != nil {
		return err
	}

	categoryID := transaction.CategoryId
	if categoryID == "" {
		resolvedCategoryID, err := repo.resolveFallbackCategoryID(ctx, transaction.UserId)
		if err != nil {
			return err
		}
		categoryID = resolvedCategoryID
	}

	_, err := txhelper.FromContext(ctx, repo.db).ExecContext(ctx, "INSERT INTO transactions (id,transaction_name,transaction_description,amount,type_transation,account_id,user_id,category_id,budget_id,currency,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", transaction.Id, transaction.Name, transaction.Description, transaction.Amount, transaction.TypeTransation, transaction.AccountId, transaction.UserId, categoryID, transaction.BudgetId, currency, transaction.CreatedAt)

	return err
}

func (repo *TransactionRepository) resolveFallbackCategoryID(ctx context.Context, userId string) (string, error) {
	// Single query: insert a 'General' fallback only when the user has no categories,
	// then return whichever category exists (new or pre-existing).
	// The fallback id is deterministic (MD5 of userId), so no second SELECT is needed.
	var categoryID string
	err := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, `
		WITH ins AS (
			INSERT INTO categorys (id, name, icon, color, created_at, user_id)
			SELECT 'autocat_' || SUBSTRING(MD5($1) FROM 1 FOR 24), 'General', 'tag', '#64748b', NOW(), $1
			WHERE NOT EXISTS (SELECT 1 FROM categorys WHERE user_id = $1)
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		)
		SELECT COALESCE(
			(SELECT id FROM ins LIMIT 1),
			(SELECT id FROM categorys WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1)
		)
	`, userId).Scan(&categoryID)
	return categoryID, err
}

func (repo *TransactionRepository) ResolveAndValidateCurrencyForAccount(ctx context.Context, userId string, accountId string, currency string) (string, error) {
	query := `SELECT account_type, currency FROM account WHERE id = $1 AND user_id = $2`
	row := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, query, accountId, userId)

	var accountType string
	var accountCurrency string
	if err := row.Scan(&accountType, &accountCurrency); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// The account does not exist or belongs to another user.
			return "", fmt.Errorf("%w (account)", ownership.ErrReferenceNotOwned)
		}
		return "", err
	}
	if accountType == "" {
		accountType = "bank"
	}
	if accountCurrency == "" {
		accountCurrency = "DOP"
	}

	resolvedCurrency := currency
	if resolvedCurrency == "" {
		resolvedCurrency = accountCurrency
	}
	if resolvedCurrency == "" {
		resolvedCurrency = "DOP"
	}

	if accountType == "credit_card" {
		cardBalanceQuery := `SELECT 1 FROM card_balances WHERE card_id = $1 AND currency = $2 LIMIT 1`
		cardBalanceRow := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, cardBalanceQuery, accountId, resolvedCurrency)
		var exists int
		if err := cardBalanceRow.Scan(&exists); err != nil {
			if err == sql.ErrNoRows {
				return "", fmt.Errorf("card does not have a balance in currency %s", resolvedCurrency)
			}
			return "", err
		}
		return resolvedCurrency, nil
	}

	if resolvedCurrency != accountCurrency {
		return "", fmt.Errorf("currency must match account currency (%s)", accountCurrency)
	}

	return resolvedCurrency, nil
}

func (repo *TransactionRepository) FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error) {
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx,
		"SELECT id,transaction_name,transaction_description,amount,type_transation,account_id,category_id,budget_id,COALESCE(currency, 'DOP'),created_at FROM transactions WHERE  user_id = $1 ORDER BY created_at DESC", id)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var transactions []*transaction.Transaction
	for rows.Next() {
		transaction := transaction.Transaction{}
		var budgetID sql.NullString
		if err = rows.Scan(&transaction.Id, &transaction.Name, &transaction.Description, &transaction.Amount, &transaction.TypeTransation, &transaction.AccountId, &transaction.CategoryId, &budgetID, &transaction.Currency, &transaction.CreatedAt); err == nil {
			if budgetID.Valid {
				transaction.BudgetId = budgetID.String
			}
			transactions = append(transactions, &transaction)
		} else {
			log.Error().Err(err).Msg("failed to scan row in FindAllOfAllAccounts")
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return transactions, nil
}

func (repo *TransactionRepository) FindAll(ctx context.Context, date1 string, date2 string, id string, userId string) ([]*transaction.Transaction, error) {
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx,
		"SELECT id,transaction_name,transaction_description,amount,type_transation,account_id,category_id,budget_id,COALESCE(currency, 'DOP'),created_at FROM transactions WHERE account_id = $1 AND user_id = $4 AND created_at BETWEEN $2 AND $3 ORDER BY created_at DESC", id, date1, date2, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var transactions []*transaction.Transaction
	for rows.Next() {
		transaction := transaction.Transaction{}
		var budgetID sql.NullString
		if err = rows.Scan(&transaction.Id, &transaction.Name, &transaction.Description, &transaction.Amount, &transaction.TypeTransation, &transaction.AccountId, &transaction.CategoryId, &budgetID, &transaction.Currency, &transaction.CreatedAt); err == nil {
			if budgetID.Valid {
				transaction.BudgetId = budgetID.String
			}
			transactions = append(transactions, &transaction)
		} else {
			log.Error().Err(err).Msg("failed to scan row in FindAll")
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return transactions, nil
}

// currentMonthPredicate selects the transactions of the current calendar
// month in the session time zone. It is the sargable form of
// date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE): both
// bounds are computed once per statement (date_trunc on timestamptz and the
// one-month step use the session time zone, exactly like the old filter), so
// the (user_id, created_at) / (budget_id, created_at) indexes can range-scan
// instead of evaluating date_trunc on every row of the user/budget.
const currentMonthPredicate = "created_at >= date_trunc('month', CURRENT_DATE) AND created_at < date_trunc('month', CURRENT_DATE) + interval '1 month'"

func (repo *TransactionRepository) FindCurrentBudget(ctx context.Context, budgetID string, userId string, usdToDop money.Amount) (money.Amount, error) {
	if !usdToDop.IsPositive() {
		usdToDop = money.FromInt(60)
	}
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx,
		"SELECT COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * $2 ELSE amount END), 0) as currentBudget FROM transactions WHERE budget_id = $1 AND user_id = $3 AND type_transation = 'bill' AND "+currentMonthPredicate, budgetID, usdToDop, userId)
	if err != nil {
		return money.Zero, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()
	var currentBudget money.Amount
	for rows.Next() {
		if err = rows.Scan(&currentBudget); err == nil {
			return currentBudget, nil
		}
	}
	if err = rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating over budget rows")
		return money.Zero, err
	}
	return money.Zero, nil
}

// BalanceByAccountAndCurrency returns the net total of the user's transactions
// on accountId in currency, read from the trigger-maintained account_balances
// table (migration 000052).
func (repo *TransactionRepository) BalanceByAccountAndCurrency(ctx context.Context, accountId string, userId string, currency string) (money.Amount, error) {
	var total money.Amount
	err := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx,
		`SELECT COALESCE(SUM(balance), 0) FROM account_balances WHERE user_id = $1 AND account_id = $2 AND currency = $3`,
		userId, accountId, currency).Scan(&total)
	if err != nil {
		return money.Zero, err
	}
	return total, nil
}

func (repo *TransactionRepository) FindCurrentBudgets(ctx context.Context, userId string, usdToDop money.Amount) (map[string]money.Amount, error) {
	if !usdToDop.IsPositive() {
		usdToDop = money.FromInt(60)
	}
	query := `SELECT budget_id, COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * $2 ELSE amount END), 0) FROM transactions
		WHERE user_id = $1 AND budget_id IS NOT NULL AND type_transation = 'bill'
		AND ` + currentMonthPredicate + `
		GROUP BY budget_id`
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx, query, userId, usdToDop)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	budgets := make(map[string]money.Amount)
	for rows.Next() {
		var budgetId string
		var total money.Amount
		if err = rows.Scan(&budgetId, &total); err == nil {
			budgets[budgetId] = total
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return budgets, nil
}

func (repo *TransactionRepository) Delete(ctx context.Context, id string, userId string) error {
	result, err := txhelper.FromContext(ctx, repo.db).ExecContext(ctx, "DELETE FROM transactions WHERE id = $1 AND user_id = $2", id, userId)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}

// Update rewrites a transaction owned by t.UserId. The row must belong to that
// user (otherwise ownership.ErrNotFound is returned) and so must the account,
// category and budget it points to (otherwise ownership.ErrReferenceNotOwned).
func (repo *TransactionRepository) Update(ctx context.Context, id string, t *transaction.Transaction) error {
	if t.UserId == "" {
		return ownership.ErrNotFound
	}
	q := txhelper.FromContext(ctx, repo.db)

	var exists bool
	if err := q.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM transactions WHERE id = $1 AND user_id = $2)", id, t.UserId).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ownership.ErrNotFound
	}

	if t.AccountId == "" || t.CategoryId == "" {
		return fmt.Errorf("%w (account and category are required)", ownership.ErrReferenceNotOwned)
	}
	if err := ownership.VerifyReferences(ctx, q, t.UserId,
		ownership.Reference{Table: ownership.Account, ID: t.AccountId},
		ownership.Reference{Table: ownership.Category, ID: t.CategoryId},
		ownership.Reference{Table: ownership.Budget, ID: t.BudgetId},
	); err != nil {
		return err
	}

	query := `UPDATE transactions SET transaction_name = $1, transaction_description = $2, amount = $3,
		type_transation = $4, account_id = $5, category_id = $6, budget_id = $7, currency = $8
		WHERE id = $9 AND user_id = $10`
	currency := t.Currency
	if currency == "" {
		currency = "DOP"
	}
	result, err := q.ExecContext(ctx, query, t.Name, t.Description, t.Amount, t.TypeTransation, t.AccountId, t.CategoryId, t.BudgetId, currency, id, t.UserId)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}

// FindAllOfAllAccountsWithFilters retrieves all transactions across all user accounts with filtering and pagination
func (repo *TransactionRepository) FindAllOfAllAccountsWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]*transaction.Transaction, error) {
	query, args, err := repo.buildTransactionQuery(userId, filter, false)
	if err != nil {
		return nil, err
	}

	log.Debug().Str("query", query).Interface("args", args).Msg("executing transaction query")

	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute transaction query: %w", err)
	}
	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			log.Error().Err(closeErr).Msg("failed to close database rows")
		}
	}()

	return repo.scanTransactions(rows)
}

// FindAllWithFilters retrieves transactions of userId for a specific account
// (filter.AccountId) with filtering and pagination.
func (repo *TransactionRepository) FindAllWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]*transaction.Transaction, error) {
	query, args, err := repo.buildTransactionQuery(userId, filter, false)
	if err != nil {
		return nil, err
	}

	log.Debug().Str("query", query).Interface("args", args).Msg("executing transaction query")

	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute transaction query: %w", err)
	}
	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			log.Error().Err(closeErr).Msg("failed to close database rows")
		}
	}()

	return repo.scanTransactions(rows)
}

// CountWithFilters counts transactions with applied filters
func (repo *TransactionRepository) CountWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) (int64, error) {
	query, args, err := repo.buildTransactionQuery(userId, filter, true)
	if err != nil {
		return 0, err
	}

	log.Debug().Str("count_query", query).Interface("args", args).Msg("executing transaction count query")

	var count int64
	err = txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count transactions: %w", err)
	}

	return count, nil
}

// transactionSortColumns maps the public sort_by values to SQL columns. Only
// these columns may ever be interpolated into ORDER BY.
var transactionSortColumns = map[string]string{
	"created_at":       "created_at",
	"amount":           "amount",
	"name":             "transaction_name",
	"transaction_name": "transaction_name",
	"type_transation":  "type_transation",
}

// errMissingUserScope is returned when a transaction query is built without a
// user id: every transaction query must be scoped to its owner.
var errMissingUserScope = errors.New("transaction query requires a user id")

// buildTransactionQuery constructs the SQL query with filters, sorting, and
// pagination. The query is always scoped to userId.
func (repo *TransactionRepository) buildTransactionQuery(userId string, filter *dto.TransactionFilter, isCount bool) (string, []interface{}, error) {
	if userId == "" {
		return "", nil, errMissingUserScope
	}
	if filter == nil {
		filter = dto.NewTransactionFilter()
	}

	var queryBuilder strings.Builder
	var args []interface{}
	argIndex := 1

	// SELECT clause
	if isCount {
		queryBuilder.WriteString("SELECT COUNT(*) FROM transactions")
	} else {
		queryBuilder.WriteString("SELECT id, transaction_name, transaction_description, amount, type_transation, account_id, category_id, budget_id, COALESCE(currency, 'DOP'), created_at FROM transactions")
	}

	// WHERE clause
	var whereConditions []string

	// User ID filter: always applied.
	whereConditions = append(whereConditions, fmt.Sprintf("user_id = $%d", argIndex))
	args = append(args, userId)
	argIndex++

	// Account ID filter (for specific account query)
	if filter.AccountId != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("account_id = $%d", argIndex))
		args = append(args, filter.AccountId)
		argIndex++
	}

	// Transaction type filter
	if filter.Type != "all" && filter.Type != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("type_transation = $%d", argIndex))
		args = append(args, filter.Type)
		argIndex++
	}

	// Category ID filter
	if filter.CategoryId != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("category_id = $%d", argIndex))
		args = append(args, filter.CategoryId)
		argIndex++
	}

	// Multiple categories filter
	if len(filter.Categories) > 0 {
		placeholders := make([]string, len(filter.Categories))
		for i, category := range filter.Categories {
			placeholders[i] = fmt.Sprintf("$%d", argIndex)
			args = append(args, category)
			argIndex++
		}
		whereConditions = append(whereConditions, fmt.Sprintf("category_id IN (%s)", strings.Join(placeholders, ", ")))
	}

	// Budget ID filter
	if filter.BudgetId != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("budget_id = $%d", argIndex))
		args = append(args, filter.BudgetId)
		argIndex++
	}

	// Date range filter
	if !filter.CalculatedDateFrom.IsZero() {
		whereConditions = append(whereConditions, fmt.Sprintf("created_at >= $%d", argIndex))
		args = append(args, filter.CalculatedDateFrom)
		argIndex++
	}

	if !filter.CalculatedDateTo.IsZero() {
		whereConditions = append(whereConditions, fmt.Sprintf("created_at <= $%d", argIndex))
		args = append(args, filter.CalculatedDateTo)
		argIndex++
	}

	// Amount range filters
	if filter.AmountMin != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("amount >= $%d", argIndex))
		args = append(args, *filter.AmountMin)
		argIndex++
	}

	if filter.AmountMax != nil {
		whereConditions = append(whereConditions, fmt.Sprintf("amount <= $%d", argIndex))
		args = append(args, *filter.AmountMax)
		argIndex++
	}

	// Search filter (name and description)
	if filter.Search != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("(transaction_name ILIKE $%d OR transaction_description ILIKE $%d)", argIndex, argIndex+1))
		searchTerm := "%" + filter.Search + "%"
		args = append(args, searchTerm, searchTerm)
		argIndex += 2
	}

	// Add WHERE conditions
	if len(whereConditions) > 0 {
		queryBuilder.WriteString(" WHERE ")
		queryBuilder.WriteString(strings.Join(whereConditions, " AND "))
	}

	// For count queries, we don't need ORDER BY, LIMIT, or OFFSET
	if isCount {
		return queryBuilder.String(), args, nil
	}

	// ORDER BY clause: only whitelisted columns and directions are interpolated.
	sortColumn, ok := transactionSortColumns[filter.SortBy]
	if !ok {
		sortColumn = "created_at"
	}
	sortDirection := "DESC"
	if strings.EqualFold(filter.SortOrder, "asc") {
		sortDirection = "ASC"
	}
	fmt.Fprintf(&queryBuilder, " ORDER BY %s %s, id %s", sortColumn, sortDirection, sortDirection)

	// LIMIT and OFFSET for pagination (only if limit > 0)
	if filter.Limit > 0 {
		fmt.Fprintf(&queryBuilder, " LIMIT $%d", argIndex)
		args = append(args, filter.Limit)
		argIndex++

		if filter.Offset > 0 {
			fmt.Fprintf(&queryBuilder, " OFFSET $%d", argIndex)
			args = append(args, filter.Offset)
		}
	}

	return queryBuilder.String(), args, nil
}

// scanTransactions scans database rows into Transaction objects
func (repo *TransactionRepository) scanTransactions(rows *sql.Rows) ([]*transaction.Transaction, error) {
	var transactions []*transaction.Transaction

	for rows.Next() {
		transaction := &transaction.Transaction{}
		var budgetID sql.NullString

		err := rows.Scan(
			&transaction.Id,
			&transaction.Name,
			&transaction.Description,
			&transaction.Amount,
			&transaction.TypeTransation,
			&transaction.AccountId,
			&transaction.CategoryId,
			&budgetID,
			&transaction.Currency,
			&transaction.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan transaction row: %w", err)
		}

		if budgetID.Valid {
			transaction.BudgetId = budgetID.String
		}

		transactions = append(transactions, transaction)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over transaction rows: %w", err)
	}

	return transactions, nil
}

func (repo *TransactionRepository) FindByUserAndDateRange(ctx context.Context, userId string, dateFrom time.Time, dateTo time.Time) ([]*transaction.Transaction, error) {
	query := `SELECT id, transaction_name, transaction_description, amount, type_transation, account_id, category_id, budget_id, COALESCE(currency, 'DOP'), created_at
		FROM transactions
		WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
		ORDER BY created_at DESC`

	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx, query, userId, dateFrom, dateTo)
	if err != nil {
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}
	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			log.Error().Err(closeErr).Msg("failed to close database rows")
		}
	}()

	return repo.scanTransactions(rows)
}
