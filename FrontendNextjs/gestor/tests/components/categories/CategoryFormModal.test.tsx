import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryFormModal } from '@/components/categories/CategoryFormModal'
import { renderWithIntl } from '@/tests/utils/intl'

// Polyfills for Radix UI
beforeAll(() => {
	HTMLElement.prototype.hasPointerCapture = vi.fn()
	HTMLElement.prototype.scrollIntoView = vi.fn()
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver
})

const mockUpdateCategory = vi.fn()
let mockEditingCategory: {
	id: string
	name: string
	icon: string
	color: string
	user_id: string
	created_at: string
	updated_at: string
} | null = null

vi.mock('@/components/categories/CategoryContext', () => ({
	useCategoryContext: () => ({
		editingCategory: mockEditingCategory,
		updateCategory: mockUpdateCategory,
	}),
}))

/** Desktop viewport: FormDialog renders a centered Dialog. */
function mockDesktop() {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: true,
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

const FOOD = {
	id: 'cat1',
	name: 'Food',
	icon: '🍔',
	color: '#EF4444',
	user_id: 'u1',
	created_at: '',
	updated_at: '',
}

describe('CategoryFormModal', () => {
	const mockSetOpen = vi.fn()
	const mockOnCreateCategory = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		mockEditingCategory = null
		mockOnCreateCategory.mockResolvedValue(undefined)
		mockDesktop()
	})
	afterEach(() => vi.unstubAllGlobals())

	function renderModal(open = true) {
		return renderWithIntl(
			<CategoryFormModal open={open} setOpen={mockSetOpen} onCreateCategory={mockOnCreateCategory} />,
		)
	}

	it('renders create mode in a dialog with the standard footer', () => {
		renderModal()

		const dialog = screen.getByRole('dialog', { name: 'New Category' })
		expect(dialog).toBeInTheDocument()
		expect(screen.getByLabelText('Name')).toBeInTheDocument()
		expect(screen.getByRole('group', { name: 'Icon' })).toBeInTheDocument()
		expect(screen.getByRole('group', { name: 'Color' })).toBeInTheDocument()
		const footer = dialog.querySelector('[data-slot="form-dialog-footer"]') as HTMLElement
		const buttons = Array.from(footer.querySelectorAll('button')).map((b) => b.textContent)
		expect(buttons).toEqual(['Cancel', 'Create Category'])
	})

	it('renders edit mode with pre-filled values', () => {
		mockEditingCategory = FOOD
		renderModal()

		expect(screen.getByRole('dialog', { name: 'Edit Category' })).toBeInTheDocument()
		expect(screen.getByLabelText('Name')).toHaveValue('Food')
		expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
	})

	it('shows a validation error for an empty name instead of submitting', async () => {
		const user = userEvent.setup()
		renderModal()

		await user.click(screen.getByRole('button', { name: 'Create Category' }))

		expect(await screen.findByText('Name is required')).toBeInTheDocument()
		expect(mockOnCreateCategory).not.toHaveBeenCalled()
	})

	it('submits with the picked icon and color in create mode', async () => {
		const user = userEvent.setup()
		renderModal()

		await user.type(screen.getByLabelText('Name'), 'Groceries')
		const food = screen.getByRole('button', { name: 'Food' })
		await user.click(food)
		expect(food).toHaveAttribute('aria-pressed', 'true')
		await user.click(screen.getByRole('button', { name: 'Red' }))
		await user.click(screen.getByRole('button', { name: 'Create Category' }))

		await waitFor(() => {
			expect(mockOnCreateCategory).toHaveBeenCalledWith('Groceries', '🍔', '#EF4444')
		})
		expect(mockSetOpen).toHaveBeenCalledWith(false)
	})

	it('submits with correct values in edit mode', async () => {
		const user = userEvent.setup()
		mockEditingCategory = FOOD
		renderModal()

		const nameInput = screen.getByLabelText('Name')
		await user.clear(nameInput)
		await user.type(nameInput, 'Updated Food')
		await user.click(screen.getByRole('button', { name: 'Save Changes' }))

		await waitFor(() => {
			expect(mockUpdateCategory).toHaveBeenCalledWith('cat1', 'Updated Food', '🍔', '#EF4444')
		})
	})

	it('shows an inline error and stays open when saving fails', async () => {
		const user = userEvent.setup()
		mockOnCreateCategory.mockRejectedValue(new Error('boom'))
		renderModal()

		await user.type(screen.getByLabelText('Name'), 'Groceries')
		await user.click(screen.getByRole('button', { name: 'Create Category' }))

		expect(await screen.findByText("Couldn't save the category. Try again.")).toBeInTheDocument()
		expect(mockSetOpen).not.toHaveBeenCalledWith(false)
	})

	it('cancel button closes the dialog', async () => {
		const user = userEvent.setup()
		renderModal()

		await user.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(mockSetOpen).toHaveBeenCalledWith(false)
	})

	it('shows a spinner and disables the buttons while submitting', async () => {
		const user = userEvent.setup()
		mockOnCreateCategory.mockImplementation(() => new Promise(() => {}))
		renderModal()

		await user.type(screen.getByLabelText('Name'), 'Test')
		const submit = screen.getByRole('button', { name: 'Create Category' })
		await user.click(submit)

		await waitFor(() => expect(submit).toBeDisabled())
		expect(submit.querySelector('svg.animate-spin')).not.toBeNull()
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
	})
})
