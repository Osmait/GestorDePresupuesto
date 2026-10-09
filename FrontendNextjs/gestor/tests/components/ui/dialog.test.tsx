import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { renderWithIntl } from '@/tests/utils/intl'

const MISSING_DESCRIPTION = 'Missing `Description`'

function warnedAboutDescription(spy: ReturnType<typeof vi.spyOn>) {
	return spy.mock.calls.some((args: unknown[]) => String(args[0]).includes(MISSING_DESCRIPTION))
}

describe('DialogContent accessible description', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('does not warn and drops aria-describedby when the dialog has no description', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle>Title only</DialogTitle>
				</DialogContent>
			</Dialog>,
		)

		expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby')
		expect(warnedAboutDescription(warn)).toBe(false)
	})

	it('links a rendered DialogDescription through aria-describedby', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		render(
			<Dialog open>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete</DialogTitle>
						<DialogDescription>This cannot be undone</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>,
		)

		const dialog = screen.getByRole('dialog')
		const describedBy = dialog.getAttribute('aria-describedby')
		expect(describedBy).toBeTruthy()
		expect(document.getElementById(describedBy!)).toHaveTextContent('This cannot be undone')
		expect(screen.getByRole('dialog', { description: 'This cannot be undone' })).toBeInTheDocument()
		expect(warnedAboutDescription(warn)).toBe(false)
	})

	it('renders the optional `description` prop as a visually hidden description', () => {
		render(
			<Dialog open>
				<DialogContent description='Hidden helper text'>
					<DialogTitle>With prop</DialogTitle>
				</DialogContent>
			</Dialog>,
		)

		expect(screen.getByRole('dialog', { description: 'Hidden helper text' })).toBeInTheDocument()
		expect(screen.getByText('Hidden helper text')).toHaveClass('sr-only')
	})
})

describe('DialogContent close button label', () => {
	function dialogUi(closeLabel?: string) {
		return (
			<Dialog open>
				<DialogContent closeLabel={closeLabel}>
					<DialogTitle>Title</DialogTitle>
				</DialogContent>
			</Dialog>
		)
	}

	it('uses the translated label inside an intl provider', () => {
		renderWithIntl(dialogUi(), { locale: 'es' })
		expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
	})

	it('uses the English label for the en locale', () => {
		renderWithIntl(dialogUi(), { locale: 'en' })
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
	})

	it('falls back to English without an intl provider', () => {
		render(dialogUi())
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
	})

	it('prefers an explicit closeLabel', () => {
		renderWithIntl(dialogUi('Cerrar ventana'), { locale: 'es' })
		expect(screen.getByRole('button', { name: 'Cerrar ventana' })).toBeInTheDocument()
	})
})
