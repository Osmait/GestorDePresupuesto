package i18n

// Key identifies a localized message.
type Key string

// Generated transaction names and descriptions.
const (
	CardPaymentName        Key = "tx.card_payment.name"
	CardPaymentDescription Key = "tx.card_payment.description" // %s: card name
	CardInterestName       Key = "tx.card_interest.name"
	CardInterestDesc       Key = "tx.card_interest.description" // %s: card name
	CardNameWithBank       Key = "card.name_with_bank"          // %s: bank
	CardNameFallback       Key = "card.name_fallback"

	BrokerFundingName        Key = "tx.broker_funding.name"
	BrokerFundingDescription Key = "tx.broker_funding.description"
	BrokerFundingFXDesc      Key = "tx.broker_funding.description_fx" // %s from, %s to, %s rate
	BrokerFeeName            Key = "tx.broker_fee.name"
	BrokerFeeDescription     Key = "tx.broker_fee.description"

	LoanDisbursementName        Key = "tx.loan_disbursement.name" // %s: borrower
	LoanDisbursementDescription Key = "tx.loan_disbursement.description"
	LoanPrincipalName           Key = "tx.loan_principal.name" // %s: borrower
	LoanPrincipalDescription    Key = "tx.loan_principal.description"
	LoanInterestName            Key = "tx.loan_interest.name" // %s: borrower
	LoanInterestDescription     Key = "tx.loan_interest.description"
	LoanRefundName              Key = "tx.loan_refund.name" // %s: borrower
	LoanRefundDescription       Key = "tx.loan_refund.description"

	CertificateInterestName        Key = "tx.certificate_interest.name"        // %s: bank
	CertificateInterestDescription Key = "tx.certificate_interest.description" // %s start, %s end

	BalanceAdjustmentName        Key = "tx.balance_adjustment.name"
	BalanceAdjustmentDescription Key = "tx.balance_adjustment.description"
)

// CategoryKey returns the message key of the name of the system category
// identified by systemKey (see domain/category.System).
func CategoryKey(systemKey string) Key {
	return Key("category." + systemKey)
}

var messages = map[Key]map[Locale]string{
	CardPaymentName:        {ES: "Pago de tarjeta", EN: "Card payment"},
	CardPaymentDescription: {ES: "Pago a %s", EN: "Payment to %s"},
	CardInterestName:       {ES: "Cargo por intereses", EN: "Interest charge"},
	CardInterestDesc:       {ES: "Intereses pagados a %s", EN: "Interest paid to %s"},
	CardNameWithBank:       {ES: "tarjeta %s", EN: "%s card"},
	CardNameFallback:       {ES: "tarjeta de crédito", EN: "credit card"},

	BrokerFundingName:        {ES: "Transferencia al bróker", EN: "Transfer to broker"},
	BrokerFundingDescription: {ES: "Fondeo de la cartera de inversión", EN: "Investment wallet funding"},
	BrokerFundingFXDesc:      {ES: "Fondeo del bróker convertido de %s a %s a la tasa %s", EN: "Broker funding converted from %s to %s at rate %s"},
	BrokerFeeName:            {ES: "Comisión de fondeo del bróker", EN: "Broker funding fee"},
	BrokerFeeDescription:     {ES: "Comisión bancaria/cambiaria por fondeo del bróker", EN: "Bank/FX fee for broker funding"},

	LoanDisbursementName:        {ES: "Préstamo a %s", EN: "Loan to %s"},
	LoanDisbursementDescription: {ES: "Desembolso de préstamo", EN: "Loan disbursement"},
	LoanPrincipalName:           {ES: "Cobro de capital - %s", EN: "Loan principal - %s"},
	LoanPrincipalDescription:    {ES: "Cobro de capital del préstamo", EN: "Principal collection for loan"},
	LoanInterestName:            {ES: "Intereses de préstamo - %s", EN: "Loan interest - %s"},
	LoanInterestDescription:     {ES: "Ingreso por intereses del préstamo", EN: "Interest income from loan"},
	LoanRefundName:              {ES: "Reembolso por cancelación de préstamo - %s", EN: "Loan cancellation refund - %s"},
	LoanRefundDescription:       {ES: "Reembolso del capital pendiente por cancelación del préstamo", EN: "Refund of remaining principal due to loan cancellation"},

	CertificateInterestName:        {ES: "%s - Pago de intereses", EN: "%s - Interest payment"},
	CertificateInterestDescription: {ES: "Pago de intereses del certificado del %s al %s", EN: "Certificate interest payment for period %s to %s"},

	BalanceAdjustmentName:        {ES: "Ajuste de saldo", EN: "Balance adjustment"},
	BalanceAdjustmentDescription: {ES: "Cuadre con el saldo del banco", EN: "Reconciled with the bank balance"},

	// System category names, keyed by domain/category.System.Key.
	CategoryKey("card_payment"):       {ES: "Pago de tarjeta", EN: "Card payment"},
	CategoryKey("loans_granted"):      {ES: "Préstamos otorgados", EN: "Loans granted"},
	CategoryKey("loan_collections"):   {ES: "Cobro de préstamos", EN: "Loan collections"},
	CategoryKey("loan_interest"):      {ES: "Intereses cobrados", EN: "Loan interest income"},
	CategoryKey("loan_cancellation"):  {ES: "Cancelación de préstamo", EN: "Loan cancellation"},
	CategoryKey("broker_funding"):     {ES: "Fondeo del bróker", EN: "Broker funding"},
	CategoryKey("investment_fees"):    {ES: "Comisiones de inversión", EN: "Investment fees"},
	CategoryKey("balance_adjustment"): {ES: "Ajuste de saldo", EN: "Balance adjustment"},
}
