import type { Account } from '@/types/account'

/**
 * Accounts that hold money and can fund something (a broker wallet, a
 * certificate payout). Credit cards are debt, never a funding source.
 */
export function isFundingAccount(account: Pick<Account, 'type'>): boolean {
	return account.type !== 'credit_card'
}
