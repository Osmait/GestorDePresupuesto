import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { vi } from 'vitest'
import { ConfirmDialog, type ConfirmDialogProps } from '@/components/shared/ConfirmDialog'
import { renderWithIntl } from '@/tests/utils/intl'

function Harness(props: Partial<ConfirmDialogProps> & { onOpenChangeSpy?: (open: boolean) => void }) {
	const [open, setOpen] = useState(true)
	return (
		<ConfirmDialog
			open={open}
			onOpenChange={(next) => {
				props.onOpenChangeSpy?.(next)
				setOpen(next)
			}}
			title='Delete the account “Ahorros”?'
			description='Its transactions are deleted too.'
			onConfirm={vi.fn()}
			{...props}
		/>
	)
}

describe('ConfirmDialog', () => {
	it('renders an alertdialog with title, description and translated default labels', () => {
		renderWithIntl(<Harness destructive />, { locale: 'es' })

		const dialog = screen.getByRole('alertdialog', { name: 'Delete the account “Ahorros”?' })
		expect(dialog).toHaveAccessibleDescription('Its transactions are deleted too.')
		expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
	})

	it('uses "Confirm" for non-destructive dialogs and honors custom labels', () => {
		const { unmount } = renderWithIntl(<Harness />)
		expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
		unmount()

		renderWithIntl(<Harness confirmLabel='Archive' cancelLabel='Keep' />)
		expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument()
	})

	it('runs a sync onConfirm and closes', async () => {
		const user = userEvent.setup()
		const onConfirm = vi.fn()
		const onOpenChangeSpy = vi.fn()
		renderWithIntl(<Harness destructive onConfirm={onConfirm} onOpenChangeSpy={onOpenChangeSpy} />)

		await user.click(screen.getByRole('button', { name: 'Delete' }))

		expect(onConfirm).toHaveBeenCalledTimes(1)
		expect(onOpenChangeSpy).toHaveBeenCalledWith(false)
		await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
	})

	it('stays open with a busy, aria-disabled confirm (keeping focus) until an async onConfirm resolves', async () => {
		const user = userEvent.setup()
		let resolve!: () => void
		const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)))
		renderWithIntl(<Harness destructive onConfirm={onConfirm} />)

		await user.click(screen.getByRole('button', { name: 'Delete' }))

		const confirm = screen.getByRole('button', { name: 'Delete' })
		expect(confirm).toHaveAttribute('aria-disabled', 'true')
		expect(confirm).toHaveAttribute('aria-busy', 'true')
		expect(confirm).toHaveFocus()
		// A second click while busy does nothing.
		await user.click(confirm)
		expect(onConfirm).toHaveBeenCalledTimes(1)
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

		resolve()
		await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
	})

	it('stays open with an inline error when an async onConfirm rejects', async () => {
		const user = userEvent.setup()
		const onConfirm = vi.fn(() => Promise.reject(new Error('boom')))
		renderWithIntl(<Harness destructive onConfirm={onConfirm} />)

		await user.click(screen.getByRole('button', { name: 'Delete' }))

		await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute('aria-disabled'))
		expect(screen.getByRole('alertdialog')).toBeInTheDocument()
		expect(screen.getByRole('alert')).toHaveTextContent("Couldn't complete the action. Try again.")
	})

	it('cancels without running onConfirm', async () => {
		const user = userEvent.setup()
		const onConfirm = vi.fn()
		renderWithIntl(<Harness onConfirm={onConfirm} />)

		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(onConfirm).not.toHaveBeenCalled()
		await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
	})

	it('ignores dismissal while loading', async () => {
		const user = userEvent.setup()
		const onOpenChangeSpy = vi.fn()
		renderWithIntl(<Harness loading onOpenChangeSpy={onOpenChangeSpy} />)

		await user.keyboard('{Escape}')

		expect(onOpenChangeSpy).not.toHaveBeenCalled()
		expect(screen.getByRole('alertdialog')).toBeInTheDocument()
	})
})
