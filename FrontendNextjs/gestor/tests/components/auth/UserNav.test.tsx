import { render, screen } from '@testing-library/react'
import { UserNav } from '@/components/auth/user-nav'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// Mock next-auth - use inline function to avoid hoisting issues
vi.mock('next-auth/react', () => ({
    useSession: () => ({
        data: {
            user: {
                name: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                image: null
            }
        },
        status: 'authenticated'
    }),
    signOut: vi.fn()
}))

// Mock next-intl
vi.mock('next-intl', () => ({
    useLocale: () => 'en'
}))

// Mock ModeToggle
vi.mock('@/components/common/ToggleMode', () => ({
    ModeToggle: () => <div data-testid="mode-toggle">Theme Toggle</div>
}))

// Mock SettingsModal
vi.mock('@/components/settings/SettingsModal', () => ({
    SettingsModal: ({ open }: { open: boolean }) => open ? <div data-testid="settings-modal">Settings</div> : null
}))

describe('UserNav', () => {
    it('renders user avatar with initials', () => {
        render(<UserNav />)
        expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('shows user info in dropdown', async () => {
        const user = userEvent.setup()
        render(<UserNav />)

        await user.click(screen.getByRole('button'))

        expect(await screen.findByText('John Doe')).toBeInTheDocument()
        expect(await screen.findByText('john@example.com')).toBeInTheDocument()
    })

    it('shows theme toggle and language buttons', async () => {
        const user = userEvent.setup()
        render(<UserNav />)

        await user.click(screen.getByRole('button'))

        expect(await screen.findByTestId('mode-toggle')).toBeInTheDocument()
        expect(await screen.findByText('ES')).toBeInTheDocument()
        expect(await screen.findByText('EN')).toBeInTheDocument()
    })
})
