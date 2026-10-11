import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvestmentList } from '@/components/investments/InvestmentList'
import { renderWithIntl } from '@/tests/utils/intl'
import { type Investment, InvestmentType } from '@/types/investment'

const mockDelete = vi.fn()
let mockInvestments: Investment[] = []

vi.mock('@/hooks/queries/useInvestmentsQuery', () => ({
	useGetInvestments: () => ({ data: mockInvestments, isLoading: false }),
	useDeleteInvestmentMutation: () => ({ mutateAsync: mockDelete }),
}))

const apple: Investment = {
	id: 'inv1',
	name: 'Apple Inc.',
	symbol: 'AAPL',
	type: InvestmentType.STOCK,
	quantity: 10,
	purchase_price: 150,
	current_price: 180,
	user_id: 'u1',
	created_at: '',
}

describe('InvestmentList', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockInvestments = [apple]
		mockDelete.mockResolvedValue(undefined)
	})

	it('shows an empty state with a create action for an empty category', async () => {
		const user = userEvent.setup()
		const onAdd = vi.fn()
		renderWithIntl(<InvestmentList type={InvestmentType.CRYPTO} onEdit={vi.fn()} onAdd={onAdd} />)

		expect(screen.getByRole('heading', { name: 'No investments of this type yet' })).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Add investment' }))
		expect(onAdd).toHaveBeenCalled()
	})

	it('asks for confirmation before deleting an investment', async () => {
		const user = userEvent.setup()
		renderWithIntl(<InvestmentList type={InvestmentType.STOCK} onEdit={vi.fn()} />)

		await user.click(screen.getByRole('button', { name: 'Actions for Apple Inc.' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

		const dialog = await screen.findByRole('alertdialog', { name: 'Delete “Apple Inc.”?' })
		expect(mockDelete).not.toHaveBeenCalled()

		await user.click(screen.getByRole('button', { name: 'Delete' }))
		await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('inv1'))
		await waitFor(() => expect(dialog).not.toBeInTheDocument())
	})
})
