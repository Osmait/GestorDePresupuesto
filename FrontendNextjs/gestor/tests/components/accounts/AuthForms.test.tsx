import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/components/accounts/login-form'
import { RegisterForm } from '@/components/accounts/register-form'
import { renderWithIntl } from '@/tests/utils/intl'

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('next-auth/react', () => ({
	signIn: vi.fn(),
}))

vi.mock('@/components/auth/PasskeyLoginButton', () => ({
	PasskeyLoginButton: () => null,
}))

vi.mock('@/lib/repositoryConfig', () => ({
	getAuthRepository: vi.fn(),
}))

describe('LoginForm', () => {
	it('associates each label with its input (the icon wrapper sits outside FormControl)', () => {
		renderWithIntl(<LoginForm />)

		expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
		expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
	})

	it('labels the show-password toggle and reports its pressed state', async () => {
		const user = userEvent.setup()
		renderWithIntl(<LoginForm />)

		const toggle = screen.getByRole('button', { name: 'Show password' })
		expect(toggle).toHaveAttribute('aria-pressed', 'false')

		await user.click(toggle)

		expect(toggle).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
	})
})

describe('RegisterForm', () => {
	it('associates every label with its input', () => {
		renderWithIntl(<RegisterForm />)

		expect(screen.getByLabelText('First name')).toBeInstanceOf(HTMLInputElement)
		expect(screen.getByLabelText('Last name')).toBeInstanceOf(HTMLInputElement)
		expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
		expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
		expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password')
	})

	it('gives both password toggles a name and pressed state', () => {
		renderWithIntl(<RegisterForm />)

		const toggles = screen.getAllByRole('button', { name: 'Show password' })
		expect(toggles).toHaveLength(2)
		for (const toggle of toggles) expect(toggle).toHaveAttribute('aria-pressed', 'false')
	})

	it('lists the password rules with a text state, not color alone', async () => {
		const user = userEvent.setup()
		renderWithIntl(<RegisterForm />)

		await user.type(screen.getByLabelText('Password'), 'abc')

		const rules = screen.getByRole('list', { name: 'Password requirements' })
		expect(rules).toHaveTextContent('Lowercase(met)')
		expect(rules).toHaveTextContent('Uppercase(not met)')
	})
})
