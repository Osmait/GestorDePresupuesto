import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { APIKeysSection } from '@/components/settings/APIKeysSection'
import type { APIKey } from '@/types/apikey'

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

// Module-level state so individual tests can override the returned keys
let mockAPIKeys: APIKey[] = []
let mockIsLoading = false
const mockCreateMutateAsync = vi.fn().mockResolvedValue({})
const mockRevokeMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('@/hooks/queries/useAPIKeysQuery', () => ({
	useGetAPIKeys: () => ({
		data: mockAPIKeys,
		isLoading: mockIsLoading,
	}),
	useCreateAPIKeyMutation: () => ({
		mutateAsync: mockCreateMutateAsync,
		isPending: false,
	}),
	useRevokeAPIKeyMutation: () => ({
		mutateAsync: mockRevokeMutateAsync,
		isPending: false,
	}),
}))

vi.mock('sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

describe('APIKeysSection', () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})

	beforeEach(() => {
		vi.clearAllMocks()
		mockAPIKeys = []
		mockIsLoading = false
	})

	function renderSection() {
		return render(
			<QueryClientProvider client={queryClient}>
				<APIKeysSection />
			</QueryClientProvider>,
		)
	}

	it('renders empty state when no API keys exist', () => {
		renderSection()

		expect(screen.getByText('No hay claves API')).toBeInTheDocument()
		expect(screen.getByText('Crea una clave para conectar clientes MCP')).toBeInTheDocument()
	})

	it('renders list of existing API keys with prefix and name', () => {
		mockAPIKeys = [
			{
				id: 'key-1',
				user_id: 'user-1',
				name: 'Claude Desktop',
				key_prefix: 'sk-abc123',
				last_used_at: null,
				expires_at: null,
				created_at: '2024-01-15T10:00:00Z',
				is_active: true,
			},
			{
				id: 'key-2',
				user_id: 'user-1',
				name: 'My Integration',
				key_prefix: 'sk-xyz789',
				last_used_at: '2024-02-01T12:00:00Z',
				expires_at: null,
				created_at: '2024-01-20T09:00:00Z',
				is_active: false,
			},
		]

		renderSection()

		expect(screen.getByText('Claude Desktop')).toBeInTheDocument()
		expect(screen.getByText('sk-abc123...')).toBeInTheDocument()
		expect(screen.getByText('Activa')).toBeInTheDocument()

		expect(screen.getByText('My Integration')).toBeInTheDocument()
		expect(screen.getByText('sk-xyz789...')).toBeInTheDocument()
		expect(screen.getByText('Inactiva')).toBeInTheDocument()
	})

	it('shows create dialog when clicking "Nueva clave" button', async () => {
		const user = userEvent.setup()
		renderSection()

		const newKeyButton = screen.getByRole('button', { name: /Nueva clave/i })
		await user.click(newKeyButton)

		expect(screen.getByText('Crear nueva clave API')).toBeInTheDocument()
		expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Crear clave' })).toBeInTheDocument()
	})

	it('shows Claude Desktop config section', () => {
		renderSection()

		expect(screen.getByText('Configuración de Claude Desktop')).toBeInTheDocument()
		expect(screen.getByText('claude_desktop_config.json')).toBeInTheDocument()
		// The config JSON is rendered inside a <pre> block; match against the raw text content
		expect(screen.getByText((content) => content.includes('gestor-presupuesto'))).toBeInTheDocument()
	})
})
