import { render, screen } from '@testing-library/react'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const translations: Record<string, string> = {
            'es': 'Español',
            'en': 'English'
        }
        return translations[key] || key
    },
    useLocale: () => 'en'
}))

describe('LanguageSwitcher', () => {
    it('renders switcher button', () => {
        render(<LanguageSwitcher />)
        expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('shows language options in dropdown', async () => {
        const user = userEvent.setup()
        render(<LanguageSwitcher />)

        await user.click(screen.getByRole('button'))

        expect(await screen.findByText(/Español/)).toBeInTheDocument()
        expect(await screen.findByText(/English/)).toBeInTheDocument()
    })
})
