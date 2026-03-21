import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryFormModal } from '@/components/categories/CategoryFormModal'

// Polyfill for Radix UI
beforeAll(() => {
	HTMLElement.prototype.hasPointerCapture = vi.fn()
	HTMLElement.prototype.scrollIntoView = vi.fn()
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver
})

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}))

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

describe('CategoryFormModal', () => {
	const mockSetOpen = vi.fn()
	const mockOnCreateCategory = vi.fn().mockResolvedValue(undefined)

	beforeEach(() => {
		vi.clearAllMocks()
		mockEditingCategory = null
	})

	function renderModal(open = true) {
		return render(<CategoryFormModal open={open} setOpen={mockSetOpen} onCreateCategory={mockOnCreateCategory} />)
	}

	it('renders create mode correctly', () => {
		renderModal()

		expect(screen.getByText('newCategory')).toBeInTheDocument()
		expect(screen.getByText('addDescription')).toBeInTheDocument()
		expect(screen.getByText('name')).toBeInTheDocument()
		expect(screen.getByText('icon')).toBeInTheDocument()
		expect(screen.getByText('color')).toBeInTheDocument()
		expect(screen.getByText('createCategory')).toBeInTheDocument()
	})

	it('renders edit mode with pre-filled values', () => {
		mockEditingCategory = {
			id: 'cat1',
			name: 'Food',
			icon: '🍔',
			color: '#EF4444',
			user_id: 'u1',
			created_at: '',
			updated_at: '',
		}

		renderModal()

		expect(screen.getByText('editCategory')).toBeInTheDocument()
		expect(screen.getByText('editDescription')).toBeInTheDocument()
		expect(screen.getByPlaceholderText('namePlaceholder')).toHaveValue('Food')
		expect(screen.getByText('saveChanges')).toBeInTheDocument()
	})

	it('shows validation error for empty name', async () => {
		const user = userEvent.setup()
		renderModal()

		const nameInput = screen.getByPlaceholderText('namePlaceholder')
		// Type something then clear it to trigger validation
		await user.type(nameInput, 'a')
		await user.clear(nameInput)

		// The submit button should be disabled when name is empty (form invalid)
		await waitFor(() => {
			const submitButton = screen.getByText('createCategory')
			expect(submitButton).toBeDisabled()
		})
	})

	it('submits with correct values in create mode', async () => {
		const user = userEvent.setup()
		renderModal()

		const nameInput = screen.getByPlaceholderText('namePlaceholder')
		await user.type(nameInput, 'Groceries')

		// Click submit
		const submitButton = screen.getByText('createCategory')
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockOnCreateCategory).toHaveBeenCalledWith('Groceries', expect.any(String), expect.any(String))
		})
	})

	it('submits with correct values in edit mode', async () => {
		const user = userEvent.setup()
		mockEditingCategory = {
			id: 'cat1',
			name: 'Food',
			icon: '🍔',
			color: '#EF4444',
			user_id: 'u1',
			created_at: '',
			updated_at: '',
		}

		renderModal()

		const nameInput = screen.getByPlaceholderText('namePlaceholder')
		await user.clear(nameInput)
		await user.type(nameInput, 'Updated Food')

		const submitButton = screen.getByText('saveChanges')
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockUpdateCategory).toHaveBeenCalledWith('cat1', 'Updated Food', '🍔', '#EF4444')
		})
	})

	it('icon selection changes value', async () => {
		const user = userEvent.setup()
		renderModal()

		// Click on the food emoji button
		const foodEmojiButton = screen.getByRole('button', { name: '🍔' })
		await user.click(foodEmojiButton)

		// The food emoji button should now have the selected ring
		expect(foodEmojiButton.className).toContain('ring-2')
	})

	it('cancel button closes dialog', async () => {
		const user = userEvent.setup()
		renderModal()

		const cancelButton = screen.getByText('cancel')
		await user.click(cancelButton)

		expect(mockSetOpen).toHaveBeenCalledWith(false)
	})

	it('submit button is disabled while submitting', async () => {
		const user = userEvent.setup()
		// Make onCreateCategory hang
		mockOnCreateCategory.mockImplementation(() => new Promise(() => {}))

		renderModal()

		const nameInput = screen.getByPlaceholderText('namePlaceholder')
		await user.type(nameInput, 'Test')

		const submitButton = screen.getByText('createCategory')
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText('saving')).toBeInTheDocument()
		})
	})
})
