package postgress

import (
	"context"
	"database/sql"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

type LoanRepository struct {
	db *sql.DB
}

func NewLoanRepository(db *sql.DB) *LoanRepository {
	return &LoanRepository{db: db}
}

func (r *LoanRepository) SaveLoanWithInstallments(ctx context.Context, entity *loan.Loan, installments []*loan.Installment) error {
	if err := ownership.VerifyReference(ctx, txhelper.FromContext(ctx, r.db), entity.UserId, ownership.Account, entity.SourceAccountId); err != nil {
		return err
	}

	// Loan and installments are written atomically, inside the request
	// transaction when there is one.
	return txhelper.InTx(ctx, r.db, func(tx txhelper.Querier) error {
		loanQuery := `
			INSERT INTO loans (
				id, user_id, borrower_name, borrower_contact, principal_amount, currency, interest_mode,
				annual_rate, term_months, start_date, source_account_id, notes, total_interest, total_amount,
				paid_principal, paid_interest, status, disbursement_transaction_id, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7,
				$8, $9, $10, $11, $12, $13, $14,
				$15, $16, $17, $18, $19, $20
			)
		`

		_, err := tx.ExecContext(
			ctx,
			loanQuery,
			entity.Id,
			entity.UserId,
			entity.BorrowerName,
			entity.BorrowerContact,
			entity.PrincipalAmount,
			entity.Currency,
			entity.InterestMode,
			entity.AnnualRate,
			entity.TermMonths,
			entity.StartDate,
			entity.SourceAccountId,
			entity.Notes,
			entity.TotalInterest,
			entity.TotalAmount,
			entity.PaidPrincipal,
			entity.PaidInterest,
			entity.Status,
			entity.DisbursementTransaction,
			entity.CreatedAt,
			entity.UpdatedAt,
		)
		if err != nil {
			return err
		}

		installmentQuery := `
			INSERT INTO loan_installments (
				id, loan_id, installment_number, due_date, expected_amount,
				paid_amount, status, paid_at, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9, $10
			)
		`

		for _, installment := range installments {
			_, err = tx.ExecContext(
				ctx,
				installmentQuery,
				installment.Id,
				installment.LoanId,
				installment.InstallmentNumber,
				installment.DueDate,
				installment.ExpectedAmount,
				installment.PaidAmount,
				installment.Status,
				installment.PaidAt,
				installment.CreatedAt,
				installment.UpdatedAt,
			)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *LoanRepository) FindAllByUser(ctx context.Context, userId string) ([]*loan.Loan, error) {
	query := `
		SELECT id, user_id, borrower_name, borrower_contact, principal_amount, currency, interest_mode,
			annual_rate, term_months, start_date, source_account_id, notes, total_interest, total_amount,
			paid_principal, paid_interest, status, disbursement_transaction_id, created_at, updated_at
		FROM loans
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var results []*loan.Loan
	for rows.Next() {
		entity := &loan.Loan{}
		err = rows.Scan(
			&entity.Id,
			&entity.UserId,
			&entity.BorrowerName,
			&entity.BorrowerContact,
			&entity.PrincipalAmount,
			&entity.Currency,
			&entity.InterestMode,
			&entity.AnnualRate,
			&entity.TermMonths,
			&entity.StartDate,
			&entity.SourceAccountId,
			&entity.Notes,
			&entity.TotalInterest,
			&entity.TotalAmount,
			&entity.PaidPrincipal,
			&entity.PaidInterest,
			&entity.Status,
			&entity.DisbursementTransaction,
			&entity.CreatedAt,
			&entity.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, entity)
	}

	return results, rows.Err()
}

func (r *LoanRepository) FindById(ctx context.Context, id string, userId string) (*loan.Loan, error) {
	return r.findById(ctx, id, userId, false)
}

// FindByIdForUpdate is FindById plus a row lock (SELECT ... FOR UPDATE) held
// until the request transaction ends. Services lock the loan before
// read-modify-write of its paid totals so concurrent payments serialise
// instead of overwriting each other.
func (r *LoanRepository) FindByIdForUpdate(ctx context.Context, id string, userId string) (*loan.Loan, error) {
	return r.findById(ctx, id, userId, true)
}

func (r *LoanRepository) findById(ctx context.Context, id string, userId string, forUpdate bool) (*loan.Loan, error) {
	query := `
		SELECT id, user_id, borrower_name, borrower_contact, principal_amount, currency, interest_mode,
			annual_rate, term_months, start_date, source_account_id, notes, total_interest, total_amount,
			paid_principal, paid_interest, status, disbursement_transaction_id, created_at, updated_at
		FROM loans
		WHERE id = $1 AND user_id = $2
	`
	if forUpdate {
		query += " FOR UPDATE"
	}

	entity := &loan.Loan{}
	err := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, id, userId).Scan(
		&entity.Id,
		&entity.UserId,
		&entity.BorrowerName,
		&entity.BorrowerContact,
		&entity.PrincipalAmount,
		&entity.Currency,
		&entity.InterestMode,
		&entity.AnnualRate,
		&entity.TermMonths,
		&entity.StartDate,
		&entity.SourceAccountId,
		&entity.Notes,
		&entity.TotalInterest,
		&entity.TotalAmount,
		&entity.PaidPrincipal,
		&entity.PaidInterest,
		&entity.Status,
		&entity.DisbursementTransaction,
		&entity.CreatedAt,
		&entity.UpdatedAt,
	)
	if err != nil {
		return nil, ownership.NotFoundIfNoRows(err)
	}

	return entity, nil
}

// ownedLoanClause restricts loan_id to the loans of the user bound to placeholder.
// loan_installments and loan_payments have no user_id column of their own.
func ownedLoanClause(placeholder string) string {
	return "loan_id IN (SELECT id FROM loans WHERE user_id = " + placeholder + ")"
}

func (r *LoanRepository) FindInstallmentsByLoan(ctx context.Context, loanId string, userId string) ([]*loan.Installment, error) {
	query := `
		SELECT id, loan_id, installment_number, due_date, expected_amount,
			paid_amount, status, paid_at, created_at, updated_at
		FROM loan_installments
		WHERE loan_id = $1 AND ` + ownedLoanClause("$2") + `
		ORDER BY installment_number ASC
	`

	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, loanId, userId)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var results []*loan.Installment
	for rows.Next() {
		item := &loan.Installment{}
		err = rows.Scan(
			&item.Id,
			&item.LoanId,
			&item.InstallmentNumber,
			&item.DueDate,
			&item.ExpectedAmount,
			&item.PaidAmount,
			&item.Status,
			&item.PaidAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, item)
	}

	return results, rows.Err()
}

func (r *LoanRepository) FindPaymentsByLoan(ctx context.Context, loanId string, userId string) ([]*loan.Payment, error) {
	query := `
		SELECT id, loan_id, destination_account_id, amount, principal_component,
			interest_component, payment_date, income_transaction_id, notes, created_at
		FROM loan_payments
		WHERE loan_id = $1 AND ` + ownedLoanClause("$2") + `
		ORDER BY payment_date DESC, created_at DESC
	`

	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, loanId, userId)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var results []*loan.Payment
	for rows.Next() {
		item := &loan.Payment{}
		err = rows.Scan(
			&item.Id,
			&item.LoanId,
			&item.DestinationAccountId,
			&item.Amount,
			&item.PrincipalComponent,
			&item.InterestComponent,
			&item.PaymentDate,
			&item.IncomeTransactionId,
			&item.Notes,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, item)
	}

	return results, rows.Err()
}

// SavePayment stores a loan payment. The loan and the destination account must
// both belong to userId, otherwise ownership.ErrReferenceNotOwned is returned.
func (r *LoanRepository) SavePayment(ctx context.Context, payment *loan.Payment, userId string) error {
	q := txhelper.FromContext(ctx, r.db)
	var loanOwned bool
	if err := q.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM loans WHERE id = $1 AND user_id = $2)", payment.LoanId, userId).Scan(&loanOwned); err != nil {
		return err
	}
	if !loanOwned {
		return ownership.ErrNotFound
	}
	if err := ownership.VerifyReference(ctx, q, userId, ownership.Account, payment.DestinationAccountId); err != nil {
		return err
	}

	query := `
		INSERT INTO loan_payments (
			id, loan_id, destination_account_id, amount, principal_component,
			interest_component, payment_date, income_transaction_id, notes, created_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10
		)
	`

	_, err := q.ExecContext(
		ctx,
		query,
		payment.Id,
		payment.LoanId,
		payment.DestinationAccountId,
		payment.Amount,
		payment.PrincipalComponent,
		payment.InterestComponent,
		payment.PaymentDate,
		payment.IncomeTransactionId,
		payment.Notes,
		payment.CreatedAt,
	)

	return err
}

func (r *LoanRepository) UpdateLoanTotals(ctx context.Context, entity *loan.Loan) error {
	query := `
		UPDATE loans
		SET paid_principal = $1,
			paid_interest = $2,
			status = $3,
			updated_at = $4
		WHERE id = $5 AND user_id = $6
	`

	result, err := txhelper.FromContext(ctx, r.db).ExecContext(
		ctx,
		query,
		entity.PaidPrincipal,
		entity.PaidInterest,
		entity.Status,
		entity.UpdatedAt,
		entity.Id,
		entity.UserId,
	)
	if err != nil {
		return err
	}

	return ownership.RequireAffected(result)
}

// BulkUpdateInstallments updates installments of loans owned by userId;
// installments of other users' loans are left untouched.
func (r *LoanRepository) BulkUpdateInstallments(ctx context.Context, installments []*loan.Installment, userId string) error {
	if len(installments) == 0 {
		return nil
	}

	return txhelper.InTx(ctx, r.db, func(tx txhelper.Querier) error {
		query := `
			UPDATE loan_installments
			SET paid_amount = $1,
				status = $2,
				paid_at = $3,
				updated_at = $4
			WHERE id = $5 AND ` + ownedLoanClause("$6") + `
		`

		for _, installment := range installments {
			_, err := tx.ExecContext(
				ctx,
				query,
				installment.PaidAmount,
				installment.Status,
				installment.PaidAt,
				installment.UpdatedAt,
				installment.Id,
				userId,
			)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *LoanRepository) UpdateLoanStatus(ctx context.Context, loanId string, userId string, status loan.LoanStatus) error {
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(
		ctx,
		`UPDATE loans SET status = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`,
		status,
		time.Now(),
		loanId,
		userId,
	)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}
