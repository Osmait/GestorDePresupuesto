package postgress

import (
	"context"
	"database/sql"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
)

type LoanRepository struct {
	db *sql.DB
}

func NewLoanRepository(db *sql.DB) *LoanRepository {
	return &LoanRepository{db: db}
}

func (r *LoanRepository) SaveLoanWithInstallments(ctx context.Context, entity *loan.Loan, installments []*loan.Installment) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

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

	_, err = tx.ExecContext(
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

	return tx.Commit()
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

	rows, err := r.db.QueryContext(ctx, query, userId)
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
	query := `
		SELECT id, user_id, borrower_name, borrower_contact, principal_amount, currency, interest_mode,
			annual_rate, term_months, start_date, source_account_id, notes, total_interest, total_amount,
			paid_principal, paid_interest, status, disbursement_transaction_id, created_at, updated_at
		FROM loans
		WHERE id = $1 AND user_id = $2
	`

	entity := &loan.Loan{}
	err := r.db.QueryRowContext(ctx, query, id, userId).Scan(
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

	return entity, nil
}

func (r *LoanRepository) FindInstallmentsByLoan(ctx context.Context, loanId string) ([]*loan.Installment, error) {
	query := `
		SELECT id, loan_id, installment_number, due_date, expected_amount,
			paid_amount, status, paid_at, created_at, updated_at
		FROM loan_installments
		WHERE loan_id = $1
		ORDER BY installment_number ASC
	`

	rows, err := r.db.QueryContext(ctx, query, loanId)
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

func (r *LoanRepository) FindPaymentsByLoan(ctx context.Context, loanId string) ([]*loan.Payment, error) {
	query := `
		SELECT id, loan_id, destination_account_id, amount, principal_component,
			interest_component, payment_date, income_transaction_id, notes, created_at
		FROM loan_payments
		WHERE loan_id = $1
		ORDER BY payment_date DESC, created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, loanId)
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

func (r *LoanRepository) SavePayment(ctx context.Context, payment *loan.Payment) error {
	query := `
		INSERT INTO loan_payments (
			id, loan_id, destination_account_id, amount, principal_component,
			interest_component, payment_date, income_transaction_id, notes, created_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10
		)
	`

	_, err := r.db.ExecContext(
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

	_, err := r.db.ExecContext(
		ctx,
		query,
		entity.PaidPrincipal,
		entity.PaidInterest,
		entity.Status,
		entity.UpdatedAt,
		entity.Id,
		entity.UserId,
	)

	return err
}

func (r *LoanRepository) BulkUpdateInstallments(ctx context.Context, installments []*loan.Installment) error {
	if len(installments) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	query := `
		UPDATE loan_installments
		SET paid_amount = $1,
			status = $2,
			paid_at = $3,
			updated_at = $4
		WHERE id = $5
	`

	for _, installment := range installments {
		_, err = tx.ExecContext(
			ctx,
			query,
			installment.PaidAmount,
			installment.Status,
			installment.PaidAt,
			installment.UpdatedAt,
			installment.Id,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *LoanRepository) UpdateLoanStatus(ctx context.Context, loanId string, userId string, status loan.LoanStatus) error {
	_, err := r.db.ExecContext(
		ctx,
		`UPDATE loans SET status = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`,
		status,
		time.Now(),
		loanId,
		userId,
	)
	return err
}
