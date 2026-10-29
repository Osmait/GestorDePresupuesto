import { Transaction, TypeTransaction } from '@/types/transaction'

/**
 * Transaction types that add money to the account. The API always sends
 * positive amounts; the direction comes from `type_transation`.
 */
const INFLOW_TYPES = new Set<string>([
	TypeTransaction.INCOME,
	TypeTransaction.LOAN_COLLECTION,
	'loan_cancellation_refund',
	TypeTransaction.ADJUSTMENT_IN,
	TypeTransaction.CARD_PAYMENT_RECEIVED,
])

export function isInflowTransaction(type: string | null | undefined): boolean {
	return !!type && INFLOW_TYPES.has(type)
}

const ADJUSTMENT_TYPES = new Set<string>([TypeTransaction.ADJUSTMENT_IN, TypeTransaction.ADJUSTMENT_OUT])

/** Balance adjustments written by "reconcile balance", card resets and initial card debt. */
export function isAdjustmentTransaction(type: string | null | undefined): boolean {
	return !!type && ADJUSTMENT_TYPES.has(type)
}

/**
 * Whether the transaction form may edit it. Not for adjustments and card
 * payments received: the form only knows income/bill and would turn one into
 * an expense.
 */
export function isEditableTransaction(type: string | null | undefined): boolean {
	return !isAdjustmentTransaction(type) && type !== TypeTransaction.CARD_PAYMENT_RECEIVED
}

/**
 * Whether it can be deleted on its own. Deleting an adjustment undoes it; a
 * card payment received is one side of a payment (the paying account keeps
 * its card_payment), so it is not deletable alone.
 */
export function isDeletableTransaction(type: string | null | undefined): boolean {
	return type !== TypeTransaction.CARD_PAYMENT_RECEIVED
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
		case TypeTransaction.CARD_PAYMENT:
			return 'types.card_payment'
		case TypeTransaction.CARD_PAYMENT_RECEIVED:
			return 'types.card_payment_received'
		case TypeTransaction.ADJUSTMENT_IN:
			return 'types.adjustment_in'
		case TypeTransaction.ADJUSTMENT_OUT:
			return 'types.adjustment_out'
		default:
			return 'types.unknown'
	}
}
