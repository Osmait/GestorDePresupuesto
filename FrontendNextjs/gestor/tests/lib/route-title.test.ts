import { describe, expect, it } from 'vitest'
import { getRouteTitleKeys } from '@/lib/navigation/route-title'

describe('getRouteTitleKeys', () => {
	it('returns the dashboard for /app and unknown routes', () => {
		expect(getRouteTitleKeys('/app')).toEqual({ title: 'dashboard', description: 'dashboardDesc' })
		expect(getRouteTitleKeys('/app/unknown')).toEqual({ title: 'dashboard', description: 'dashboardDesc' })
		expect(getRouteTitleKeys(null)).toEqual({ title: 'dashboard', description: 'dashboardDesc' })
	})

	it('maps each section, including nested routes and trailing slashes', () => {
		expect(getRouteTitleKeys('/app/accounts').title).toBe('accounts')
		expect(getRouteTitleKeys('/app/accounts/123').title).toBe('accounts')
		expect(getRouteTitleKeys('/app/transactions/').title).toBe('transactions')
		expect(getRouteTitleKeys('/app/budget').title).toBe('budgets')
		expect(getRouteTitleKeys('/app/analysis').title).toBe('analytics')
		expect(getRouteTitleKeys('/app/credit-cards').description).toBe('creditCardsDesc')
	})

	it('does not match a prefix of a different segment', () => {
		expect(getRouteTitleKeys('/app/accountsx').title).toBe('dashboard')
	})
})
