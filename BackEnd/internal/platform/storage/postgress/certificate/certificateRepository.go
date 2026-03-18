package postgress

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

type CertificateRepository struct {
	db *sql.DB
}

func NewCertificateRepository(db *sql.DB) *CertificateRepository {
	return &CertificateRepository{db: db}
}

func (r *CertificateRepository) Save(ctx context.Context, cert *certificate.Certificate) error {
	query := `INSERT INTO certificates (id, user_id, bank, base_capital, interest_type, current_interest_rate, 
		current_tax_rate, cut_day, reinvest_interest, payout_account_id, maturity_date, status, currency, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, cert.Id, cert.UserId, cert.Bank, cert.BaseCapital, cert.InterestType,
		cert.CurrentInterestRate, cert.CurrentTaxRate, cert.CutDay, cert.ReinvestInterest, cert.PayoutAccountId,
		cert.MaturityDate, cert.Status, cert.Currency, cert.CreatedAt, cert.UpdatedAt)
	if err != nil {
		log.Error().Err(err).
			Str("id", cert.Id).
			Str("user_id", cert.UserId).
			Str("bank", cert.Bank).
			Float64("base_capital", cert.BaseCapital).
			Str("interest_type", string(cert.InterestType)).
			Interface("payout_account_id", cert.PayoutAccountId).
			Interface("maturity_date", cert.MaturityDate).
			Msg("Failed to save certificate to database")
	}
	return err
}

func (r *CertificateRepository) FindAll(ctx context.Context, userId string) ([]*certificate.Certificate, error) {
	query := `SELECT id, user_id, bank, base_capital, interest_type, current_interest_rate, current_tax_rate,
		cut_day, reinvest_interest, payout_account_id, maturity_date, status, currency, created_at, updated_at
		FROM certificates WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var certificates []*certificate.Certificate
	for rows.Next() {
		cert := &certificate.Certificate{}
		if err = rows.Scan(&cert.Id, &cert.UserId, &cert.Bank, &cert.BaseCapital, &cert.InterestType,
			&cert.CurrentInterestRate, &cert.CurrentTaxRate, &cert.CutDay, &cert.ReinvestInterest,
			&cert.PayoutAccountId, &cert.MaturityDate, &cert.Status, &cert.Currency, &cert.CreatedAt, &cert.UpdatedAt); err == nil {
			certificates = append(certificates, cert)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return certificates, nil
}

func (r *CertificateRepository) FindActiveByUser(ctx context.Context, userId string) ([]*certificate.Certificate, error) {
	query := `SELECT id, user_id, bank, base_capital, interest_type, current_interest_rate, current_tax_rate,
		cut_day, reinvest_interest, payout_account_id, maturity_date, status, currency, created_at, updated_at
		FROM certificates WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var certificates []*certificate.Certificate
	for rows.Next() {
		cert := &certificate.Certificate{}
		if err = rows.Scan(&cert.Id, &cert.UserId, &cert.Bank, &cert.BaseCapital, &cert.InterestType,
			&cert.CurrentInterestRate, &cert.CurrentTaxRate, &cert.CutDay, &cert.ReinvestInterest,
			&cert.PayoutAccountId, &cert.MaturityDate, &cert.Status, &cert.Currency, &cert.CreatedAt, &cert.UpdatedAt); err == nil {
			certificates = append(certificates, cert)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return certificates, nil
}

func (r *CertificateRepository) FindById(ctx context.Context, id string, userId string) (*certificate.Certificate, error) {
	query := `SELECT id, user_id, bank, base_capital, interest_type, current_interest_rate, current_tax_rate,
		cut_day, reinvest_interest, payout_account_id, maturity_date, status, currency, created_at, updated_at
		FROM certificates WHERE id = $1 AND user_id = $2`
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, id, userId)

	cert := &certificate.Certificate{}
	err := row.Scan(&cert.Id, &cert.UserId, &cert.Bank, &cert.BaseCapital, &cert.InterestType,
		&cert.CurrentInterestRate, &cert.CurrentTaxRate, &cert.CutDay, &cert.ReinvestInterest,
		&cert.PayoutAccountId, &cert.MaturityDate, &cert.Status, &cert.Currency, &cert.CreatedAt, &cert.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return cert, nil
}

func (r *CertificateRepository) Update(ctx context.Context, cert *certificate.Certificate) error {
	query := `UPDATE certificates SET bank = $1, base_capital = $2, current_interest_rate = $3, current_tax_rate = $4,
		cut_day = $5, reinvest_interest = $6, payout_account_id = $7, maturity_date = $8, status = $9, updated_at = $10
		WHERE id = $11 AND user_id = $12`
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, cert.Bank, cert.BaseCapital, cert.CurrentInterestRate,
		cert.CurrentTaxRate, cert.CutDay, cert.ReinvestInterest, cert.PayoutAccountId, cert.MaturityDate,
		cert.Status, cert.UpdatedAt, cert.Id, cert.UserId)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *CertificateRepository) Delete(ctx context.Context, id string, userId string) error {
	query := `UPDATE certificates SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND user_id = $2`
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, id, userId)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *CertificateRepository) UpdateStatus(ctx context.Context, id string, status certificate.CertificateStatus) error {
	query := `UPDATE certificates SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, status, id)
	return err
}

func (r *CertificateRepository) SavePayment(ctx context.Context, payment *certificate.CertificatePayment) error {
	query := `INSERT INTO certificate_payments (id, certificate_id, user_id, payment_date, period_start, period_end,
		gross_interest, tax_withheld, net_interest, applied_rate, applied_tax_rate, applied_capital, payout_account_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, payment.Id, payment.CertificateId, payment.UserId, payment.PaymentDate,
		payment.PeriodStart, payment.PeriodEnd, payment.GrossInterest, payment.TaxWithheld, payment.NetInterest,
		payment.AppliedRate, payment.AppliedTaxRate, payment.AppliedCapital, payment.PayoutAccountId, payment.CreatedAt)
	return err
}

func (r *CertificateRepository) FindPaymentsByCertificate(ctx context.Context, certificateId string) ([]*certificate.CertificatePayment, error) {
	query := `SELECT id, certificate_id, user_id, payment_date, period_start, period_end, gross_interest, tax_withheld,
		net_interest, applied_rate, applied_tax_rate, applied_capital, payout_account_id, transaction_id, created_at, updated_at
		FROM certificate_payments WHERE certificate_id = $1 ORDER BY payment_date DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, certificateId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var payments []*certificate.CertificatePayment
	for rows.Next() {
		p := &certificate.CertificatePayment{}
		if err = rows.Scan(&p.Id, &p.CertificateId, &p.UserId, &p.PaymentDate, &p.PeriodStart, &p.PeriodEnd,
			&p.GrossInterest, &p.TaxWithheld, &p.NetInterest, &p.AppliedRate, &p.AppliedTaxRate,
			&p.AppliedCapital, &p.PayoutAccountId, &p.TransactionId, &p.CreatedAt, &p.UpdatedAt); err == nil {
			payments = append(payments, p)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}

func (r *CertificateRepository) FindLastPayment(ctx context.Context, certificateId string) (*certificate.CertificatePayment, error) {
	query := `SELECT id, certificate_id, user_id, payment_date, period_start, period_end, gross_interest, tax_withheld,
		net_interest, applied_rate, applied_tax_rate, applied_capital, payout_account_id, transaction_id, created_at, updated_at
		FROM certificate_payments WHERE certificate_id = $1 ORDER BY payment_date DESC LIMIT 1`
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, certificateId)

	p := &certificate.CertificatePayment{}
	err := row.Scan(&p.Id, &p.CertificateId, &p.UserId, &p.PaymentDate, &p.PeriodStart, &p.PeriodEnd,
		&p.GrossInterest, &p.TaxWithheld, &p.NetInterest, &p.AppliedRate, &p.AppliedTaxRate,
		&p.AppliedCapital, &p.PayoutAccountId, &p.TransactionId, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *CertificateRepository) FindAllPayments(ctx context.Context, userId string) ([]*certificate.CertificatePayment, error) {
	query := `SELECT id, certificate_id, user_id, payment_date, period_start, period_end, gross_interest, tax_withheld,
		net_interest, applied_rate, applied_tax_rate, applied_capital, payout_account_id, transaction_id, created_at, updated_at
		FROM certificate_payments WHERE user_id = $1 ORDER BY payment_date DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var payments []*certificate.CertificatePayment
	for rows.Next() {
		p := &certificate.CertificatePayment{}
		if err = rows.Scan(&p.Id, &p.CertificateId, &p.UserId, &p.PaymentDate, &p.PeriodStart, &p.PeriodEnd,
			&p.GrossInterest, &p.TaxWithheld, &p.NetInterest, &p.AppliedRate, &p.AppliedTaxRate,
			&p.AppliedCapital, &p.PayoutAccountId, &p.TransactionId, &p.CreatedAt, &p.UpdatedAt); err == nil {
			payments = append(payments, p)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}

func (r *CertificateRepository) FindPaymentById(ctx context.Context, paymentId string, userId string) (*certificate.CertificatePayment, error) {
	query := `SELECT id, certificate_id, user_id, payment_date, period_start, period_end, gross_interest, tax_withheld,
		net_interest, applied_rate, applied_tax_rate, applied_capital, payout_account_id, transaction_id, created_at, updated_at
		FROM certificate_payments WHERE id = $1 AND user_id = $2`
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, paymentId, userId)

	p := &certificate.CertificatePayment{}
	err := row.Scan(&p.Id, &p.CertificateId, &p.UserId, &p.PaymentDate, &p.PeriodStart, &p.PeriodEnd,
		&p.GrossInterest, &p.TaxWithheld, &p.NetInterest, &p.AppliedRate, &p.AppliedTaxRate,
		&p.AppliedCapital, &p.PayoutAccountId, &p.TransactionId, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *CertificateRepository) UpdatePayment(ctx context.Context, payment *certificate.CertificatePayment) error {
	query := `UPDATE certificate_payments SET payment_date = $1, period_start = $2, period_end = $3,
		gross_interest = $4, tax_withheld = $5, net_interest = $6, applied_rate = $7, applied_tax_rate = $8,
		applied_capital = $9, updated_at = $10
		WHERE id = $11 AND user_id = $12`
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, payment.PaymentDate, payment.PeriodStart, payment.PeriodEnd,
		payment.GrossInterest, payment.TaxWithheld, payment.NetInterest, payment.AppliedRate, payment.AppliedTaxRate,
		payment.AppliedCapital, payment.UpdatedAt, payment.Id, payment.UserId)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *CertificateRepository) UpdatePaymentTransaction(ctx context.Context, paymentId string, transactionId string) error {
	query := `UPDATE certificate_payments SET transaction_id = $1 WHERE id = $2`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, transactionId, paymentId)
	return err
}
