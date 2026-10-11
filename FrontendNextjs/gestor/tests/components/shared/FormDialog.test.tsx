import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { FormDialog, type FormDialogProps } from '@/components/shared/FormDialog'
import { renderWithIntl } from '@/tests/utils/intl'

function mockViewport(desktop: boolean) {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: desktop,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	)
}

/** Overrides for the onSubmit variant (the default here). */
type DialogOverrides = Partial<Omit<FormDialogProps, 'onSubmit' | 'formId' | 'footer'>> & {
	onSubmit?: Extract<FormDialogProps, { formId?: never }>['onSubmit']
}

function renderDialog(props: DialogOverrides = {}) {
	return renderWithIntl(
		<FormDialog open onOpenChange={vi.fn()} title='New account' {...props} onSubmit={props.onSubmit ?? vi.fn()}>
			<label htmlFor='name'>Name</label>
			<input id='name' name='name' />
		</FormDialog>,
	)
}

describe('FormDialog on desktop', () => {
	beforeEach(() => mockViewport(true))
	afterEach(() => vi.unstubAllGlobals())

	it('renders a dialog with the footer in order: Cancel (outline) then submit', () => {
		renderDialog({ submitLabel: 'Create account' })

		expect(screen.getByRole('dialog', { name: 'New account' })).toBeInTheDocument()
		const footer = document.querySelector('[data-slot="form-dialog-footer"]') as HTMLElement
		const buttons = Array.from(footer.querySelectorAll('button')).map((b) => b.textContent)
		expect(buttons).toEqual(['Cancel', 'Create account'])
		expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('border-input')
		expect(screen.getByRole('button', { name: 'Create account' })).toHaveAttribute('type', 'submit')
	})

	it('defaults the submit label to the translated "Save"', () => {
		renderWithIntl(
			<FormDialog open onOpenChange={vi.fn()} title='Editar' onSubmit={vi.fn()}>
				<p>body</p>
			</FormDialog>,
			{ locale: 'es' },
		)
		expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
	})

	it('calls onSubmit when the form is submitted', async () => {
		const user = userEvent.setup()
		const onSubmit = vi.fn()
		renderDialog({ onSubmit })

		await user.type(screen.getByLabelText('Name'), 'Ahorros{Enter}')

		expect(onSubmit).toHaveBeenCalledTimes(1)
	})

	it('shows a spinner, disables both buttons and blocks closing while loading', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		const onSubmit = vi.fn()
		renderDialog({ loading: true, onOpenChange, onSubmit, submitLabel: 'Create account' })

		const submit = screen.getByRole('button', { name: 'Create account' })
		expect(submit).toBeDisabled()
		expect(submit).toHaveAttribute('aria-busy', 'true')
		expect(submit.querySelector('.animate-spin')).not.toBeNull()
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()

		await user.keyboard('{Escape}')
		expect(onOpenChange).not.toHaveBeenCalled()
	})

	it('keeps the loading guard on a custom footer', () => {
		renderWithIntl(
			<FormDialog
				open
				onOpenChange={vi.fn()}
				title='Import'
				loading
				footer={
					<button type='button' onClick={vi.fn()}>
						Apply
					</button>
				}
			>
				<p>body</p>
			</FormDialog>,
		)
		expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
	})

	it('closes through onOpenChange(false) on Cancel', async () => {
		const user = userEvent.setup()
		const onOpenChange = vi.fn()
		renderDialog({ onOpenChange })

		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it('renders the inline error as a destructive alert', () => {
		renderDialog({ error: 'The name is already taken' })
		expect(screen.getByRole('alert')).toHaveTextContent('The name is already taken')
	})

	it('targets an external form through formId', () => {
		renderWithIntl(
			<FormDialog open onOpenChange={vi.fn()} title='Edit' formId='edit-form'>
				<form id='edit-form' />
			</FormDialog>,
		)
		expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('form', 'edit-form')
	})
})

describe('FormDialog on mobile', () => {
	beforeEach(() => mockViewport(false))
	afterEach(() => vi.unstubAllGlobals())

	it('renders a drawer with the same title, footer and submit', async () => {
		const onSubmit = vi.fn()
		renderDialog({ onSubmit, submitLabel: 'Create account' })

		await waitFor(() => expect(screen.getByRole('dialog', { name: 'New account' })).toBeInTheDocument())
		expect(screen.getByRole('button', { name: 'Create account' })).toHaveAttribute('type', 'submit')
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
	})
})
