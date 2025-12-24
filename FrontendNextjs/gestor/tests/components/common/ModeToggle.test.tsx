import { render, screen } from '@testing-library/react'
import { ModeToggle } from '@/components/common/ToggleMode'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

const mockSetTheme = vi.fn()

vi.mock('next-themes', () => ({
    useTheme: () => ({
        setTheme: mockSetTheme,
        theme: 'light'
    }),
}))

describe('ModeToggle', () => {
    beforeEach(() => {
        mockSetTheme.mockClear()
    })

    it('renders toggle button', () => {
        render(<ModeToggle />)
        expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('opens dropdown and shows theme options', async () => {
        const user = userEvent.setup()
        render(<ModeToggle />)

        await user.click(screen.getByRole('button'))

        expect(await screen.findByText('Light')).toBeInTheDocument()
        expect(await screen.findByText('Dark')).toBeInTheDocument()
        expect(await screen.findByText('System')).toBeInTheDocument()
    })

    it('calls setTheme when option is clicked', async () => {
        const user = userEvent.setup()
        render(<ModeToggle />)

        await user.click(screen.getByRole('button'))
        await user.click(await screen.findByText('Dark'))

        expect(mockSetTheme).toHaveBeenCalledWith('dark')
    })
})
