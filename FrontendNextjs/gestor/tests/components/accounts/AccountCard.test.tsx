import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AccountCard } from '@/components/accounts/AccountCard'

// Mock dependencies
vi.mock('next/navigation', () => ({
	useRouter: () => ({
		push: vi.fn(),
	}),
}))

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => {
		const translations: Record<string, string> = {
			currentBalance: 'Balance Actual',
			initial: 'Inicial',
			high: 'Alto',
			medium: 'Medio',
			low: 'Bajo',
			edit: 'Editar',
			delete: 'Eliminar',
			deleteTitle: 'Eliminar Cuenta',
			deleteDescription: '¿Estás seguro?',
			cancel: 'Cancelar',
			deleting: 'Eliminando...',
		}
		return translations[key] || key
	},
}))

describe('AccountCard', () => {
	const mockAccount = {
		id: '1',
		name: 'Main Checking',
		bank: 'Chase',
		current_balance: 5000,
		initial_balance: 4000,
		type_account: 'savings',
		currency: 'USD',
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		user_id: 'user1',
	}

	it('renders account details correctly', () => {
		render(<AccountCard account={mockAccount} />)

		expect(screen.getByText('Main Checking')).toBeInTheDocument()
		expect(screen.getByText('Chase')).toBeInTheDocument()
		// Use custom matcher for currency to handle potential formatting differences
		expect(screen.getByText('US$5,000.00')).toBeInTheDocument()
		expect(screen.getByText('Balance Actual')).toBeInTheDocument()
	})

	it('displays growth indicator positive', () => {
		render(<AccountCard account={mockAccount} />)
		// Use custom matcher for growth
		expect(screen.getByText('+US$1,000.00')).toHaveClass('text-green-600')
	})

	it('calls onAccountEdit when edit option is clicked', async () => {
		const user = userEvent.setup()
		const onEdit = vi.fn()
		render(<AccountCard account={mockAccount} onAccountEdit={onEdit} />)

		// Open dropdown
		const trigger = screen.getByRole('button', { name: 'options' })
		await user.click(trigger)

		// Click edit - use findByText to wait for it to appear
		const editOption = await screen.findByText('Editar')
		await user.click(editOption)

		expect(onEdit).toHaveBeenCalledWith(mockAccount)
	})

	it('is keyboard accessible: the account name is a link to the detail page', () => {
		render(<AccountCard account={mockAccount} />)
		const link = screen.getByRole('link', { name: 'Main Checking' })
		expect(link).toHaveAttribute('href', '/app/accounts/1')
	})

	it('shows a decrease with its sign in red', () => {
		render(<AccountCard account={{ ...mockAccount, current_balance: 3500.25 }} />)
		expect(screen.getByText('-US$499.75')).toHaveClass('text-red-600')
	})
})
