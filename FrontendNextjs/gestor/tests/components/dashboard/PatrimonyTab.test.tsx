import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PatrimonyTab } from '@/components/dashboard/PatrimonyTab'
import { renderWithIntl } from '@/tests/utils/intl'

vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/components/charts/chart-theme', () => ({
	useChartTheme: () => ({ colors: { series: ['#1', '#2', '#3'] } }),
}))

const labels = {
	title: 'Net worth',
	accounts: 'Accounts',
	investments: 'Investments',
	certificates: 'Certificates',
	cardDebt: 'Credit card debt',
	total: 'Total net worth',
	activeItems: 'active',
	exchangeRate: 'Rate',
	distribution: 'Distribution',
	noData: 'No data',
}

describe('PatrimonyTab', () => {
	it('subtracts credit card debt from the net worth and shows it', () => {
		renderWithIntl(
			<PatrimonyTab
				accountsTotal={295118.21}
				investmentsTotal={0}
				certificatesTotal={0}
				creditCardDebt={8300}
				creditCardsCount={3}
				accountsCount={2}
				investmentsCount={0}
				certificatesCount={0}
				labels={labels}
			/>,
		)
		expect(screen.getByText('Credit card debt')).toBeInTheDocument()
		expect(screen.getByText('-RD$8,300.00')).toHaveClass('text-destructive')
		expect(screen.getByText('3 active')).toBeInTheDocument()
		// 295,118.21 - 8,300
		expect(screen.getAllByText('RD$286,818.21').length).toBeGreaterThan(0)
		// The distribution splits the assets, never above 100%.
		expect(screen.getByText('100%')).toBeInTheDocument()
	})

	it('has no debt card without credit cards', () => {
		renderWithIntl(
			<PatrimonyTab
				accountsTotal={1000}
				investmentsTotal={0}
				certificatesTotal={0}
				accountsCount={1}
				investmentsCount={0}
				certificatesCount={0}
				labels={labels}
			/>,
		)
		expect(screen.queryByText('Credit card debt')).not.toBeInTheDocument()
	})
})
