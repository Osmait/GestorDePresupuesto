package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
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
	_, err := repo.db.ExecContext(ctx, "INSERT INTO transactions (id,transaction_name,transaction_description,amount,type_transation,account_id,user_id,category_id,budget_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", transaction.Id, transaction.Name, transaction.Description, transaction.Amount, transaction.TypeTransation, transaction.AccountId, transaction.UserId, transaction.CategoryId, transaction.BudgetId)

	return err
}

func (repo *TransactionRepository) FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error) {
	rows, err := repo.db.QueryContext(ctx,
		"SELECT id,transaction_name,transaction_description,amount,type_transation,account_id,category_id,budget_id,created_at FROM transactions WHERE  user_id = $1 ORDER BY created_at DESC", id)
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
		if err = rows.Scan(&transaction.Id, &transaction.Name, &transaction.Description, &transaction.Amount, &transaction.TypeTransation, &transaction.AccountId, &transaction.CategoryId, &budgetID, &transaction.CreatedAt); err == nil {
			if budgetID.Valid {
				transaction.BudgetId = budgetID.String
			}
			transactions = append(transactions, &transaction)
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return transactions, nil
}

func (repo *TransactionRepository) FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error) {
	rows, err := repo.db.QueryContext(ctx,
		"SELECT id,transaction_name,transaction_description,amount,type_transation,account_id,category_id,budget_id,created_at FROM transactions WHERE  account_id = $1 and created_at BETWEEN $2 and $3 ORDER BY created_at DESC", id, date1, date2)
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
		if err = rows.Scan(&transaction.Id, &transaction.Name, &transaction.Description, &transaction.Amount, &transaction.TypeTransation, &transaction.AccountId, &transaction.CategoryId, &budgetID, &transaction.CreatedAt); err == nil {
			if budgetID.Valid {
				transaction.BudgetId = budgetID.String
			}
			transactions = append(transactions, &transaction)
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return transactions, nil
}

func (repo *TransactionRepository) FindCurrentBudget(ctx context.Context, budgetID string) (float64, error) {
	rows, err := repo.db.QueryContext(ctx,
		"SELECT   sum(amount)  as currentBudget FROM  transactions   WHERE  budget_id = $1  ", budgetID)
	if err != nil {
		return 0, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()
	var currentBudget float64
	for rows.Next() {
		if err = rows.Scan(&currentBudget); err == nil {
			return currentBudget, nil
		}
	}
	if err = rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating over budget rows")
		return 0, err
	}

	return currentBudget, nil
}

func (repo *TransactionRepository) Delete(ctx context.Context, id string) error {
	_, err := repo.db.ExecContext(ctx, "DELETE FROM transactions WHERE id = $1 ", id)

	return err
}

// FindAllOfAllAccountsWithFilters retrieves all transactions across all user accounts with filtering and pagination
func (repo *TransactionRepository) FindAllOfAllAccountsWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]*transaction.Transaction, error) {
	query, args := repo.buildTransactionQuery(userId, filter, false)

	log.Debug().Str("query", query).Interface("args", args).Msg("executing transaction query")

	rows, err := repo.db.QueryContext(ctx, query, args...)
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

// FindAllWithFilters retrieves transactions for a specific account with filtering and pagination
func (repo *TransactionRepository) FindAllWithFilters(ctx context.Context, filter *dto.TransactionFilter) ([]*transaction.Transaction, error) {
	query, args := repo.buildTransactionQuery("", filter, false)

	log.Debug().Str("query", query).Interface("args", args).Msg("executing transaction query")

	rows, err := repo.db.QueryContext(ctx, query, args...)
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
	query, args := repo.buildTransactionQuery(userId, filter, true)

	log.Debug().Str("count_query", query).Interface("args", args).Msg("executing transaction count query")

	var count int64
	err := repo.db.QueryRowContext(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count transactions: %w", err)
	}

	return count, nil
}

// buildTransactionQuery constructs the SQL query with filters, sorting, and pagination
func (repo *TransactionRepository) buildTransactionQuery(userId string, filter *dto.TransactionFilter, isCount bool) (string, []interface{}) {
	var queryBuilder strings.Builder
	var args []interface{}
	argIndex := 1

	// SELECT clause
	if isCount {
		queryBuilder.WriteString("SELECT COUNT(*) FROM transactions")
	} else {
		queryBuilder.WriteString("SELECT id, transaction_name, transaction_description, amount, type_transation, account_id, category_id, budget_id, created_at FROM transactions")
	}

	// WHERE clause
	var whereConditions []string

	// User ID filter (for all accounts query)
	if userId != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("user_id = $%d", argIndex))
		args = append(args, userId)
		argIndex++
	}

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
		return queryBuilder.String(), args
	}

	// ORDER BY clause
	if filter.SortBy != "" {
		queryBuilder.WriteString(" ORDER BY ")
		queryBuilder.WriteString(filter.SortBy)
		if filter.SortOrder == "asc" || filter.SortOrder == "desc" {
			queryBuilder.WriteString(" ")
			queryBuilder.WriteString(strings.ToUpper(filter.SortOrder))
		} else {
			queryBuilder.WriteString(" DESC") // Default to DESC
		}
	} else {
		queryBuilder.WriteString(" ORDER BY created_at DESC") // Default sorting
	}

	// LIMIT and OFFSET for pagination (only if limit > 0)
	if filter.Limit > 0 {
		queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", argIndex))
		args = append(args, filter.Limit)
		argIndex++

		if filter.Offset > 0 {
			queryBuilder.WriteString(fmt.Sprintf(" OFFSET $%d", argIndex))
			args = append(args, filter.Offset)
			argIndex++
		}
	}

	return queryBuilder.String(), args
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
