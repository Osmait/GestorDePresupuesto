import { Account } from '@/types/account'
import { Budget } from '@/types/budget'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'

export interface SearchLoanItem {
	id: string
	borrower_name: string
	pending_amount: number
	total_amount: number
	currency: string
	status: string
}

export interface SearchCertificateItem {
	id: string
	bank: string
	base_capital: number
	currency: string
	status: string
}

export interface SearchResponse {
	transactions: Transaction[]
	categories: Category[]
	accounts: Account[]
	budgets: Budget[]
	loans: SearchLoanItem[]
	certificates: SearchCertificateItem[]
}
