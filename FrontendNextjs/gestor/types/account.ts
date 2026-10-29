export type AccountType = 'bank' | 'credit_card'

export interface Account {
	id: string
	name: string
	bank: string
	initial_balance: number
	current_balance?: number
	user_id: string
	type?: AccountType
	currency?: string
	created_at: string
	/** When the account was last checked against the bank's balance; absent if never. */
	last_reconciled_at?: string
}

/** One check of an account against the balance its bank showed. */
export interface AccountReconciliation {
	id: string
	account_id: string
	currency: string
	/** App balance before the check. */
	app_balance: number
	/** Balance the user typed from the bank. */
	bank_balance: number
	/** Adjustment transaction, absent when the balances matched (or it was deleted). */
	transaction_id?: string
	notes: string
	created_at: string
}

export interface ReconcileAccountInput {
	bank_balance: number
	currency?: string
	notes?: string
}

export interface ReconcileAccountResult {
	reconciliation: AccountReconciliation
	/** bank_balance - app_balance: what the adjustment moved. */
	difference: number
	adjusted: boolean
}
