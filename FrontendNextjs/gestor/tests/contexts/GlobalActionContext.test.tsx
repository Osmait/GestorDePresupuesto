import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { vi } from 'vitest'
import { GlobalActionProvider, useGlobalAction } from '@/contexts/GlobalActionContext'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh, prefetch: vi.fn(), back: vi.fn() }),
	usePathname: () => '/app/accounts',
	useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
	useLocale: () => 'es',
}))

const accountRepo = { create: vi.fn().mockResolvedValue(undefined), findAll: vi.fn().mockResolvedValue([]) }
vi.mock('@/lib/repositoryConfig', () => ({
	getAccountRepository: () => Promise.resolve(accountRepo),
}))

function OpenAccount() {
	const { openModal } = useGlobalAction()
	return (
		<button type='button' onClick={() => openModal('ACCOUNT')}>
			open-account
		</button>
	)
}

describe('GlobalActionProvider', () => {
	it('creating an account from the global "+" invalidates the accounts list and refreshes server data', async () => {
		const user = userEvent.setup()
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		queryClient.setQueryData(['accounts', 'list'], [])

		render(
			<QueryClientProvider client={queryClient}>
				<GlobalActionProvider>
					<OpenAccount />
				</GlobalActionProvider>
			</QueryClientProvider>,
		)

		await user.click(screen.getByRole('button', { name: 'open-account' }))
		const dialog = await screen.findByRole('dialog')
		const [name, bank] = Array.from(dialog.querySelectorAll('input'))
		await user.type(name, 'Cuenta nueva')
		await user.type(bank, 'Banco Popular')
		await user.click(screen.getByRole('button', { name: 'createAccount' }))

		await waitFor(() => expect(accountRepo.create).toHaveBeenCalledWith('Cuenta nueva', 'Banco Popular', 0))
		await waitFor(() => expect(refresh).toHaveBeenCalled())
		expect(queryClient.getQueryState(['accounts', 'list'])?.isInvalidated).toBe(true)
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
	})
})
