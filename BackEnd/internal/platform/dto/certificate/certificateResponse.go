package dto

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type CertificateResponse struct {
	Id                  string                        `json:"id"`
	Bank                string                        `json:"bank"`
	BaseCapital         money.Amount                  `json:"base_capital"`
	InterestType        certificate.InterestType      `json:"interest_type"`
	CurrentInterestRate money.Amount                  `json:"current_interest_rate"`
	CurrentTaxRate      money.Amount                  `json:"current_tax_rate"`
	CutDay              int                           `json:"cut_day"`
	ReinvestInterest    bool                          `json:"reinvest_interest"`
	PayoutAccountId     *string                       `json:"payout_account_id"`
	MaturityDate        *time.Time                    `json:"maturity_date"`
	Status              certificate.CertificateStatus `json:"status"`
	Currency            string                        `json:"currency"`
	CreatedAt           time.Time                     `json:"created_at"`
	UpdatedAt           time.Time                     `json:"updated_at"`
	EffectiveCapital    money.Amount                  `json:"effective_capital"`
	NextPaymentDate     *time.Time                    `json:"next_payment_date"`
	ProjectedPayment    *ProjectedPaymentResponse     `json:"projected_payment"`
}

type ProjectedPaymentResponse struct {
	GrossInterest money.Amount `json:"gross_interest"`
	TaxWithheld   money.Amount `json:"tax_withheld"`
	NetInterest   money.Amount `json:"net_interest"`
}

type CertificateSummaryResponse struct {
	TotalCapital       money.Amount `json:"total_capital"`
	TotalGrossInterest money.Amount `json:"total_gross_interest"`
	TotalTaxWithheld   money.Amount `json:"total_tax_withheld"`
	TotalNetInterest   money.Amount `json:"total_net_interest"`
	PortfolioValue     money.Amount `json:"portfolio_value"`
	ActiveCertificates int          `json:"active_certificates"`
}

type CertificateWithHistoryResponse struct {
	CertificateResponse
	Payments []PaymentResponse          `json:"payments"`
	Summary  CertificateSummaryResponse `json:"summary"`
}

type PaymentResponse struct {
	Id             string       `json:"id"`
	CertificateId  string       `json:"certificate_id"`
	PaymentDate    time.Time    `json:"payment_date"`
	PeriodStart    time.Time    `json:"period_start"`
	PeriodEnd      time.Time    `json:"period_end"`
	GrossInterest  money.Amount `json:"gross_interest"`
	TaxWithheld    money.Amount `json:"tax_withheld"`
	NetInterest    money.Amount `json:"net_interest"`
	AppliedRate    money.Amount `json:"applied_rate"`
	AppliedTaxRate money.Amount `json:"applied_tax_rate"`
	AppliedCapital money.Amount `json:"applied_capital"`
	TransactionId  *string      `json:"transaction_id"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      *time.Time   `json:"updated_at"`
}

type SimulationResponse struct {
	Payments []ProjectedPaymentResponse `json:"payments"`
	Totals   SimulationTotals           `json:"totals"`
}

type SimulationTotals struct {
	GrossInterest money.Amount `json:"gross_interest"`
	TaxWithheld   money.Amount `json:"tax_withheld"`
	NetInterest   money.Amount `json:"net_interest"`
}

func NewCertificateResponse(cert *certificate.Certificate, effectiveCapital money.Amount, nextPaymentDate *time.Time, projected *ProjectedPaymentResponse) *CertificateResponse {
	return &CertificateResponse{
		Id:                  cert.Id,
		Bank:                cert.Bank,
		BaseCapital:         cert.BaseCapital,
		InterestType:        cert.InterestType,
		CurrentInterestRate: cert.CurrentInterestRate,
		CurrentTaxRate:      cert.CurrentTaxRate,
		CutDay:              cert.CutDay,
		ReinvestInterest:    cert.ReinvestInterest,
		PayoutAccountId:     cert.PayoutAccountId,
		MaturityDate:        cert.MaturityDate,
		Status:              cert.Status,
		Currency:            cert.Currency,
		CreatedAt:           cert.CreatedAt,
		UpdatedAt:           cert.UpdatedAt,
		EffectiveCapital:    effectiveCapital,
		NextPaymentDate:     nextPaymentDate,
		ProjectedPayment:    projected,
	}
}

func NewPaymentResponse(payment *certificate.CertificatePayment) *PaymentResponse {
	return &PaymentResponse{
		Id:             payment.Id,
		CertificateId:  payment.CertificateId,
		PaymentDate:    payment.PaymentDate,
		PeriodStart:    payment.PeriodStart,
		PeriodEnd:      payment.PeriodEnd,
		GrossInterest:  payment.GrossInterest,
		TaxWithheld:    payment.TaxWithheld,
		NetInterest:    payment.NetInterest,
		AppliedRate:    payment.AppliedRate,
		AppliedTaxRate: payment.AppliedTaxRate,
		AppliedCapital: payment.AppliedCapital,
		TransactionId:  payment.TransactionId,
		CreatedAt:      payment.CreatedAt,
		UpdatedAt:      payment.UpdatedAt,
	}
}
