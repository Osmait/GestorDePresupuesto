import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ErrorState } from '@/components/shared/ErrorState'
import { renderWithIntl } from '@/tests/utils/intl'

describe('ErrorState', () => {
	it('announces translated defaults and retries', async () => {
		const user = userEvent.setup()
		const onRetry = vi.fn()
		renderWithIntl(<ErrorState onRetry={onRetry} />, { locale: 'es' })

		expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar')
		await user.click(screen.getByRole('button', { name: 'Reintentar' }))
		expect(onRetry).toHaveBeenCalledTimes(1)
	})

	it('has no retry button without onRetry and accepts custom copy', () => {
		renderWithIntl(<ErrorState title='Accounts failed' description='Try later.' />)

		expect(screen.getByRole('heading', { level: 2, name: 'Accounts failed' })).toBeInTheDocument()
		expect(screen.getByText('Try later.')).toBeInTheDocument()
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})
})
