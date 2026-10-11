import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => {
		const translations: Record<string, string> = {
			es: 'Español',
			en: 'English',
			switch: 'Change language',
		}
		return translations[key] || key
	},
	useLocale: () => 'en',
}))

describe('LanguageSwitcher', () => {
	it('renders a labelled switcher button', () => {
		render(<LanguageSwitcher />)
		expect(screen.getByRole('button', { name: 'Change language' })).toBeInTheDocument()
	})

	it('shows language options in dropdown', async () => {
		const user = userEvent.setup()
		render(<LanguageSwitcher />)

		await user.click(screen.getByRole('button'))

		expect(await screen.findByText(/Español/)).toBeInTheDocument()
		expect(await screen.findByText(/English/)).toBeInTheDocument()
	})
})
