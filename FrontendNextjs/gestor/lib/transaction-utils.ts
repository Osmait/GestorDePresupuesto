import { Transaction, TypeTransaction } from '@/types/transaction'

/**
 * Transaction types that add money to the account. The API always sends
 * positive amounts; the direction comes from `type_transation`.
 */
const INFLOW_TYPES = new Set<string>([
	TypeTransaction.INCOME,
	TypeTransaction.LOAN_COLLECTION,
	'loan_cancellation_refund',
])

export function isInflowTransaction(type: string | null | undefined): boolean {
	return !!type && INFLOW_TYPES.has(type)
}

/** Amount with the sign it has on the account balance (expenses negative). */
export function getSignedAmount(transaction: Pick<Transaction, 'amount' | 'type_transation'>): number {
	const magnitude = Math.abs(transaction.amount || 0)
	return isInflowTransaction(transaction.type_transation) ? magnitude : -magnitude
}

/** i18n key (under `transactions.types`) for a transaction type value such as `bill`. */
export function getTransactionTypeKey(type: string | null | undefined): string {
	switch (type) {
		case TypeTransaction.INCOME:
			return 'types.income'
		case TypeTransaction.BILL:
			return 'types.bill'
		case TypeTransaction.LOAN_DISBURSEMENT:
			return 'types.loan_disbursement'
		case TypeTransaction.LOAN_COLLECTION:
			return 'types.loan_collection'
		case TypeTransaction.INVESTMENT_PURCHASE:
			return 'types.investment_purchase'
		case TypeTransaction.INVESTMENT_FUNDING:
			return 'types.investment_funding'
		case 'loan_cancellation_refund':
			return 'types.loan_cancellation_refund'
		default:
			return 'types.unknown'
	}
}
