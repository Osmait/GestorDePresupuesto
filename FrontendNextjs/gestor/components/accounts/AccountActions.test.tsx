import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AccountActions } from './AccountActions'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// Mock Translations
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const translations: Record<string, string> = {
            'addAccount': 'Add Account'
        }
        return translations[key] || key
    },
}))

// Mock Context
const mockCreateAccount = vi.fn()
vi.mock('@/components/accounts/AccountContext', () => ({
    useAccountContext: () => ({
        createAccount: mockCreateAccount,
        addAccount: vi.fn(),
        isLoading: false,
        error: null
    })
}))

// Mock Modal Component to verify it receives open prop
vi.mock('@/components/accounts/AccountFormModal', () => ({
    AccountFormModal: ({ open, setOpen, createAccount }: any) => (
        open ? (
            <div data-testid="mock-modal">
                <button onClick={() => setOpen(false)}>Close</button>
                <button onClick={() => createAccount('New Bank', 'Bank', 1000)}>Create</button>
            </div>
        ) : null
    )
}))

describe('AccountActions', () => {
    it('renders add account button', () => {
        render(<AccountActions />)
        expect(screen.getByText('Add Account')).toBeInTheDocument()
    })

    it('opens modal when add button is clicked', () => {
        render(<AccountActions />)

        // Initial state: modal hidden
        expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument()

        // Click add
        fireEvent.click(screen.getByText('Add Account'))

        // Expect modal to be visible
        expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
    })

    it('calls createAccount from context when modal submits', async () => {
        render(<AccountActions />)

        // Open modal
        fireEvent.click(screen.getByText('Add Account'))

        // Click "Create" in mock modal
        fireEvent.click(screen.getByText('Create'))

        // Verify loading/creation flow (mock calls context)
        expect(mockCreateAccount).toHaveBeenCalledWith('New Bank', 'Bank', 1000)
    })
})
