import { render, screen } from '@testing-library/react'
import { RecurringTransactionActions } from '@/components/recurring/RecurringTransactionActions'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// Mock context
const mockSetModalOpen = vi.fn()
const mockSetEditingTransaction = vi.fn()
vi.mock('@/components/recurring/RecurringTransactionContext', () => ({
    useRecurringTransactionContext: () => ({
        setModalOpen: mockSetModalOpen,
        setEditingTransaction: mockSetEditingTransaction
    })
}))

// Mock mutation
vi.mock('@/hooks/queries/useRecurringTransactionsQuery', () => ({
    useProcessRecurringTransactionsMutation: () => ({
        mutate: vi.fn(),
        isPending: false
    })
}))

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}))

describe('RecurringTransactionActions', () => {
    beforeEach(() => {
        mockSetModalOpen.mockClear()
        mockSetEditingTransaction.mockClear()
    })

    it('renders action buttons', () => {
        render(<RecurringTransactionActions />)

        expect(screen.getByText('Ejecutar Ahora')).toBeInTheDocument()
        expect(screen.getByText('Nueva Recurrente')).toBeInTheDocument()
    })

    it('opens modal when new button is clicked', async () => {
        const user = userEvent.setup()
        render(<RecurringTransactionActions />)

        await user.click(screen.getByText('Nueva Recurrente'))

        expect(mockSetEditingTransaction).toHaveBeenCalledWith(null)
        expect(mockSetModalOpen).toHaveBeenCalledWith(true)
    })

    it('shows confirmation dialog when execute button is clicked', async () => {
        const user = userEvent.setup()
        render(<RecurringTransactionActions />)

        await user.click(screen.getByText('Ejecutar Ahora'))

        expect(await screen.findByText('Ejecutar Transacciones Recurrentes')).toBeInTheDocument()
        expect(await screen.findByText('Confirmar Ejecución')).toBeInTheDocument()
    })
})
