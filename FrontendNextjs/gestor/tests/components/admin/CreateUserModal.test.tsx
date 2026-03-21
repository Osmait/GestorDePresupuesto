import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateUserModal } from '@/app/admin/dashboard/create-user-modal'

// Mock next-auth
vi.mock('next-auth/react', () => ({
	useSession: () => ({
		data: {
			accessToken: 'mock-token',
		},
		status: 'authenticated',
	}),
}))

// Mock sonner
vi.mock('sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

// Mock fetch
const fetchMock = vi.fn()
global.fetch = fetchMock

describe('CreateUserModal', () => {
	const mockOnUserCreated = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('renders correctly', () => {
		render(<CreateUserModal onUserCreated={mockOnUserCreated} />)

		// Check if the trigger button is present
		expect(screen.getByText('Add User')).toBeDefined()
	})

	it('opens modal when clicking Add User button', () => {
		render(<CreateUserModal onUserCreated={mockOnUserCreated} />)

		const button = screen.getByText('Add User')
		fireEvent.click(button)

		expect(screen.getByText('Create New User')).toBeDefined()
		expect(screen.getByLabelText('First Name')).toBeDefined()
		expect(screen.getByLabelText('Last Name')).toBeDefined()
		expect(screen.getByLabelText('Email')).toBeDefined()
		expect(screen.getByLabelText('Password')).toBeDefined()
		expect(screen.getByText('Role')).toBeDefined()
	})

	it('submits form with correct data', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: '123', name: 'John', last_name: 'Doe' }),
		})

		render(<CreateUserModal onUserCreated={mockOnUserCreated} />)

		// Open modal
		fireEvent.click(screen.getByText('Add User'))

		// Fill form
		fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } })
		fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } })
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } })
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })

		// Role is already USER by default, but let's assume we want to create a USER.
		// If we wanted to test ADMIN selection, we would need to handle the Select component interaction which can be tricky with some UI libraries in tests.
		// For now, let's stick to default USER role which is what the form initializes with.

		// Submit
		fireEvent.click(screen.getByText('Create User'))

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1)
		})

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('/users'),
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
					Authorization: 'Bearer mock-token',
				}),
				body: JSON.stringify({
					name: 'John',
					last_name: 'Doe',
					email: 'john@example.com',
					password: 'password123',
					role: 'USER',
				}),
			}),
		)

		expect(toast.success).toHaveBeenCalled()
		expect(mockOnUserCreated).toHaveBeenCalled()
	})

	it('handles submission error', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 400,
			text: async () => 'Invalid data',
		})

		render(<CreateUserModal onUserCreated={mockOnUserCreated} />)

		// Open modal
		fireEvent.click(screen.getByText('Add User'))

		// Fill form
		fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } })
		fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } })
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } })
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })

		// Submit
		fireEvent.click(screen.getByText('Create User'))

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1)
		})

		expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Error creating user'))
		expect(mockOnUserCreated).not.toHaveBeenCalled()
	})

	it('validates form inputs', async () => {
		render(<CreateUserModal onUserCreated={mockOnUserCreated} />)

		// Open modal
		fireEvent.click(screen.getByText('Add User'))

		// Submit without filling
		fireEvent.click(screen.getByText('Create User'))

		// Should show validation errors (checking for existence of error messages or input states)
		// The component sets errors in state which renders error messages.
		// We can check for the error text if we know it.

		// Based on component code:
		// newErrors.name = "Name must be at least 2 characters";
		// newErrors.email = "Please enter a valid email address";
		// newErrors.password = "Password must be at least 8 characters";

		await waitFor(() => {
			expect(screen.getByText('Name must be at least 2 characters')).toBeDefined()
			expect(screen.getByText('Please enter a valid email address')).toBeDefined()
			expect(screen.getByText('Password must be at least 8 characters')).toBeDefined()
		})

		expect(fetchMock).not.toHaveBeenCalled()
	})
})
